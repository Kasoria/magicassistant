<?php

namespace MagicAssistant;

// Import global PHP/WordPress classes
use Exception;
use InvalidArgumentException;
use WP_Error;
use WP_Query;
use WP_User_Query;
use WP_REST_Request;
use WC_Product_Query;

if (!defined('ABSPATH')) exit;

class MCP_Server {
    
    private $enabled = false;
    private $jwt_secret = null;
    private $ai_provider = null;
    private $db = null;
    private $registered_tools = [];
    private $registered_resources = [];
    private $registered_prompts = [];
    private $tools_discovered = false;
    
    public function __construct($db = null) {
        $this->db = $db;
        add_action('init', array($this, 'init'), 20); // Later priority to ensure DB is ready
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    public function init() {
        // Ensure we have a database instance
        if (!$this->db) {
            // Try to get it from the global plugin instance
            if (function_exists('magic_assistant') && magic_assistant() && magic_assistant()->get_db()) {
                $this->db = magic_assistant()->get_db();
            } else {
                // Fallback: create a new DB instance
                $this->db = new DB();
            }
        }
        
        // Ensure database tables exist before proceeding
        if (!$this->db->tables_exist()) {
            $this->db->create_tables();
        }
        
        // If no MCP settings exist at all, initialize with sensible defaults
        if (!$this->db->setting_exists('mcp_enabled')) {
            // First time setup - set reasonable defaults
            $this->db->save_setting('mcp_enabled', true);
            $this->db->save_setting('enable_create_tools', true);
            $this->db->save_setting('enable_update_tools', true);
            $this->db->save_setting('enable_delete_tools', false); // Keep delete disabled by default for safety
        }
        
        // Check if MCP should be enabled
        $this->enabled = $this->db->get_setting('mcp_enabled', true); // Default to enabled if setting doesn't exist
        
        if (!$this->enabled) {
            return;
        }
        
        // Initialize JWT secret
        $this->init_jwt_secret();
        
        // Register default tools
        $this->register_default_tools();
        
        // Allow other parts of the plugin to register custom tools
        do_action('magic_assistant_mcp_init', $this);
    }
    
    public function set_ai_provider($ai_provider) {
        $this->ai_provider = $ai_provider;
    }
    
    public function set_db($db) {
        $this->db = $db;
    }
    
    private function init_jwt_secret() {
        if (!$this->db) {
            return;
        }
        
        $this->jwt_secret = $this->db->get_setting('mcp_jwt_secret');
        
        if (empty($this->jwt_secret)) {
            $this->jwt_secret = wp_generate_password(64, true, true);
            $this->db->save_setting('mcp_jwt_secret', $this->jwt_secret);
        }
    }
    
    public function register_rest_routes() {
        if (!$this->enabled) {
            return;
        }
        
        // Main MCP endpoint - JSON-RPC 2.0 compliant
        register_rest_route('magicassistant/v1', '/mcp', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_mcp_request'),
            'permission_callback' => array($this, 'check_mcp_permissions'),
        ));
        
        // JWT token generation endpoint
        register_rest_route('magicassistant/v1', '/mcp/auth', array(
            'methods' => 'POST',
            'callback' => array($this, 'generate_jwt_token'),
            'permission_callback' => array($this, 'check_auth_permissions'),
        ));
    }
    
    public function handle_mcp_request($request) {
        $body = $request->get_json_params();
        
        if (!$body || !isset($body['method'])) {
            return new WP_Error('invalid_request', 'Invalid JSON-RPC request', array('status' => 400));
        }
        
        $method = $body['method'];
        $params = isset($body['params']) ? $body['params'] : [];
        $id = isset($body['id']) ? $body['id'] : null;
        
        try {
            switch ($method) {
                case 'tools/list':
                    $result = $this->list_tools();
                    break;
                case 'tools/call':
                    $result = $this->call_tool($params);
                    break;
                case 'resources/list':
                    $result = $this->list_resources();
                    break;
                case 'resources/read':
                    $result = $this->read_resource($params);
                    break;
                case 'prompts/list':
                    $result = $this->list_prompts();
                    break;
                case 'prompts/get':
                    $result = $this->get_prompt($params);
                    break;
                case 'security/core_checksum':
                    $result = $this->security_core_checksum($params);
                    break;
                case 'security/file_permissions':
                    $result = $this->security_file_permissions($params);
                    break;
                case 'security/http_headers':
                    $result = $this->security_http_headers($params);
                    break;
                case 'security/https_enforcement':
                    $result = $this->security_https_enforcement($params);
                    break;
                case 'security/php_version_check':
                    $result = $this->security_php_version_check($params);
                    break;
                case 'security/admin_users_audit':
                    $result = $this->security_admin_users_audit($params);
                    break;
                case 'security/login_events':
                    $result = $this->security_login_events($params);
                    break;
                case 'security/file_integrity_watch':
                    $result = $this->security_file_integrity_watch($params);
                    break;
                case 'security/plugins_checksum':
                    $result = $this->security_plugins_checksum($params);
                    break;
                case 'security/themes_checksum':
                    $result = $this->security_themes_checksum($params);
                    break;
                case 'security/vulnerability_scan':
                    $result = $this->security_vulnerability_scan($params);
                    break;
                case 'security/htaccess_protection':
                    $result = $this->security_htaccess_protection($params);
                    break;
                case 'unsplash_search_images':
                    $result = $this->unsplash_search_images($params);
                    break;
                case 'unsplash_get_random_images':
                    $result = $this->unsplash_random_images($params);
                    break;
                default:
                    throw new Exception('Method not found: ' . $method);
            }
            
            return array(
                'jsonrpc' => '2.0',
                'result' => $result,
                'id' => $id
            );
            
        } catch (Exception $e) {
            return array(
                'jsonrpc' => '2.0',
                'error' => array(
                    'code' => -32603,
                    'message' => $e->getMessage()
                ),
                'id' => $id
            );
        }
    }
    
    public function check_mcp_permissions($request) {
        // Check for JWT token in Authorization header
        $auth_header = $request->get_header('Authorization');
        
        if (!$auth_header) {
            return new WP_Error('no_auth', 'Authorization header required', array('status' => 401));
        }
        
        if (!preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
            return new WP_Error('invalid_auth_format', 'Invalid authorization format', array('status' => 401));
        }
        
        $token = $matches[1];
        
        // Validate JWT token (simplified - in production use a proper JWT library)
        if (!$this->validate_jwt_token($token)) {
            return new WP_Error('invalid_token', 'Invalid or expired token', array('status' => 401));
        }
        
        return true;
    }
    
    public function check_auth_permissions() {
        return current_user_can('manage_options');
    }
    
    public function generate_jwt_token($request) {
        $params = $request->get_json_params();
        $expires_in = isset($params['expires_in']) ? intval($params['expires_in']) : 3600; // 1 hour default
        
        // Generate token (simplified - use proper JWT library in production)
        $payload = array(
            'user_id' => get_current_user_id(),
            'site_url' => get_site_url(),
            'issued_at' => time(),
            'expires_at' => time() + $expires_in
        );
        
        $token = base64_encode(json_encode($payload)) . '.' . hash_hmac('sha256', base64_encode(json_encode($payload)), $this->jwt_secret);
        
        return array(
            'token' => $token,
            'expires_in' => $expires_in,
            'token_type' => 'Bearer'
        );
    }
    
    private function validate_jwt_token($token) {
        $parts = explode('.', $token);
        
        if (count($parts) !== 2) {
            return false;
        }
        
        $payload_encoded = $parts[0];
        $signature = $parts[1];
        
        // Verify signature
        $expected_signature = hash_hmac('sha256', $payload_encoded, $this->jwt_secret);
        
        if (!hash_equals($expected_signature, $signature)) {
            return false;
        }
        
        // Check expiration
        $payload = json_decode(base64_decode($payload_encoded), true);
        
        if (!$payload || !isset($payload['expires_at']) || $payload['expires_at'] < time()) {
            return false;
        }
        
        return true;
    }
    
    private function register_default_tools() {
        // Register the dynamic tool discovery tool FIRST - this reduces token usage by not sending all tools in system message
        $this->register_tool(array(
            'name' => 'get_available_tools',
            'description' => 'Get the complete list of available tools and their schemas. ALWAYS call this first to discover what tools are available before attempting any other operations.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'category' => array(
                        'type' => 'string',
                        'description' => 'Optional category filter (media, posts, pages, users, woocommerce, seo, etc.)',
                        'enum' => array('all', 'media', 'posts', 'pages', 'meta_fields', 'users', 'woocommerce', 'seo', 'repository', 'rest_api', 'site_info', 'dataforseo', 'pagespeed', 'database', 'security')
                    )
                ),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'get_available_tools')
        ));

        // Register Media Tools (from wordpress-mcp)
        $this->register_media_tools();
        
        // Register Custom Post Type Tools (from wordpress-mcp)
        $this->register_custom_post_type_tools();
        
        // Register Pages Tools (from wordpress-mcp)
        $this->register_pages_tools();
        
        // Register Posts Tools (from wordpress-mcp)
        $this->register_posts_tools();
        
        // Register Meta Field Tools
        $this->register_meta_field_tools();
        
        // Register Settings Tools (from wordpress-mcp)
        $this->register_settings_tools();
        
        // Register Site Info Tools (from wordpress-mcp)
        $this->register_site_info_tools();
        
        // Register Users Tools (from wordpress-mcp)
        $this->register_users_tools();
        
        // Register WooCommerce Tools (from wordpress-mcp)
        $this->register_woocommerce_tools();
        
        // Register WordPress.org repository tools
        $this->register_repository_tools();
        
        // Register DataForSEO tools
        $this->register_dataforseo_tools();
        
        // Register PageSpeed Insights tools
        $this->register_pagespeed_tools();
        
        // Register SEO analysis tools
        $this->register_seo_analysis_tools();
        
        // Register Unsplash tools for image search
        $this->register_unsplash_tools();
        
        // Register Database tools
        $this->register_database_tools();

        // Register Security tools
        $this->register_security_tools();
        
        // Register generic REST API tools
        $this->register_rest_api_tools();
        
        // Register resources
        $this->register_default_resources();
    }
    
    private function register_media_tools() {
        // wp_list_media - List WordPress media items with pagination and filtering
        $this->register_tool(array(
            'name' => 'wp_list_media',
            'description' => 'List WordPress media items with pagination and filtering',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'per_page' => array('type' => 'integer', 'description' => 'Number of media items per page'),
                    'page' => array('type' => 'integer', 'description' => 'Page number'),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'media_type' => array('type' => 'string', 'description' => 'Filter by media type (image, video, audio, application)'),
                    'mime_type' => array('type' => 'string', 'description' => 'Filter by MIME type (e.g., image/jpeg, video/mp4)'),
                    'author' => array('type' => 'integer', 'description' => 'Filter by author ID'),
                    'parent' => array('type' => 'integer', 'description' => 'Filter by parent post ID'),
                )
            ),
            'callback' => array($this, 'wp_list_media')
        ));
        
        // wp_get_media - Get a WordPress media item details by ID
        $this->register_tool(array(
            'name' => 'wp_get_media',
            'description' => 'Get a WordPress media item details by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the media item'),
                    'context' => array('type' => 'string', 'description' => 'Request context (view, edit, embed)')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_get_media')
        ));
        
        // wp_get_media_file - Get the actual file content (blob) of a WordPress media item
        $this->register_tool(array(
            'name' => 'wp_get_media_file',
            'description' => 'Get the actual file content (blob) of a WordPress media item',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the media item'),
                    'size' => array('type' => 'string', 'description' => 'Optional. The size of the image to retrieve (thumbnail, medium, large, full). Defaults to full/original size.')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_get_media_file')
        ));
        
        // wp_upload_media - Upload a new media file to WordPress
        $this->register_tool(array(
            'name' => 'wp_upload_media',
            'description' => 'Upload a new media file to WordPress',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'file' => array('type' => 'string', 'description' => 'The file to upload (base64 encoded)'),
                    'title' => array('type' => 'string', 'description' => 'The title of the media item'),
                    'caption' => array('type' => 'string', 'description' => 'The caption of the media item'),
                    'description' => array('type' => 'string', 'description' => 'The description of the media item'),
                    'alt_text' => array('type' => 'string', 'description' => 'The alt text for the media item')
                ),
                'required' => array('file')
            ),
            'callback' => array($this, 'wp_upload_media')
        ));
        
        // wp_update_media - Update a WordPress media item
        $this->register_tool(array(
            'name' => 'wp_update_media',
            'description' => 'Update a WordPress media item',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the media item'),
                    'title' => array('type' => 'string', 'description' => 'The title of the media item'),
                    'caption' => array('type' => 'string', 'description' => 'The caption of the media item'),
                    'description' => array('type' => 'string', 'description' => 'The description of the media item'),
                    'alt_text' => array('type' => 'string', 'description' => 'The alt text for the media item')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_update_media')
        ));
        
        // wp_delete_media - Delete a WordPress media item permanently
        $this->register_tool(array(
            'name' => 'wp_delete_media',
            'description' => 'Delete a WordPress media item permanently (requires force=true)',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the media item'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_delete_media')
        ));
        
        // wp_set_featured_image - Download an image from URL and set it as featured image for a post
        $this->register_tool(array(
            'name' => 'wp_set_featured_image',
            'description' => 'Download an image from URL and set it as featured image for a post or page. Supports both regular images and Unsplash images with proper attribution.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The ID of the post or page to set featured image for'),
                    'image_url' => array('type' => 'string', 'description' => 'The URL of the image to download and set as featured'),
                    'alt_text' => array('type' => 'string', 'description' => 'Alt text for the image'),
                    'title' => array('type' => 'string', 'description' => 'Title for the image'),
                    'unsplash_id' => array('type' => 'string', 'description' => 'Unsplash ID if this is an Unsplash image'),
                    'photographer' => array('type' => 'string', 'description' => 'Photographer name if this is an Unsplash image'),
                    'download_location' => array('type' => 'string', 'description' => 'Unsplash download location URL for tracking (if applicable)')
                ),
                'required' => array('post_id', 'image_url')
            ),
            'callback' => array($this, 'wp_set_featured_image')
        ));
        
        // wp_search_media - Search WordPress media items by title, caption, or description
        $this->register_tool(array(
            'name' => 'wp_search_media',
            'description' => 'Search WordPress media items by title, caption, or description',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in media titles, captions, and descriptions'),
                    'media_type' => array('type' => 'string', 'description' => 'Filter by media type (image, video, audio, application)'),
                    'mime_type' => array('type' => 'string', 'description' => 'Filter by MIME type (e.g., image/jpeg, video/mp4)'),
                    'author' => array('type' => 'integer', 'description' => 'Filter by author ID'),
                    'parent' => array('type' => 'integer', 'description' => 'Filter by parent post ID'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of results per page'),
                    'page' => array('type' => 'integer', 'description' => 'Page number')
                ),
                'required' => array('search')
            ),
            'callback' => array($this, 'wp_search_media')
        ));
    }
    
    private function register_custom_post_type_tools() {
        // Get all registered post types for description
        $post_types = get_post_types(array('public' => true), 'objects');
        $post_type_names = array();
        
        foreach ($post_types as $post_type) {
            $post_type_names[] = strtolower($post_type->labels->name);
        }
        
        $post_types_list = implode(', ', $post_type_names);
        
        // wp_list_post_types - List all available WordPress custom post types
        $this->register_tool(array(
            'name' => 'wp_list_post_types',
            'description' => 'List all available WordPress custom post types',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wp_list_post_types')
        ));
        
        // wp_cpt_search - Search and filter WordPress custom post types
        $this->register_tool(array(
            'name' => 'wp_cpt_search',
            'description' => 'Search and filter WordPress custom post types including ' . $post_types_list . ' with pagination',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_type' => array('type' => 'string', 'description' => 'The custom post type to search'),
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in post titles and content'),
                    'author' => array('type' => 'integer', 'description' => 'Filter by author ID'),
                    'status' => array('type' => 'string', 'description' => 'Filter by post status (publish, draft, pending, etc.)'),
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination (starts from 1)', 'default' => 1),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of posts per page', 'default' => 10)
                ),
                'required' => array('post_type')
            ),
            'callback' => array($this, 'wp_cpt_search')
        ));
        
        // wp_get_cpt - Get a WordPress custom post type by ID
        $this->register_tool(array(
            'name' => 'wp_get_cpt',
            'description' => 'Get a WordPress custom post type by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_type' => array('type' => 'string', 'description' => 'The custom post type to get'),
                    'id' => array('type' => 'integer', 'description' => 'The ID of the post to get')
                ),
                'required' => array('post_type', 'id')
            ),
            'callback' => array($this, 'wp_get_cpt')
        ));
        
        // wp_add_cpt - Add a new WordPress custom post type
        $this->register_tool(array(
            'name' => 'wp_add_cpt',
            'description' => 'Add a new WordPress custom post type',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_type' => array('type' => 'string', 'description' => 'The custom post type to create'),
                    'title' => array('type' => 'string', 'description' => 'The title of the post'),
                    'content' => array('type' => 'string', 'description' => 'The content of the post in a valid Gutenberg block format'),
                    'excerpt' => array('type' => 'string', 'description' => 'The excerpt of the post'),
                    'status' => array('type' => 'string', 'description' => 'The status of the post (publish, draft, pending, etc.)')
                ),
                'required' => array('post_type', 'title', 'content')
            ),
            'callback' => array($this, 'wp_add_cpt')
        ));
        
        // wp_update_cpt - Update a WordPress custom post type by ID
        $this->register_tool(array(
            'name' => 'wp_update_cpt',
            'description' => 'Update a WordPress custom post type by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_type' => array('type' => 'string', 'description' => 'The custom post type to update'),
                    'id' => array('type' => 'integer', 'description' => 'The ID of the post to update'),
                    'title' => array('type' => 'string', 'description' => 'The title of the post'),
                    'content' => array('type' => 'string', 'description' => 'The content of the post in a valid Gutenberg block format'),
                    'excerpt' => array('type' => 'string', 'description' => 'The excerpt of the post'),
                    'status' => array('type' => 'string', 'description' => 'The status of the post (publish, draft, pending, etc.)')
                ),
                'required' => array('post_type', 'id')
            ),
            'callback' => array($this, 'wp_update_cpt')
        ));
        
        // wp_delete_cpt - Delete a WordPress custom post type by ID
        $this->register_tool(array(
            'name' => 'wp_delete_cpt',
            'description' => 'Delete a WordPress custom post type by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_type' => array('type' => 'string', 'description' => 'The custom post type to delete'),
                    'id' => array('type' => 'integer', 'description' => 'The ID of the post to delete')
                ),
                'required' => array('post_type', 'id')
            ),
            'callback' => array($this, 'wp_delete_cpt')
        ));
    }
    
    private function register_pages_tools() {
        // wp_pages_search - Search and filter WordPress pages with pagination
        $this->register_tool(array(
            'name' => 'wp_pages_search',
            'description' => 'Search and filter WordPress pages with pagination',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in page titles and content'),
                    'author' => array('type' => 'integer', 'description' => 'Filter by author ID'),
                    'status' => array('type' => 'string', 'description' => 'Filter by page status (publish, draft, pending, etc.)'),
                    'parent' => array('type' => 'integer', 'description' => 'Filter by parent page ID'),
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination (starts from 1)', 'default' => 1),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of pages per page', 'default' => 10),
                    'orderby' => array('type' => 'string', 'description' => 'Order by: date, title, menu_order, modified'),
                    'order' => array('type' => 'string', 'description' => 'Sort order: asc or desc')
                )
            ),
            'callback' => array($this, 'wp_pages_search')
        ));
        
        // wp_get_page - Get a WordPress page by ID
        $this->register_tool(array(
            'name' => 'wp_get_page',
            'description' => 'Get a WordPress page by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the page to get'),
                    'context' => array('type' => 'string', 'description' => 'Request context (view, edit, embed)')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_get_page')
        ));
        
        // wp_add_page - Add a new WordPress page
        $this->register_tool(array(
            'name' => 'wp_add_page',
            'description' => 'Add a new WordPress page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'title' => array('type' => 'string', 'description' => 'The title of the page'),
                    'content' => array('type' => 'string', 'description' => 'The content of the page in a valid Gutenberg block format'),
                    'excerpt' => array('type' => 'string', 'description' => 'The excerpt of the page'),
                    'parent' => array('type' => 'integer', 'description' => 'The ID of the parent page'),
                    'order' => array('type' => 'integer', 'description' => 'The order of the page in the menu'),
                    'status' => array('type' => 'string', 'description' => 'The status of the page (publish, draft, pending, etc.)'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the page URL'),
                    'template' => array('type' => 'string', 'description' => 'The page template to use')
                ),
                'required' => array('title', 'content')
            ),
            'callback' => array($this, 'wp_add_page')
        ));
        
        // wp_update_page - Update a WordPress page by ID
        $this->register_tool(array(
            'name' => 'wp_update_page',
            'description' => 'Update a WordPress page by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the page to update'),
                    'title' => array('type' => 'string', 'description' => 'The title of the page'),
                    'content' => array('type' => 'string', 'description' => 'The content of the page in a valid Gutenberg block format'),
                    'excerpt' => array('type' => 'string', 'description' => 'The excerpt of the page'),
                    'parent' => array('type' => 'integer', 'description' => 'The ID of the parent page'),
                    'order' => array('type' => 'integer', 'description' => 'The order of the page in the menu'),
                    'status' => array('type' => 'string', 'description' => 'The status of the page (publish, draft, pending, etc.)'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the page URL'),
                    'template' => array('type' => 'string', 'description' => 'The page template to use')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_update_page')
        ));
        
        // wp_delete_page - Delete a WordPress page by ID
        $this->register_tool(array(
            'name' => 'wp_delete_page',
            'description' => 'Delete a WordPress page by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the page to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_delete_page')
        ));
    }
    
    public function register_tool($args) {
        $required_fields = array('name', 'description', 'callback');
        
        foreach ($required_fields as $field) {
            if (!isset($args[$field])) {
                throw new InvalidArgumentException("Tool registration missing required field: {$field}");
            }
        }
        
        $this->registered_tools[$args['name']] = $args;
    }
    
    public function register_resource($args) {
        $required_fields = array('uri', 'name', 'description', 'mimeType', 'callback');
        
        foreach ($required_fields as $field) {
            if (!isset($args[$field])) {
                throw new InvalidArgumentException("Resource registration missing required field: {$field}");
            }
        }
        
        $this->registered_resources[$args['uri']] = $args;
    }
    
    public function register_prompt($args) {
        $required_fields = array('name', 'description', 'messages');
        
        foreach ($required_fields as $field) {
            if (!isset($args[$field])) {
                throw new InvalidArgumentException("Prompt registration missing required field: {$field}");
            }
        }
        
        $this->registered_prompts[$args['name']] = $args;
    }
    
    private function list_tools() {
        $tools = array();
        
        foreach ($this->registered_tools as $name => $tool) {
            $tools[] = array(
                'name' => $name,
                'description' => $tool['description'],
                'inputSchema' => isset($tool['inputSchema']) ? $tool['inputSchema'] : array(
                    'type' => 'object',
                    'properties' => array(),
                    'additionalProperties' => false
                )
            );
        }
        
        return array('tools' => $tools);
    }
    
    private function call_tool($params) {
        if (!isset($params['name'])) {
            throw new Exception('Tool name required');
        }
        
        $tool_name = $params['name'];
        $arguments = isset($params['arguments']) ? $params['arguments'] : array();
        
        if (!isset($this->registered_tools[$tool_name])) {
            throw new Exception('Tool not found: ' . $tool_name);
        }
        
        $tool = $this->registered_tools[$tool_name];
        $callback = $tool['callback'];
        
        if (!is_callable($callback)) {
            throw new Exception('Tool callback not callable: ' . $tool_name);
        }
        
        try {
            $result = call_user_func($callback, $arguments);
            
            return array(
                'content' => array(
                    array(
                        'type' => 'text',
                        'text' => is_string($result) ? $result : json_encode($result)
                    )
                )
            );
        } catch (Exception $e) {
            throw new Exception('Tool execution failed: ' . $e->getMessage());
        }
    }
    
    private function list_resources() {
        $resources = array();
        
        foreach ($this->registered_resources as $uri => $resource) {
            $resources[] = array(
                'uri' => $uri,
                'name' => $resource['name'],
                'description' => $resource['description'],
                'mimeType' => $resource['mimeType']
            );
        }
        
        return array('resources' => $resources);
    }
    
    private function read_resource($params) {
        if (!isset($params['uri'])) {
            throw new Exception('Resource URI required');
        }
        
        $uri = $params['uri'];
        
        if (!isset($this->registered_resources[$uri])) {
            throw new Exception('Resource not found: ' . $uri);
        }
        
        $resource = $this->registered_resources[$uri];
        $callback = $resource['callback'];
        
        if (!is_callable($callback)) {
            throw new Exception('Resource callback not callable: ' . $uri);
        }
        
        try {
            $content = call_user_func($callback, $params);
            
            return array(
                'contents' => array(
                    array(
                        'uri' => $uri,
                        'mimeType' => $resource['mimeType'],
                        'text' => is_string($content) ? $content : json_encode($content)
                    )
                )
            );
        } catch (Exception $e) {
            throw new Exception('Resource read failed: ' . $e->getMessage());
        }
    }
    
    private function list_prompts() {
        $prompts = array();
        
        foreach ($this->registered_prompts as $name => $prompt) {
            $prompts[] = array(
                'name' => $name,
                'description' => $prompt['description'],
                'arguments' => isset($prompt['arguments']) ? $prompt['arguments'] : array()
            );
        }
        
        return array('prompts' => $prompts);
    }
    
    private function get_prompt($params) {
        if (!isset($params['name'])) {
            throw new Exception('Prompt name required');
        }
        
        $prompt_name = $params['name'];
        $arguments = isset($params['arguments']) ? $params['arguments'] : array();
        
        if (!isset($this->registered_prompts[$prompt_name])) {
            throw new Exception('Prompt not found: ' . $prompt_name);
        }
        
        $prompt = $this->registered_prompts[$prompt_name];
        $messages = $prompt['messages'];
        
        // Process template variables in messages
        foreach ($messages as &$message) {
            if (isset($message['content']['text'])) {
                $message['content']['text'] = $this->process_template($message['content']['text'], $arguments);
            }
        }
        
        return array(
            'description' => $prompt['description'],
            'messages' => $messages
        );
    }
    
    private function process_template($template, $variables) {
        return preg_replace_callback('/\{\{(\w+)(?:\|default:"([^"]*)")?\}\}/', function($matches) use ($variables) {
            $key = $matches[1];
            $default = isset($matches[2]) ? $matches[2] : '';
            
            return isset($variables[$key]) ? $variables[$key] : $default;
        }, $template);
    }
    
    // Media Tool implementations
    public function wp_list_media($args) {
        $query_args = array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => isset($args['per_page']) ? intval($args['per_page']) : 10,
            'paged' => isset($args['page']) ? intval($args['page']) : 1,
        );
        
        if (isset($args['search']) && !empty($args['search'])) {
            $query_args['s'] = sanitize_text_field($args['search']);
        }
        
        if (isset($args['media_type']) && !empty($args['media_type'])) {
            $query_args['post_mime_type'] = sanitize_text_field($args['media_type']);
        }
        
        if (isset($args['mime_type']) && !empty($args['mime_type'])) {
            $query_args['post_mime_type'] = sanitize_text_field($args['mime_type']);
        }
        
        if (isset($args['author'])) {
            $query_args['author'] = intval($args['author']);
        }
        
        if (isset($args['parent'])) {
            $query_args['post_parent'] = intval($args['parent']);
        }
        
        $query = new WP_Query($query_args);
        $media_items = array();
        
        foreach ($query->posts as $attachment) {
            $media_items[] = array(
                'id' => $attachment->ID,
                'title' => $attachment->post_title,
                'caption' => $attachment->post_excerpt,
                'description' => $attachment->post_content,
                'alt_text' => get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
                'mime_type' => $attachment->post_mime_type,
                'url' => wp_get_attachment_url($attachment->ID),
                'date' => $attachment->post_date,
                'modified' => $attachment->post_modified,
                'author' => get_the_author_meta('display_name', $attachment->post_author),
                'parent' => $attachment->post_parent,
                'metadata' => wp_get_attachment_metadata($attachment->ID)
            );
        }
        
        return array(
            'media' => $media_items,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'current_page' => $query_args['paged']
        );
    }
    
    public function wp_get_media($args) {
        $id = intval($args['id']);
        $attachment = get_post($id);
        
        if (!$attachment || $attachment->post_type !== 'attachment') {
            throw new Exception('Media item not found: ' . $id);
        }
        
        return array(
            'id' => $attachment->ID,
            'title' => $attachment->post_title,
            'caption' => $attachment->post_excerpt,
            'description' => $attachment->post_content,
            'alt_text' => get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
            'mime_type' => $attachment->post_mime_type,
            'url' => wp_get_attachment_url($attachment->ID),
            'date' => $attachment->post_date,
            'modified' => $attachment->post_modified,
            'author' => get_the_author_meta('display_name', $attachment->post_author),
            'parent' => $attachment->post_parent,
            'metadata' => wp_get_attachment_metadata($attachment->ID),
            'sizes' => $this->get_attachment_sizes($attachment->ID)
        );
    }
    
    public function wp_get_media_file($args) {
        $id = intval($args['id']);
        $size = isset($args['size']) ? sanitize_text_field($args['size']) : 'full';
        
        if (!$id) {
            throw new Exception('Invalid media ID');
        }
        
        $file_path = get_attached_file($id);
        if (!file_exists($file_path)) {
            throw new Exception('File not found');
        }
        
        if ($size !== 'full' && $size !== 'original') {
            $meta = wp_get_attachment_metadata($id);
            if (isset($meta['sizes'][$size]['file'])) {
                $base_dir = pathinfo($file_path, PATHINFO_DIRNAME);
                $file_path = $base_dir . '/' . $meta['sizes'][$size]['file'];
            }
        }
        
        if (!file_exists($file_path)) {
            throw new Exception('Requested size not found');
        }
        
        $mime_type = get_post_mime_type($id);
        $file_data = file_get_contents($file_path);
        
        return array(
            'file_data' => base64_encode($file_data),
            'mime_type' => $mime_type,
            'size' => $size,
            'file_size' => filesize($file_path)
        );
    }
    
    public function wp_upload_media($args) {
        if (!current_user_can('upload_files')) {
            throw new Exception('Insufficient permissions to upload files');
        }
        
        if (!isset($args['file'])) {
            throw new Exception('File data is required');
        }
        
        // Process base64 file data
        $base64_data = $args['file'];
        
        // Remove data URI prefix if present
        if (strpos($base64_data, 'data:') === 0) {
            $base64_data = preg_replace('/^data:.*?;base64,/', '', $base64_data);
        }
        
        // Decode the base64 data
        $file_data = base64_decode($base64_data, true);
        if ($file_data === false) {
            throw new Exception('Invalid base64 data');
        }
        
        // Determine file type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime_type = finfo_buffer($finfo, $file_data);
        finfo_close($finfo);
        
        if (empty($mime_type)) {
            throw new Exception('Could not determine file type');
        }
        
        // Generate filename
        $filename = isset($args['title']) ? sanitize_file_name($args['title']) : 'upload';
        $filename .= '.' . $this->get_extension_from_mime_type($mime_type);
        
        // Upload the file
        $upload_dir = wp_upload_dir();
        $file_path = $upload_dir['path'] . '/' . $filename;
        
        if (file_put_contents($file_path, $file_data) === false) {
            throw new Exception('Failed to save file');
        }
        
        // Create attachment
        $attachment_data = array(
            'post_mime_type' => $mime_type,
            'post_title' => isset($args['title']) ? sanitize_text_field($args['title']) : '',
            'post_content' => isset($args['description']) ? sanitize_textarea_field($args['description']) : '',
            'post_excerpt' => isset($args['caption']) ? sanitize_textarea_field($args['caption']) : '',
            'post_status' => 'inherit'
        );
        
        $attachment_id = wp_insert_attachment($attachment_data, $file_path);
        
        if (is_wp_error($attachment_id)) {
            throw new Exception('Failed to create attachment: ' . $attachment_id->get_error_message());
        }
        
        // Set alt text
        if (isset($args['alt_text'])) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($args['alt_text']));
        }
        
        // Generate metadata
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $metadata = wp_generate_attachment_metadata($attachment_id, $file_path);
        wp_update_attachment_metadata($attachment_id, $metadata);
        
        return array(
            'id' => $attachment_id,
            'url' => wp_get_attachment_url($attachment_id),
            'title' => get_the_title($attachment_id),
            'mime_type' => $mime_type
        );
    }
    
    public function wp_update_media($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to update media');
        }
        
        $id = intval($args['id']);
        $attachment = get_post($id);
        
        if (!$attachment || $attachment->post_type !== 'attachment') {
            throw new Exception('Media item not found: ' . $id);
        }
        
        $update_data = array('ID' => $id);
        
        if (isset($args['title'])) {
            $update_data['post_title'] = sanitize_text_field($args['title']);
        }
        
        if (isset($args['caption'])) {
            $update_data['post_excerpt'] = sanitize_textarea_field($args['caption']);
        }
        
        if (isset($args['description'])) {
            $update_data['post_content'] = sanitize_textarea_field($args['description']);
        }
        
        $result = wp_update_post($update_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update media: ' . $result->get_error_message());
        }
        
        // Update alt text
        if (isset($args['alt_text'])) {
            update_post_meta($id, '_wp_attachment_image_alt', sanitize_text_field($args['alt_text']));
        }
        
        return array(
            'id' => $id,
            'title' => get_the_title($id),
            'url' => wp_get_attachment_url($id)
        );
    }
    
    public function wp_delete_media($args) {
        if (!current_user_can('delete_posts')) {
            throw new Exception('Insufficient permissions to delete media');
        }
        
        $id = intval($args['id']);
        $force = isset($args['force']) ? (bool) $args['force'] : false;
        
        $attachment = get_post($id);
        if (!$attachment || $attachment->post_type !== 'attachment') {
            throw new Exception('Media item not found: ' . $id);
        }
        
        $result = wp_delete_attachment($id, $force);
        
        if ($result === false) {
            throw new Exception('Failed to delete media item');
        }
        
        return array(
            'id' => $id,
            'deleted' => true,
            'force' => $force
        );
    }
    
    public function wp_search_media($args) {
        $search_term = sanitize_text_field($args['search']);
        
        $query_args = array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            's' => $search_term,
            'posts_per_page' => isset($args['per_page']) ? intval($args['per_page']) : 10,
            'paged' => isset($args['page']) ? intval($args['page']) : 1,
        );
        
        if (isset($args['media_type']) && !empty($args['media_type'])) {
            $query_args['post_mime_type'] = sanitize_text_field($args['media_type']);
        }
        
        if (isset($args['mime_type']) && !empty($args['mime_type'])) {
            $query_args['post_mime_type'] = sanitize_text_field($args['mime_type']);
        }
        
        if (isset($args['author'])) {
            $query_args['author'] = intval($args['author']);
        }
        
        if (isset($args['parent'])) {
            $query_args['post_parent'] = intval($args['parent']);
        }
        
        $query = new WP_Query($query_args);
        $media_items = array();
        
        foreach ($query->posts as $attachment) {
            $media_items[] = array(
                'id' => $attachment->ID,
                'title' => $attachment->post_title,
                'caption' => $attachment->post_excerpt,
                'description' => $attachment->post_content,
                'alt_text' => get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
                'mime_type' => $attachment->post_mime_type,
                'url' => wp_get_attachment_url($attachment->ID),
                'date' => $attachment->post_date,
                'author' => get_the_author_meta('display_name', $attachment->post_author)
            );
        }
        
        return array(
            'media' => $media_items,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'current_page' => $query_args['paged'],
            'search_term' => $search_term
        );
    }
    
    public function wp_set_featured_image($args) {
        $post_id = intval($args['post_id']);
        $image_url = esc_url_raw($args['image_url']);
        $alt_text = sanitize_text_field($args['alt_text'] ?? '');
        $title = sanitize_text_field($args['title'] ?? $alt_text ?: 'AI Generated Image');
        $unsplash_id = sanitize_text_field($args['unsplash_id'] ?? '');
        $photographer = sanitize_text_field($args['photographer'] ?? '');
        $download_location = esc_url_raw($args['download_location'] ?? '');
        
        if (empty($post_id) || empty($image_url)) {
            throw new Exception('Post ID and image URL are required');
        }
        
        // Check if post exists and user has permission to edit it
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception('Post not found');
        }
        
        if (!current_user_can('edit_post', $post_id)) {
            throw new Exception('You do not have permission to edit this post');
        }
        
        // Use the AI_Provider method to handle the featured image setting
        if ($this->ai_provider) {
            $request_data = array(
                'image_url' => $image_url,
                'download_location' => $download_location,
                'alt' => $alt_text,
                'title' => $title,
                'unsplash_id' => $unsplash_id,
                'photographer' => $photographer,
                'post_id' => $post_id
            );
            
            // Create a mock request object
            $mock_request = new class($request_data) {
                private $data;
                public function __construct($data) {
                    $this->data = $data;
                }
                public function get_json_params() {
                    return $this->data;
                }
            };
            
            $result = $this->ai_provider->save_as_featured_image($mock_request);
            
            if (is_wp_error($result)) {
                throw new Exception($result->get_error_message());
            }
            
            return $result;
        } else {
            throw new Exception('AI Provider not available');
        }
    }
    
    // Custom Post Type Tool implementations
    public function wp_list_post_types($args) {
        $post_types = get_post_types(array('public' => true), 'objects');
        $formatted_types = array();
        
        foreach ($post_types as $post_type) {
            $formatted_types[] = array(
                'name' => $post_type->name,
                'label' => $post_type->label,
                'labels' => $post_type->labels,
                'description' => $post_type->description,
                'public' => $post_type->public,
                'hierarchical' => $post_type->hierarchical,
                'supports' => get_all_post_type_supports($post_type->name),
                'taxonomies' => get_object_taxonomies($post_type->name),
                'rest_base' => $post_type->rest_base,
                'rest_namespace' => $post_type->rest_namespace
            );
        }
        
        return array(
            'post_types' => $formatted_types,
            'total' => count($formatted_types)
        );
    }
    
    public function wp_cpt_search($args) {
        $post_type = sanitize_text_field($args['post_type']);
        $page = isset($args['page']) ? max(1, intval($args['page'])) : 1;
        $per_page = isset($args['per_page']) ? max(1, intval($args['per_page'])) : 10;
        
        // Verify post type exists
        if (!post_type_exists($post_type)) {
            throw new Exception('Post type does not exist: ' . $post_type);
        }
        
        $query_args = array(
            'post_type' => $post_type,
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish'
        );
        
        if (!empty($args['search'])) {
            $query_args['s'] = sanitize_text_field($args['search']);
        }
        
        if (!empty($args['author'])) {
            $query_args['author'] = intval($args['author']);
        }
        
        if (!empty($args['status'])) {
            $query_args['post_status'] = sanitize_text_field($args['status']);
        }
        
        $query = new WP_Query($query_args);
        $posts = array();
        
        foreach ($query->posts as $post) {
            $posts[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'modified' => $post->post_modified,
                'author' => get_the_author_meta('display_name', $post->post_author),
                'permalink' => get_permalink($post->ID),
                'edit_link' => get_edit_post_link($post->ID, 'raw'),
                'post_type' => $post->post_type
            );
        }
        
        return array(
            'results' => $posts,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'page' => $page,
            'per_page' => $per_page,
            'post_type' => $post_type
        );
    }
    
    public function wp_get_cpt($args) {
        $post_type = sanitize_text_field($args['post_type']);
        $id = intval($args['id']);
        
        $post = get_post($id);
        
        if (!$post || $post->post_type !== $post_type) {
            throw new Exception('Post not found or post type mismatch');
        }
        
        return array(
            'results' => array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'modified' => $post->post_modified,
                'author' => get_the_author_meta('display_name', $post->post_author),
                'permalink' => get_permalink($post->ID),
                'edit_link' => get_edit_post_link($post->ID, 'raw'),
                'post_type' => $post->post_type,
                'meta' => get_post_meta($post->ID)
            )
        );
    }
    
    public function wp_add_cpt($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to create posts');
        }
        
        $post_type = sanitize_text_field($args['post_type']);
        
        // Verify post type exists
        if (!post_type_exists($post_type)) {
            throw new Exception('Post type does not exist: ' . $post_type);
        }
        
        $post_data = array(
            'post_type' => $post_type,
            'post_title' => sanitize_text_field($args['title']),
            'post_content' => wp_kses_post($args['content']),
            'post_status' => 'draft'
        );
        
        if (!empty($args['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
        }
        
        if (!empty($args['status'])) {
            $post_data['post_status'] = sanitize_text_field($args['status']);
        }
        
        $post_id = wp_insert_post($post_data);
        
        if (is_wp_error($post_id)) {
            throw new Exception('Failed to create post: ' . $post_id->get_error_message());
        }
        
        $post = get_post($post_id);
        
        return array(
            'results' => array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'permalink' => get_permalink($post->ID),
                'edit_link' => get_edit_post_link($post->ID, 'raw'),
                'post_type' => $post->post_type
            )
        );
    }
    
    public function wp_update_cpt($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to update posts');
        }
        
        $post_type = sanitize_text_field($args['post_type']);
        $id = intval($args['id']);
        
        $post = get_post($id);
        
        if (!$post || $post->post_type !== $post_type) {
            throw new Exception('Post not found or post type mismatch');
        }
        
        $post_data = array('ID' => $id);
        
        if (!empty($args['title'])) {
            $post_data['post_title'] = sanitize_text_field($args['title']);
        }
        
        if (!empty($args['content'])) {
            $post_data['post_content'] = wp_kses_post($args['content']);
        }
        
        if (!empty($args['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
        }
        
        if (!empty($args['status'])) {
            $post_data['post_status'] = sanitize_text_field($args['status']);
        }
        
        $result = wp_update_post($post_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update post: ' . $result->get_error_message());
        }
        
        $updated_post = get_post($id);
        
        return array(
            'results' => array(
                'id' => $updated_post->ID,
                'title' => $updated_post->post_title,
                'content' => $updated_post->post_content,
                'excerpt' => $updated_post->post_excerpt,
                'status' => $updated_post->post_status,
                'date' => $updated_post->post_date,
                'modified' => $updated_post->post_modified,
                'permalink' => get_permalink($updated_post->ID),
                'edit_link' => get_edit_post_link($updated_post->ID, 'raw'),
                'post_type' => $updated_post->post_type
            )
        );
    }
    
    public function wp_delete_cpt($args) {
        if (!current_user_can('delete_posts')) {
            throw new Exception('Insufficient permissions to delete posts');
        }
        
        $post_type = sanitize_text_field($args['post_type']);
        $id = intval($args['id']);
        
        $post = get_post($id);
        
        if (!$post || $post->post_type !== $post_type) {
            throw new Exception('Post not found or post type mismatch');
        }
        
        $result = wp_delete_post($id, true);
        
        if (!$result) {
            throw new Exception('Failed to delete post');
        }
        
        return array(
            'results' => true,
            'deleted_id' => $id,
            'post_type' => $post_type
        );
    }
    
    // Pages Tool implementations
    public function wp_pages_search($args) {
        $page = isset($args['page']) ? max(1, intval($args['page'])) : 1;
        $per_page = isset($args['per_page']) ? max(1, intval($args['per_page'])) : 10;
        
        $query_args = array(
            'post_type' => 'page',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish'
        );
        
        if (!empty($args['search'])) {
            $query_args['s'] = sanitize_text_field($args['search']);
        }
        
        if (!empty($args['author'])) {
            $query_args['author'] = intval($args['author']);
        }
        
        if (!empty($args['status'])) {
            $query_args['post_status'] = sanitize_text_field($args['status']);
        }
        
        if (isset($args['parent'])) {
            $query_args['post_parent'] = intval($args['parent']);
        }
        
        if (!empty($args['orderby'])) {
            $query_args['orderby'] = sanitize_text_field($args['orderby']);
        }
        
        if (!empty($args['order'])) {
            $query_args['order'] = sanitize_text_field($args['order']);
        }
        
        $query = new WP_Query($query_args);
        $pages = array();
        
        foreach ($query->posts as $post) {
            $pages[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'modified' => $post->post_modified,
                'author' => get_the_author_meta('display_name', $post->post_author),
                'permalink' => get_permalink($post->ID),
                'edit_link' => get_edit_post_link($post->ID, 'raw'),
                'parent' => $post->post_parent,
                'menu_order' => $post->menu_order,
                'slug' => $post->post_name,
                'template' => get_page_template_slug($post->ID)
            );
        }
        
        return array(
            'pages' => $pages,
            'total' => $query->found_posts,
            'pages_count' => $query->max_num_pages,
            'current_page' => $page,
            'per_page' => $per_page
        );
    }
    
    public function wp_get_page($args) {
        $id = intval($args['id']);
        
        $page = get_post($id);
        
        if (!$page || $page->post_type !== 'page') {
            throw new Exception('Page not found: ' . $id);
        }
        
        return array(
            'id' => $page->ID,
            'title' => $page->post_title,
            'content' => $page->post_content,
            'excerpt' => $page->post_excerpt,
            'status' => $page->post_status,
            'date' => $page->post_date,
            'modified' => $page->post_modified,
            'author' => get_the_author_meta('display_name', $page->post_author),
            'permalink' => get_permalink($page->ID),
            'edit_link' => get_edit_post_link($page->ID, 'raw'),
            'parent' => $page->post_parent,
            'menu_order' => $page->menu_order,
            'slug' => $page->post_name,
            'template' => get_page_template_slug($page->ID),
            'meta' => get_post_meta($page->ID),
            'featured_media' => get_post_thumbnail_id($page->ID),
            'children' => get_children(array(
                'post_parent' => $page->ID,
                'post_type' => 'page',
                'post_status' => 'publish',
                'fields' => 'ids'
            ))
        );
    }
    
    public function wp_add_page($args) {
        if (!current_user_can('edit_pages')) {
            throw new Exception('Insufficient permissions to create pages');
        }
        
        $page_data = array(
            'post_type' => 'page',
            'post_title' => sanitize_text_field($args['title']),
            'post_content' => wp_kses_post($args['content']),
            'post_status' => 'draft'
        );
        
        if (!empty($args['excerpt'])) {
            $page_data['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
        }
        
        if (isset($args['parent'])) {
            $page_data['post_parent'] = intval($args['parent']);
        }
        
        if (isset($args['order'])) {
            $page_data['menu_order'] = intval($args['order']);
        }
        
        if (!empty($args['status'])) {
            $page_data['post_status'] = sanitize_text_field($args['status']);
        }
        
        if (!empty($args['slug'])) {
            $page_data['post_name'] = sanitize_title($args['slug']);
        }
        
        $page_id = wp_insert_post($page_data);
        
        if (is_wp_error($page_id)) {
            throw new Exception('Failed to create page: ' . $page_id->get_error_message());
        }
        
        // Set page template if specified
        if (!empty($args['template'])) {
            update_post_meta($page_id, '_wp_page_template', sanitize_text_field($args['template']));
        }
        
        $page = get_post($page_id);
        
        return array(
            'id' => $page->ID,
            'title' => $page->post_title,
            'content' => $page->post_content,
            'excerpt' => $page->post_excerpt,
            'status' => $page->post_status,
            'date' => $page->post_date,
            'permalink' => get_permalink($page->ID),
            'edit_link' => get_edit_post_link($page->ID, 'raw'),
            'parent' => $page->post_parent,
            'menu_order' => $page->menu_order,
            'slug' => $page->post_name,
            'template' => get_page_template_slug($page->ID)
        );
    }
    
    public function wp_update_page($args) {
        if (!current_user_can('edit_pages')) {
            throw new Exception('Insufficient permissions to update pages');
        }
        
        $id = intval($args['id']);
        
        $page = get_post($id);
        
        if (!$page || $page->post_type !== 'page') {
            throw new Exception('Page not found: ' . $id);
        }
        
        $page_data = array('ID' => $id);
        
        if (!empty($args['title'])) {
            $page_data['post_title'] = sanitize_text_field($args['title']);
        }
        
        if (!empty($args['content'])) {
            $page_data['post_content'] = wp_kses_post($args['content']);
        }
        
        if (!empty($args['excerpt'])) {
            $page_data['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
        }
        
        if (isset($args['parent'])) {
            $page_data['post_parent'] = intval($args['parent']);
        }
        
        if (isset($args['order'])) {
            $page_data['menu_order'] = intval($args['order']);
        }
        
        if (!empty($args['status'])) {
            $page_data['post_status'] = sanitize_text_field($args['status']);
        }
        
        if (!empty($args['slug'])) {
            $page_data['post_name'] = sanitize_title($args['slug']);
        }
        
        $result = wp_update_post($page_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update page: ' . $result->get_error_message());
        }
        
        // Update page template if specified
        if (!empty($args['template'])) {
            update_post_meta($id, '_wp_page_template', sanitize_text_field($args['template']));
        }
        
        $updated_page = get_post($id);
        
        return array(
            'id' => $updated_page->ID,
            'title' => $updated_page->post_title,
            'content' => $updated_page->post_content,
            'excerpt' => $updated_page->post_excerpt,
            'status' => $updated_page->post_status,
            'date' => $updated_page->post_date,
            'modified' => $updated_page->post_modified,
            'permalink' => get_permalink($updated_page->ID),
            'edit_link' => get_edit_post_link($updated_page->ID, 'raw'),
            'parent' => $updated_page->post_parent,
            'menu_order' => $updated_page->menu_order,
            'slug' => $updated_page->post_name,
            'template' => get_page_template_slug($updated_page->ID)
        );
    }
    
    
    public function wp_delete_page($args) {
        if (!current_user_can('delete_pages')) {
            throw new Exception('Insufficient permissions to delete pages');
        }
        
        $id = intval($args['id']);
        $force = isset($args['force']) ? (bool) $args['force'] : false;
        
        $page = get_post($id);
        
        if (!$page || $page->post_type !== 'page') {
            throw new Exception('Page not found: ' . $id);
        }
        
        $result = wp_delete_post($id, $force);
        
        if (!$result) {
            throw new Exception('Failed to delete page');
        }
        
        return array(
            'deleted' => true,
            'id' => $id,
            'force' => $force
        );
    }
    
    private function register_posts_tools() {
        // wp_posts_search - Search and filter WordPress posts with pagination
        $this->register_tool(array(
            'name' => 'wp_posts_search',
            'description' => 'Search and filter WordPress posts with pagination',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in post titles and content'),
                    'author' => array('type' => 'integer', 'description' => 'Filter by author ID'),
                    'status' => array('type' => 'string', 'description' => 'Filter by post status (publish, draft, pending, etc.)'),
                    'categories' => array('type' => 'string', 'description' => 'Filter by category IDs (comma-separated)'),
                    'tags' => array('type' => 'string', 'description' => 'Filter by tag IDs (comma-separated)'),
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination (starts from 1)', 'default' => 1),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of posts per page', 'default' => 10),
                    'orderby' => array('type' => 'string', 'description' => 'Order by: date, title, modified, menu_order'),
                    'order' => array('type' => 'string', 'description' => 'Sort order: asc or desc')
                )
            ),
            'callback' => array($this, 'wp_posts_search')
        ));
        
        // wp_get_post - Get a WordPress post by ID
        $this->register_tool(array(
            'name' => 'wp_get_post',
            'description' => 'Get a WordPress post by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the post to get'),
                    'context' => array('type' => 'string', 'description' => 'Request context (view, edit, embed)')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_get_post')
        ));
        
        // wp_add_post - Add a new WordPress post
        $this->register_tool(array(
            'name' => 'wp_add_post',
            'description' => 'Add a new WordPress post',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'title' => array('type' => 'string', 'description' => 'The title of the post'),
                    'content' => array('type' => 'string', 'description' => 'The content of the post in a valid Gutenberg block format'),
                    'excerpt' => array('type' => 'string', 'description' => 'The excerpt of the post'),
                    'status' => array('type' => 'string', 'description' => 'The status of the post (publish, draft, pending, etc.)'),
                    'categories' => array('type' => 'array', 'description' => 'Array of category IDs', 'items' => array('type' => 'integer')),
                    'tags' => array('type' => 'array', 'description' => 'Array of tag IDs', 'items' => array('type' => 'integer')),
                    'featured_media' => array('type' => 'integer', 'description' => 'Featured image ID'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the post URL')
                ),
                'required' => array('title', 'content')
            ),
            'callback' => array($this, 'wp_add_post')
        ));
        
        // wp_update_post - Update a WordPress post by ID
        $this->register_tool(array(
            'name' => 'wp_update_post',
            'description' => 'Update a WordPress post by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the post to update'),
                    'title' => array('type' => 'string', 'description' => 'The title of the post'),
                    'content' => array('type' => 'string', 'description' => 'The content of the post in a valid Gutenberg block format'),
                    'excerpt' => array('type' => 'string', 'description' => 'The excerpt of the post'),
                    'status' => array('type' => 'string', 'description' => 'The status of the post (publish, draft, pending, etc.)'),
                    'categories' => array('type' => 'array', 'description' => 'Array of category IDs', 'items' => array('type' => 'integer')),
                    'tags' => array('type' => 'array', 'description' => 'Array of tag IDs', 'items' => array('type' => 'integer')),
                    'featured_media' => array('type' => 'integer', 'description' => 'Featured image ID'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the post URL')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_update_post')
        ));
        
        // wp_delete_post - Delete a WordPress post by ID
        $this->register_tool(array(
            'name' => 'wp_delete_post',
            'description' => 'Delete a WordPress post by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the post to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_delete_post')
        ));
        
        // wp_list_categories - List all WordPress post categories
        $this->register_tool(array(
            'name' => 'wp_list_categories',
            'description' => 'List all WordPress post categories',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'per_page' => array('type' => 'integer', 'description' => 'Number of categories per page'),
                    'page' => array('type' => 'integer', 'description' => 'Page number'),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'hide_empty' => array('type' => 'boolean', 'description' => 'Hide categories with no posts')
                )
            ),
            'callback' => array($this, 'wp_list_categories')
        ));
        
        // wp_add_category - Add a new WordPress post category
        $this->register_tool(array(
            'name' => 'wp_add_category',
            'description' => 'Add a new WordPress post category',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'name' => array('type' => 'string', 'description' => 'The name of the category'),
                    'description' => array('type' => 'string', 'description' => 'The description of the category'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the category'),
                    'parent' => array('type' => 'integer', 'description' => 'The ID of the parent category')
                ),
                'required' => array('name')
            ),
            'callback' => array($this, 'wp_add_category')
        ));
        
        // wp_update_category - Update a WordPress post category
        $this->register_tool(array(
            'name' => 'wp_update_category',
            'description' => 'Update a WordPress post category',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the category to update'),
                    'name' => array('type' => 'string', 'description' => 'The name of the category'),
                    'description' => array('type' => 'string', 'description' => 'The description of the category'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the category'),
                    'parent' => array('type' => 'integer', 'description' => 'The ID of the parent category')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_update_category')
        ));
        
        // wp_delete_category - Delete a WordPress post category
        $this->register_tool(array(
            'name' => 'wp_delete_category',
            'description' => 'Delete a WordPress post category',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the category to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_delete_category')
        ));
        
        // wp_list_tags - List all WordPress post tags
        $this->register_tool(array(
            'name' => 'wp_list_tags',
            'description' => 'List all WordPress post tags',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'per_page' => array('type' => 'integer', 'description' => 'Number of tags per page'),
                    'page' => array('type' => 'integer', 'description' => 'Page number'),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'hide_empty' => array('type' => 'boolean', 'description' => 'Hide tags with no posts')
                )
            ),
            'callback' => array($this, 'wp_list_tags')
        ));
        
        // wp_add_tag - Add a new WordPress post tag
        $this->register_tool(array(
            'name' => 'wp_add_tag',
            'description' => 'Add a new WordPress post tag',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'name' => array('type' => 'string', 'description' => 'The name of the tag'),
                    'description' => array('type' => 'string', 'description' => 'The description of the tag'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the tag')
                ),
                'required' => array('name')
            ),
            'callback' => array($this, 'wp_add_tag')
        ));
        
        // wp_update_tag - Update a WordPress post tag
        $this->register_tool(array(
            'name' => 'wp_update_tag',
            'description' => 'Update a WordPress post tag',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the tag to update'),
                    'name' => array('type' => 'string', 'description' => 'The name of the tag'),
                    'description' => array('type' => 'string', 'description' => 'The description of the tag'),
                    'slug' => array('type' => 'string', 'description' => 'The slug for the tag')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_update_tag')
        ));
        
        // wp_delete_tag - Delete a WordPress post tag
        $this->register_tool(array(
            'name' => 'wp_delete_tag',
            'description' => 'Delete a WordPress post tag',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the tag to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_delete_tag')
        ));
    }
    
    // Posts Tool implementations
    public function wp_posts_search($args) {
        $page = isset($args['page']) ? max(1, intval($args['page'])) : 1;
        $per_page = isset($args['per_page']) ? max(1, intval($args['per_page'])) : 10;
        
        $query_args = array(
            'post_type' => 'post',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish'
        );
        
        if (!empty($args['search'])) {
            $query_args['s'] = sanitize_text_field($args['search']);
        }
        
        if (!empty($args['author'])) {
            $query_args['author'] = intval($args['author']);
        }
        
        if (!empty($args['status'])) {
            $query_args['post_status'] = sanitize_text_field($args['status']);
        }
        
        if (!empty($args['categories'])) {
            $query_args['category__in'] = array_map('intval', explode(',', $args['categories']));
        }
        
        if (!empty($args['tags'])) {
            $query_args['tag__in'] = array_map('intval', explode(',', $args['tags']));
        }
        
        if (!empty($args['orderby'])) {
            $query_args['orderby'] = sanitize_text_field($args['orderby']);
        }
        
        if (!empty($args['order'])) {
            $query_args['order'] = sanitize_text_field($args['order']);
        }
        
        $query = new WP_Query($query_args);
        $posts = array();
        
        foreach ($query->posts as $post) {
            $categories = get_the_category($post->ID);
            $tags = get_the_tags($post->ID);
            
            $posts[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'modified' => $post->post_modified,
                'author' => get_the_author_meta('display_name', $post->post_author),
                'permalink' => get_permalink($post->ID),
                'edit_link' => get_edit_post_link($post->ID, 'raw'),
                'featured_media' => get_post_thumbnail_id($post->ID),
                'categories' => $categories ? array_map(function($cat) { return array('id' => $cat->term_id, 'name' => $cat->name, 'slug' => $cat->slug); }, $categories) : array(),
                'tags' => $tags ? array_map(function($tag) { return array('id' => $tag->term_id, 'name' => $tag->name, 'slug' => $tag->slug); }, $tags) : array()
            );
        }
        
        return array(
            'posts' => $posts,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'current_page' => $page,
            'per_page' => $per_page
        );
    }
    
    public function wp_get_post($args) {
        $id = intval($args['id']);
        
        $post = get_post($id);
        
        if (!$post || $post->post_type !== 'post') {
            throw new Exception('Post not found: ' . $id);
        }
        
        $categories = get_the_category($post->ID);
        $tags = get_the_tags($post->ID);
        
        return array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'status' => $post->post_status,
            'date' => $post->post_date,
            'modified' => $post->post_modified,
            'author' => get_the_author_meta('display_name', $post->post_author),
            'permalink' => get_permalink($post->ID),
            'edit_link' => get_edit_post_link($post->ID, 'raw'),
            'featured_media' => get_post_thumbnail_id($post->ID),
            'slug' => $post->post_name,
            'categories' => $categories ? array_map(function($cat) { return array('id' => $cat->term_id, 'name' => $cat->name, 'slug' => $cat->slug); }, $categories) : array(),
            'tags' => $tags ? array_map(function($tag) { return array('id' => $tag->term_id, 'name' => $tag->name, 'slug' => $tag->slug); }, $tags) : array(),
            'meta' => get_post_meta($post->ID)
        );
    }
    
    public function wp_add_post($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to create posts');
        }
        
        $post_data = array(
            'post_type' => 'post',
            'post_title' => sanitize_text_field($args['title']),
            'post_content' => wp_kses_post($args['content']),
            'post_status' => 'draft'
        );
        
        if (!empty($args['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
        }
        
        if (!empty($args['status'])) {
            $post_data['post_status'] = sanitize_text_field($args['status']);
        }
        
        if (!empty($args['slug'])) {
            $post_data['post_name'] = sanitize_title($args['slug']);
        }
        
        $post_id = wp_insert_post($post_data);
        
        if (is_wp_error($post_id)) {
            throw new Exception('Failed to create post: ' . $post_id->get_error_message());
        }
        
        // Set categories
        if (!empty($args['categories']) && is_array($args['categories'])) {
            wp_set_post_categories($post_id, array_map('intval', $args['categories']));
        }
        
        // Set tags
        if (!empty($args['tags']) && is_array($args['tags'])) {
            wp_set_post_tags($post_id, array_map('intval', $args['tags']));
        }
        
        // Set featured media
        if (!empty($args['featured_media'])) {
            set_post_thumbnail($post_id, intval($args['featured_media']));
        }
        
        $post = get_post($post_id);
        
        return array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'status' => $post->post_status,
            'date' => $post->post_date,
            'permalink' => get_permalink($post->ID),
            'edit_link' => get_edit_post_link($post->ID, 'raw'),
            'featured_media' => get_post_thumbnail_id($post->ID)
        );
    }
    
    public function wp_update_post($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to update posts');
        }
        
        $id = intval($args['id']);
        
        $post = get_post($id);
        
        if (!$post || $post->post_type !== 'post') {
            throw new Exception('Post not found: ' . $id);
        }
        
        $post_data = array('ID' => $id);
        
        if (!empty($args['title'])) {
            $post_data['post_title'] = sanitize_text_field($args['title']);
        }
        
        if (!empty($args['content'])) {
            $post_data['post_content'] = wp_kses_post($args['content']);
        }
        
        if (!empty($args['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
        }
        
        if (!empty($args['status'])) {
            $post_data['post_status'] = sanitize_text_field($args['status']);
        }
        
        if (!empty($args['slug'])) {
            $post_data['post_name'] = sanitize_title($args['slug']);
        }
        
        $result = wp_update_post($post_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update post: ' . $result->get_error_message());
        }
        
        // Update categories
        if (isset($args['categories']) && is_array($args['categories'])) {
            wp_set_post_categories($id, array_map('intval', $args['categories']));
        }
        
        // Update tags
        if (isset($args['tags']) && is_array($args['tags'])) {
            wp_set_post_tags($id, array_map('intval', $args['tags']));
        }
        
        // Update featured media
        if (isset($args['featured_media'])) {
            if (empty($args['featured_media'])) {
                delete_post_thumbnail($id);
            } else {
                set_post_thumbnail($id, intval($args['featured_media']));
            }
        }
        
        $updated_post = get_post($id);
        
        return array(
            'id' => $updated_post->ID,
            'title' => $updated_post->post_title,
            'content' => $updated_post->post_content,
            'excerpt' => $updated_post->post_excerpt,
            'status' => $updated_post->post_status,
            'date' => $updated_post->post_date,
            'modified' => $updated_post->post_modified,
            'permalink' => get_permalink($updated_post->ID),
            'edit_link' => get_edit_post_link($updated_post->ID, 'raw'),
            'featured_media' => get_post_thumbnail_id($updated_post->ID)
        );
    }
    
    public function wp_delete_post($args) {
        if (!current_user_can('delete_posts')) {
            throw new Exception('Insufficient permissions to delete posts');
        }
        
        $id = intval($args['id']);
        $force = isset($args['force']) ? (bool) $args['force'] : false;
        
        $post = get_post($id);
        
        if (!$post || $post->post_type !== 'post') {
            throw new Exception('Post not found: ' . $id);
        }
        
        $result = wp_delete_post($id, $force);
        
        if (!$result) {
            throw new Exception('Failed to delete post');
        }
        
        return array(
            'deleted' => true,
            'id' => $id,
            'force' => $force
        );
    }
    
    // Category Tool implementations
    public function wp_list_categories($args) {
        $query_args = array(
            'taxonomy' => 'category',
            'hide_empty' => isset($args['hide_empty']) ? (bool) $args['hide_empty'] : false,
            'number' => isset($args['per_page']) ? intval($args['per_page']) : 0,
            'offset' => isset($args['page']) ? (intval($args['page']) - 1) * (isset($args['per_page']) ? intval($args['per_page']) : 10) : 0
        );
        
        if (!empty($args['search'])) {
            $query_args['search'] = sanitize_text_field($args['search']);
        }
        
        $categories = get_terms($query_args);
        
        if (is_wp_error($categories)) {
            throw new Exception('Failed to retrieve categories: ' . $categories->get_error_message());
        }
        
        $formatted_categories = array();
        
        foreach ($categories as $category) {
            $formatted_categories[] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'description' => $category->description,
                'count' => $category->count,
                'parent' => $category->parent,
                'link' => get_category_link($category->term_id)
            );
        }
        
        return array(
            'categories' => $formatted_categories,
            'total' => count($formatted_categories)
        );
    }
    
    public function wp_add_category($args) {
        if (!current_user_can('manage_categories')) {
            throw new Exception('Insufficient permissions to create categories');
        }
        
        $category_data = array(
            'cat_name' => sanitize_text_field($args['name'])
        );
        
        if (!empty($args['description'])) {
            $category_data['category_description'] = sanitize_textarea_field($args['description']);
        }
        
        if (!empty($args['slug'])) {
            $category_data['category_nicename'] = sanitize_title($args['slug']);
        }
        
        if (!empty($args['parent'])) {
            $category_data['category_parent'] = intval($args['parent']);
        }
        
        $category_id = wp_insert_category($category_data);
        
        if (is_wp_error($category_id)) {
            throw new Exception('Failed to create category: ' . $category_id->get_error_message());
        }
        
        $category = get_term($category_id, 'category');
        
        return array(
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'parent' => $category->parent,
            'link' => get_category_link($category->term_id)
        );
    }
    
    public function wp_update_category($args) {
        if (!current_user_can('manage_categories')) {
            throw new Exception('Insufficient permissions to update categories');
        }
        
        $id = intval($args['id']);
        
        $category = get_term($id, 'category');
        
        if (!$category || is_wp_error($category)) {
            throw new Exception('Category not found: ' . $id);
        }
        
        $update_data = array();
        
        if (!empty($args['name'])) {
            $update_data['name'] = sanitize_text_field($args['name']);
        }
        
        if (!empty($args['description'])) {
            $update_data['description'] = sanitize_textarea_field($args['description']);
        }
        
        if (!empty($args['slug'])) {
            $update_data['slug'] = sanitize_title($args['slug']);
        }
        
        if (isset($args['parent'])) {
            $update_data['parent'] = intval($args['parent']);
        }
        
        $result = wp_update_term($id, 'category', $update_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update category: ' . $result->get_error_message());
        }
        
        $updated_category = get_term($id, 'category');
        
        return array(
            'id' => $updated_category->term_id,
            'name' => $updated_category->name,
            'slug' => $updated_category->slug,
            'description' => $updated_category->description,
            'parent' => $updated_category->parent,
            'link' => get_category_link($updated_category->term_id)
        );
    }
    
    public function wp_delete_category($args) {
        if (!current_user_can('manage_categories')) {
            throw new Exception('Insufficient permissions to delete categories');
        }
        
        $id = intval($args['id']);
        
        $category = get_term($id, 'category');
        
        if (!$category || is_wp_error($category)) {
            throw new Exception('Category not found: ' . $id);
        }
        
        $result = wp_delete_term($id, 'category');
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to delete category: ' . $result->get_error_message());
        }
        
        return array(
            'deleted' => true,
            'id' => $id
        );
    }
    
    // Tag Tool implementations
    public function wp_list_tags($args) {
        $query_args = array(
            'taxonomy' => 'post_tag',
            'hide_empty' => isset($args['hide_empty']) ? (bool) $args['hide_empty'] : false,
            'number' => isset($args['per_page']) ? intval($args['per_page']) : 0,
            'offset' => isset($args['page']) ? (intval($args['page']) - 1) * (isset($args['per_page']) ? intval($args['per_page']) : 10) : 0
        );
        
        if (!empty($args['search'])) {
            $query_args['search'] = sanitize_text_field($args['search']);
        }
        
        $tags = get_terms($query_args);
        
        if (is_wp_error($tags)) {
            throw new Exception('Failed to retrieve tags: ' . $tags->get_error_message());
        }
        
        $formatted_tags = array();
        
        foreach ($tags as $tag) {
            $formatted_tags[] = array(
                'id' => $tag->term_id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'description' => $tag->description,
                'count' => $tag->count,
                'link' => get_tag_link($tag->term_id)
            );
        }
        
        return array(
            'tags' => $formatted_tags,
            'total' => count($formatted_tags)
        );
    }
    
    public function wp_add_tag($args) {
        if (!current_user_can('manage_categories')) {
            throw new Exception('Insufficient permissions to create tags');
        }
        
        $tag_data = array(
            'name' => sanitize_text_field($args['name'])
        );
        
        if (!empty($args['description'])) {
            $tag_data['description'] = sanitize_textarea_field($args['description']);
        }
        
        if (!empty($args['slug'])) {
            $tag_data['slug'] = sanitize_title($args['slug']);
        }
        
        $result = wp_insert_term($args['name'], 'post_tag', $tag_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to create tag: ' . $result->get_error_message());
        }
        
        $tag = get_term($result['term_id'], 'post_tag');
        
        return array(
            'id' => $tag->term_id,
            'name' => $tag->name,
            'slug' => $tag->slug,
            'description' => $tag->description,
            'link' => get_tag_link($tag->term_id)
        );
    }
    
    public function wp_update_tag($args) {
        if (!current_user_can('manage_categories')) {
            throw new Exception('Insufficient permissions to update tags');
        }
        
        $id = intval($args['id']);
        
        $tag = get_term($id, 'post_tag');
        
        if (!$tag || is_wp_error($tag)) {
            throw new Exception('Tag not found: ' . $id);
        }
        
        $update_data = array();
        
        if (!empty($args['name'])) {
            $update_data['name'] = sanitize_text_field($args['name']);
        }
        
        if (!empty($args['description'])) {
            $update_data['description'] = sanitize_textarea_field($args['description']);
        }
        
        if (!empty($args['slug'])) {
            $update_data['slug'] = sanitize_title($args['slug']);
        }
        
        $result = wp_update_term($id, 'post_tag', $update_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update tag: ' . $result->get_error_message());
        }
        
        $updated_tag = get_term($id, 'post_tag');
        
        return array(
            'id' => $updated_tag->term_id,
            'name' => $updated_tag->name,
            'slug' => $updated_tag->slug,
            'description' => $updated_tag->description,
            'link' => get_tag_link($updated_tag->term_id)
        );
    }
    
    public function wp_delete_tag($args) {
        if (!current_user_can('manage_categories')) {
            throw new Exception('Insufficient permissions to delete tags');
        }
        
        $id = intval($args['id']);
        
        $tag = get_term($id, 'post_tag');
        
        if (!$tag || is_wp_error($tag)) {
            throw new Exception('Tag not found: ' . $id);
        }
        
        $result = wp_delete_term($id, 'post_tag');
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to delete tag: ' . $result->get_error_message());
        }
        
        return array(
            'deleted' => true,
            'id' => $id
        );
    }
    
    private function register_settings_tools() {
        // wp_get_general_settings - Get WordPress general site settings
        $this->register_tool(array(
            'name' => 'wp_get_general_settings',
            'description' => 'Get WordPress general site settings',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wp_get_general_settings')
        ));
        
        // wp_update_general_settings - Update WordPress general site settings
        $this->register_tool(array(
            'name' => 'wp_update_general_settings',
            'description' => 'Update WordPress general site settings',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'title' => array('type' => 'string', 'description' => 'Site title'),
                    'description' => array('type' => 'string', 'description' => 'Site tagline/description'),
                    'timezone_string' => array('type' => 'string', 'description' => 'Site timezone'),
                    'date_format' => array('type' => 'string', 'description' => 'Date format'),
                    'time_format' => array('type' => 'string', 'description' => 'Time format'),
                    'start_of_week' => array('type' => 'integer', 'description' => 'Start of week (0 = Sunday, 1 = Monday, etc.)'),
                    'language' => array('type' => 'string', 'description' => 'Site language'),
                    'use_smilies' => array('type' => 'boolean', 'description' => 'Convert emoticons to graphics'),
                    'default_category' => array('type' => 'integer', 'description' => 'Default post category'),
                    'default_post_format' => array('type' => 'string', 'description' => 'Default post format'),
                    'posts_per_page' => array('type' => 'integer', 'description' => 'Number of posts to show per page'),
                    'default_comment_status' => array('type' => 'string', 'description' => 'Default comment status (open/closed)'),
                    'default_ping_status' => array('type' => 'string', 'description' => 'Default ping status (open/closed)')
                )
            ),
            'callback' => array($this, 'wp_update_general_settings')
        ));
    }
    
    // Settings Tool implementations
    public function wp_get_general_settings($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions to read site settings');
        }
        
        // Get all the general settings
        $settings = array(
            'title' => get_option('blogname'),
            'description' => get_option('blogdescription'),
            'url' => get_option('home'),
            'email' => get_option('admin_email'),
            'timezone_string' => get_option('timezone_string'),
            'date_format' => get_option('date_format'),
            'time_format' => get_option('time_format'),
            'start_of_week' => intval(get_option('start_of_week')),
            'language' => get_option('WPLANG'),
            'use_smilies' => (bool) get_option('use_smilies'),
            'default_category' => intval(get_option('default_category')),
            'default_post_format' => get_option('default_post_format'),
            'posts_per_page' => intval(get_option('posts_per_page')),
            'default_comment_status' => get_option('default_comment_status'),
            'default_ping_status' => get_option('default_ping_status'),
            'show_on_front' => get_option('show_on_front'),
            'page_on_front' => intval(get_option('page_on_front')),
            'page_for_posts' => intval(get_option('page_for_posts')),
            'users_can_register' => (bool) get_option('users_can_register'),
            'default_role' => get_option('default_role'),
            'comment_registration' => (bool) get_option('comment_registration'),
            'close_comments_for_old_posts' => (bool) get_option('close_comments_for_old_posts'),
            'close_comments_days_old' => intval(get_option('close_comments_days_old')),
            'thread_comments' => (bool) get_option('thread_comments'),
            'thread_comments_depth' => intval(get_option('thread_comments_depth')),
            'page_comments' => (bool) get_option('page_comments'),
            'comments_per_page' => intval(get_option('comments_per_page')),
            'default_comments_page' => get_option('default_comments_page'),
            'comment_order' => get_option('comment_order'),
            'comments_notify' => (bool) get_option('comments_notify'),
            'moderation_notify' => (bool) get_option('moderation_notify'),
            'comment_moderation' => (bool) get_option('comment_moderation'),
            'comment_previously_approved' => (bool) get_option('comment_previously_approved'),
            'comment_max_links' => intval(get_option('comment_max_links')),
            'moderation_keys' => get_option('moderation_keys'),
            'disallowed_keys' => get_option('disallowed_keys')
        );
        
        // Add WordPress version and other system info
        $settings['wordpress_version'] = get_bloginfo('version');
        $settings['php_version'] = PHP_VERSION;
        $settings['is_multisite'] = is_multisite();
        
        return $settings;
    }
    
    public function wp_update_general_settings($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions to update site settings');
        }
        
        $updated_settings = array();
        
        // Update site title
        if (isset($args['title'])) {
            $title = sanitize_text_field($args['title']);
            update_option('blogname', $title);
            $updated_settings['title'] = $title;
        }
        
        // Update site description/tagline
        if (isset($args['description'])) {
            $description = sanitize_text_field($args['description']);
            update_option('blogdescription', $description);
            $updated_settings['description'] = $description;
        }
        
        // Update timezone
        if (isset($args['timezone_string'])) {
            $timezone = sanitize_text_field($args['timezone_string']);
            // Validate timezone
            if (in_array($timezone, timezone_identifiers_list())) {
                update_option('timezone_string', $timezone);
                $updated_settings['timezone_string'] = $timezone;
            } else {
                throw new Exception('Invalid timezone: ' . $timezone);
            }
        }
        
        // Update date format
        if (isset($args['date_format'])) {
            $date_format = sanitize_text_field($args['date_format']);
            update_option('date_format', $date_format);
            $updated_settings['date_format'] = $date_format;
        }
        
        // Update time format
        if (isset($args['time_format'])) {
            $time_format = sanitize_text_field($args['time_format']);
            update_option('time_format', $time_format);
            $updated_settings['time_format'] = $time_format;
        }
        
        // Update start of week
        if (isset($args['start_of_week'])) {
            $start_of_week = intval($args['start_of_week']);
            if ($start_of_week >= 0 && $start_of_week <= 6) {
                update_option('start_of_week', $start_of_week);
                $updated_settings['start_of_week'] = $start_of_week;
            } else {
                throw new Exception('Invalid start_of_week value. Must be 0-6.');
            }
        }
        
        // Update language
        if (isset($args['language'])) {
            $language = sanitize_text_field($args['language']);
            update_option('WPLANG', $language);
            $updated_settings['language'] = $language;
        }
        
        // Update use smilies
        if (isset($args['use_smilies'])) {
            $use_smilies = (bool) $args['use_smilies'];
            update_option('use_smilies', $use_smilies);
            $updated_settings['use_smilies'] = $use_smilies;
        }
        
        // Update default category
        if (isset($args['default_category'])) {
            $default_category = intval($args['default_category']);
            // Validate category exists
            if (term_exists($default_category, 'category')) {
                update_option('default_category', $default_category);
                $updated_settings['default_category'] = $default_category;
            } else {
                throw new Exception('Invalid category ID: ' . $default_category);
            }
        }
        
        // Update default post format
        if (isset($args['default_post_format'])) {
            $post_format = sanitize_text_field($args['default_post_format']);
            $valid_formats = get_post_format_slugs();
            $valid_formats[] = '0'; // Standard format
            if (in_array($post_format, $valid_formats)) {
                update_option('default_post_format', $post_format);
                $updated_settings['default_post_format'] = $post_format;
            } else {
                throw new Exception('Invalid post format: ' . $post_format);
            }
        }
        
        // Update posts per page
        if (isset($args['posts_per_page'])) {
            $posts_per_page = intval($args['posts_per_page']);
            if ($posts_per_page > 0) {
                update_option('posts_per_page', $posts_per_page);
                $updated_settings['posts_per_page'] = $posts_per_page;
            } else {
                throw new Exception('Posts per page must be greater than 0');
            }
        }
        
        // Update default comment status
        if (isset($args['default_comment_status'])) {
            $comment_status = sanitize_text_field($args['default_comment_status']);
            if (in_array($comment_status, array('open', 'closed'))) {
                update_option('default_comment_status', $comment_status);
                $updated_settings['default_comment_status'] = $comment_status;
            } else {
                throw new Exception('Invalid comment status. Must be "open" or "closed".');
            }
        }
        
        // Update default ping status
        if (isset($args['default_ping_status'])) {
            $ping_status = sanitize_text_field($args['default_ping_status']);
            if (in_array($ping_status, array('open', 'closed'))) {
                update_option('default_ping_status', $ping_status);
                $updated_settings['default_ping_status'] = $ping_status;
            } else {
                throw new Exception('Invalid ping status. Must be "open" or "closed".');
            }
        }
        
        if (empty($updated_settings)) {
            throw new Exception('No valid settings provided to update');
        }
        
        return array(
            'updated' => $updated_settings,
            'message' => 'Settings updated successfully',
            'count' => count($updated_settings)
        );
    }
    
    private function register_site_info_tools() {
        // get_site_info - Get comprehensive WordPress site information
        $this->register_tool(array(
            'name' => 'get_site_info',
            'description' => 'Provides detailed information about the WordPress site like site name, url, description, admin email, plugins, themes, users, and more',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'get_site_info')
        ));
        
        // wp_list_plugins - Get detailed information about all plugins
        $this->register_tool(array(
            'name' => 'wp_list_plugins',
            'description' => 'Get detailed information about all WordPress plugins including active/inactive status, versions, descriptions, authors, update availability, and more',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'status' => array(
                        'type' => 'string',
                        'description' => 'Filter plugins by status (active, inactive, all)',
                        'enum' => array('active', 'inactive', 'all')
                    ),
                    'search' => array(
                        'type' => 'string',
                        'description' => 'Search plugins by name'
                    )
                )
            ),
            'callback' => array($this, 'wp_list_plugins')
        ));
        
        // wp_get_theme_info - Get detailed information about the active theme
        $this->register_tool(array(
            'name' => 'wp_get_theme_info',
            'description' => 'Get comprehensive information about the active WordPress theme including parent theme, theme supports, customizer settings, update availability, and more',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wp_get_theme_info')
        ));
        
        // wp_list_themes - Get information about all available themes
        $this->register_tool(array(
            'name' => 'wp_list_themes',
            'description' => 'Get detailed information about all WordPress themes including active/inactive status, versions, descriptions, authors, update availability, and more',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array(
                        'type' => 'string',
                        'description' => 'Search themes by name, description, or author'
                    )
                )
            ),
            'callback' => array($this, 'wp_list_themes')
        ));
        
        // wp_get_site_settings - Get comprehensive WordPress site settings
        $this->register_tool(array(
            'name' => 'wp_get_site_settings',
            'description' => 'Get comprehensive WordPress site settings including general, reading, discussion, media, permalink, privacy, writing, and misc settings',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'category' => array(
                        'type' => 'string',
                        'description' => 'Specific settings category to retrieve (general, reading, discussion, media, permalink, privacy, writing, misc, all)',
                        'enum' => array('general', 'reading', 'discussion', 'media', 'permalink', 'privacy', 'writing', 'misc', 'all')
                    )
                )
            ),
            'callback' => array($this, 'wp_get_site_settings')
        ));
        
        // wp_get_general_site_info - Get comprehensive WordPress site information
        $this->register_tool(array(
            'name' => 'wp_get_general_site_info',
            'description' => 'Get comprehensive WordPress site information including site details, server info, plugins, themes, users, content statistics, and system requirements',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'view' => array(
                        'type' => 'string',
                        'description' => 'Type of information to retrieve (full, overview, requirements)',
                        'enum' => array('full', 'overview', 'requirements'),
                        'default' => 'full'
                    )
                )
            ),
            'callback' => array($this, 'wp_get_general_site_info')
        ));
        
        // wp_get_detailed_theme_info - Get detailed information about the active theme
        $this->register_tool(array(
            'name' => 'wp_get_detailed_theme_info',
            'description' => 'Get detailed information about the active WordPress theme including parent theme, theme supports, customizer settings, and theme mods',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => (object) array(),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_get_detailed_theme_info')
        ));
        
        // wp_get_detailed_user_info - Get comprehensive information about WordPress users
        $this->register_tool(array(
            'name' => 'wp_get_detailed_user_info',
            'description' => 'Get comprehensive information about WordPress users including roles, capabilities, statistics, and user details',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'view' => array(
                        'type' => 'string',
                        'description' => 'Type of information to retrieve (full, statistics, roles, role_stats, single)',
                        'enum' => array('full', 'statistics', 'roles', 'role_stats', 'single'),
                        'default' => 'full'
                    ),
                    'user_id' => array(
                        'type' => 'integer',
                        'description' => 'User ID for single user view'
                    )
                )
            ),
            'callback' => array($this, 'wp_get_detailed_user_info')
        ));
    }
    
    /**
     * Register Database tools (db_*)
     */
    private function register_database_tools() {
        // db_get_info
        $this->register_tool(array(
            'name' => 'db_get_info',
            'description' => 'Get general information about the WordPress database including size and table count.',
            'inputSchema' => array('type' => 'object', 'properties' => new \stdClass()),
            'callback' => array($this, 'db_get_info')
        ));

        // db_list_tables
        $this->register_tool(array(
            'name' => 'db_list_tables',
            'description' => 'List all database tables with size and row count.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'sort_by' => array('type' => 'string', 'enum' => array('name','size','rows'), 'default' => 'size'),
                    'sort_order' => array('type' => 'string', 'enum' => array('asc','desc'), 'default' => 'desc')
                )
            ),
            'callback' => array($this, 'db_list_tables')
        ));

        // db_get_table_schema
        $this->register_tool(array(
            'name' => 'db_get_table_schema',
            'description' => 'Get the schema definition for a specific table.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'table_name' => array('type' => 'string')
                ),
                'required' => array('table_name')
            ),
            'callback' => array($this, 'db_get_table_schema')
        ));

        // db_run_query (read-only)
        $this->register_tool(array(
            'name' => 'db_run_query',
            'description' => 'Execute a read-only (SELECT) SQL query. Disabled by default for security – enable via settings.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array('query' => array('type' => 'string')),
                'required' => array('query')
            ),
            'callback' => array($this, 'db_run_query')
        ));

        // db_find_unused_data
        $this->register_tool(array(
            'name' => 'db_find_unused_data',
            'description' => 'Scan the database for orphaned tables (left by removed plugins) and expired or bloated transients/options.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'If true, include full lists of orphaned tables and expired transients.',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'db_find_unused_data')
        ));
    }

    /**
     * Register Security tools (security_*)
     */
    private function register_security_tools() {
        $this->register_tool(array(
            'name' => 'security_audit',
            'description' => 'Run a security audit of common WordPress hardening checks and return actionable recommendations.',
            'inputSchema' => array('type' => 'object', 'properties' => new \stdClass()),
            'callback' => array($this, 'security_audit')
        ));

        $this->register_tool(array(
            'name' => 'security_core_checksum',
            'description' => 'Verify WordPress core files against official checksums to detect tampering or unexpected files.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to include full lists of mismatched/extra/missing files',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'security_core_checksum')
        ));

        // ==== New security tools registrations ====
        $this->register_tool(array(
            'name' => 'security_file_permissions',
            'description' => 'Scan core, wp-content, uploads and wp-config.php for insecure file or directory permissions.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'Include full list of items with incorrect permissions',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'security_file_permissions')
        ));

        $this->register_tool(array(
            'name' => 'security_http_headers',
            'description' => 'Check recommended security-related HTTP response headers for the front-page request.',
            'inputSchema' => array('type' => 'object', 'properties' => new \stdClass()),
            'callback' => array($this, 'security_http_headers')
        ));

        $this->register_tool(array(
            'name' => 'security_https_enforcement',
            'description' => 'Verify that the site enforces HTTPS and HSTS correctly.',
            'inputSchema' => array('type' => 'object', 'properties' => new \stdClass()),
            'callback' => array($this, 'security_https_enforcement')
        ));

        $this->register_tool(array(
            'name' => 'security_php_version_check',
            'description' => 'Check the running PHP version against the recommended minimum.',
            'inputSchema' => array('type' => 'object', 'properties' => new \stdClass()),
            'callback' => array($this, 'security_php_version_check')
        ));

        $this->register_tool(array(
            'name' => 'security_admin_users_audit',
            'description' => 'List administrator accounts and flag dormant ones.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'dormant_days' => array(
                        'type' => 'integer',
                        'description' => 'Number of days without login after which an admin account is considered dormant',
                        'default' => 90
                    )
                )
            ),
            'callback' => array($this, 'security_admin_users_audit')
        ));

        $this->register_tool(array(
            'name' => 'security_login_events',
            'description' => 'Return recent successful and failed login events captured by MagicAssistant.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'limit' => array(
                        'type' => 'integer',
                        'description' => 'Maximum number of events to return',
                        'default' => 20
                    )
                )
            ),
            'callback' => array($this, 'security_login_events')
        ));

        $this->register_tool(array(
            'name' => 'security_file_integrity_watch',
            'description' => 'Detect new, modified or deleted files compared to a stored baseline.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'Include full lists of changed files',
                        'default' => false
                    ),
                    'reset_baseline' => array(
                        'type' => 'boolean',
                        'description' => 'If true, create/overwrite the baseline snapshot without comparison',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'security_file_integrity_watch')
        ));

        $this->register_tool(array(
            'name' => 'security_plugins_checksum',
            'description' => 'Compare active plugin files against the official WordPress.org release to detect tampering.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'Include per-plugin lists of modified/missing/unexpected files',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'security_plugins_checksum')
        ));

        $this->register_tool(array(
            'name' => 'security_themes_checksum',
            'description' => 'Compare active theme files against the official WordPress.org release to detect tampering.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'Include detailed lists of changed files',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'security_themes_checksum')
        ));

        $this->register_tool(array(
            'name' => 'security_vulnerability_scan',
            'description' => 'Query WPScan API to list known vulnerabilities affecting installed components.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_details' => array(
                        'type' => 'boolean',
                        'description' => 'Include full vulnerability objects returned by the API',
                        'default' => false
                    )
                )
            ),
            'callback' => array($this, 'security_vulnerability_scan')
        ));

        $this->register_tool(array(
            'name' => 'security_htaccess_protection',
            'description' => 'Check .htaccess for common hardening rules (Apache only).',
            'inputSchema' => array('type' => 'object', 'properties' => new \stdClass()),
            'callback' => array($this, 'security_htaccess_protection')
        ));
    }

    /* ===================== Database tool callbacks ===================== */
    public function db_get_info($args) {
        global $wpdb;
        $dbName = DB_NAME;
        // Total size in MB
        $size = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(data_length + index_length)/1024/1024 FROM information_schema.TABLES WHERE table_schema = %s",
            $dbName
        ));
        // Table count
        $tableCount = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM information_schema.TABLES WHERE table_schema = %s",
            $dbName
        ));
        return array(
            'success' => true,
            'database_name' => $dbName,
            'total_size_mb' => round($size,2),
            'table_count' => intval($tableCount),
            'table_prefix' => $wpdb->prefix
        );
    }

    public function db_list_tables($args) {
        global $wpdb;
        $sortBy = isset($args['sort_by']) ? $args['sort_by'] : 'size';
        $sortOrder = (isset($args['sort_order']) && strtolower($args['sort_order'])==='asc') ? 'asc' : 'desc';
        $tables = $wpdb->get_results("SHOW TABLE STATUS", ARRAY_A);
        $list = array_map(function($tbl){
            return array(
                'name' => $tbl['Name'],
                'rows' => intval($tbl['Rows']),
                'engine' => $tbl['Engine'],
                'size_mb' => round(($tbl['Data_length']+$tbl['Index_length'])/1024/1024,3)
            );
        }, $tables);
        usort($list, function($a,$b) use($sortBy,$sortOrder){
            if($a[$sortBy]==$b[$sortBy]) return 0;
            $cmp = ($a[$sortBy]<$b[$sortBy])? -1:1;
            return $sortOrder==='asc' ? $cmp : -$cmp;
        });
        return array('success'=>true,'tables'=>$list,'total_tables'=>count($list));
    }

    public function db_get_table_schema($args) {
        global $wpdb;
        $table = sanitize_text_field($args['table_name']);
        if(preg_match('/[^a-zA-Z0-9_]/',$table)) throw new \Exception('Invalid table name');
        $exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
        if($exists!=$table) throw new \Exception("Table not found");
        $schema = $wpdb->get_results("DESCRIBE `$table`", ARRAY_A);
        return array('success'=>true,'table_name'=>$table,'schema'=>$schema);
    }

    public function db_run_query($args) {
        if(!$this->db || !$this->db->get_setting('enable_sql_queries', false)) {
            throw new \Exception('SQL query execution is disabled in settings.');
        }
        global $wpdb;
        $query = trim($args['query']);
        $dangerous = $this->db && $this->db->get_setting('enable_dangerous_sql_queries', false);
        if(!$dangerous && stripos($query,'select')!==0) {
            throw new \Exception('Only SELECT queries allowed (dangerous queries disabled).');
        }
        $query = rtrim($query,';');
        $results = $wpdb->get_results($query, ARRAY_A);
        if($wpdb->last_error) throw new \Exception('SQL Error: '.$wpdb->last_error);
        return array('success'=>true,'row_count'=>count($results),'results'=>array_slice($results,0,100));
    }

    public function db_find_unused_data($args) {
        global $wpdb;
        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;

        // Find orphaned tables (left by removed plugins)
        $all_tables = $wpdb->get_col("SHOW TABLES");
        $active_plugins = get_option('active_plugins'); // array of active plugin file paths

        // wp_get_theme()->get_stylesheet() returns a single theme slug (string). Cast to array for consistency.
        $active_themes  = array( wp_get_theme()->get_stylesheet() );

        // Build a list of tables that we expect to exist:
        // 1) Core WordPress tables (introspected from $wpdb properties)
        // 2) Any tables that plugins/themes explicitly add to this list (future extension)

        $core_tables = array();
        foreach (get_object_vars($wpdb) as $prop_value) {
            if (is_string($prop_value) && strpos($prop_value, $wpdb->prefix) === 0) {
                $core_tables[] = $prop_value;
            }
        }

        $expected_tables = array_merge(
            $core_tables,
            array_map(function ($plugin) use ($wpdb) {
                return $wpdb->prefix . 'options'; // placeholder for plugin-specific tables, extend as needed
            }, $active_plugins),
            array_map(function ($theme) use ($wpdb) {
                return $wpdb->prefix . 'options'; // placeholder for theme-specific tables, extend as needed
            }, $active_themes)
        );

        // Remove duplicates just in case
        $expected_tables = array_unique($expected_tables);

        // Any prefixed table that isn't in our expected list is a candidate for being orphaned
        $orphaned_tables = array_filter($all_tables, function($tbl) use ($expected_tables) {
            return !in_array($tbl, $expected_tables, true);
        });

        // Find expired transients
        $expired_transients = $wpdb->get_results("SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_%' AND option_value < UNIX_TIMESTAMP()", ARRAY_A);
        $expired_transient_names = array_map(function($row) {
            return str_replace('_transient_timeout_', '', $row['option_name']);
        }, $expired_transients);

        $summary = array(
            'orphaned_tables' => count($orphaned_tables),
            'expired_transients' => count($expired_transient_names),
            'has_issues' => !empty($orphaned_tables) || !empty($expired_transients)
        );

        if ($include_details) {
            $summary['details'] = array(
                'orphaned_tables' => $orphaned_tables,
                'expired_transients' => $expired_transient_names
            );
        }

        return array('success' => true, 'report' => $summary);
    }

    /* ===================== Security tool callbacks ===================== */
    public function security_audit($args) {
        $checks = array();
        
        // 1. Public registration
        $reg = get_option('users_can_register');
        $checks[] = array(
            'check' => 'User Registration',
            'status' => $reg ? 'warning' : 'ok',
            'message' => $reg ? 'Public user registration is enabled.' : 'Public registration disabled.',
            'recommendation' => $reg ? 'Disable "Anyone can register" unless you need public registration.' : null,
            'severity' => $reg ? 'medium' : null
        );
        
        // 2. Default role
        $role = get_option('default_role');
        $crit = $role === 'administrator';
        $checks[] = array(
            'check' => 'Default Role',
            'status' => $crit ? 'critical' : 'ok',
            'message' => "Default role set to {$role}.",
            'recommendation' => $crit ? 'URGENT: Change default role to Subscriber. New users currently get admin access!' : null,
            'severity' => $crit ? 'high' : null
        );
        
        // 3. admin user exists
        $adminExists = username_exists('admin');
        $checks[] = array(
            'check' => 'Admin Username',
            'status' => $adminExists ? 'critical' : 'ok',
            'message' => $adminExists ? 'User named "admin" exists.' : 'No predictable "admin" username.',
            'recommendation' => $adminExists ? 'Rename the "admin" user to something less predictable.' : null,
            'severity' => $adminExists ? 'high' : null
        );
        
        // 4. DB prefix
        global $wpdb; 
        $defPrefix = $wpdb->prefix === 'wp_';
        $checks[] = array(
            'check' => 'Database Prefix',
            'status' => $defPrefix ? 'warning' : 'ok',
            'message' => 'Current prefix: ' . $wpdb->prefix,
            'recommendation' => $defPrefix ? 'Consider changing DB prefix from wp_ to something custom for additional security.' : null,
            'severity' => $defPrefix ? 'low' : null
        );
        
        // 5. WP_DEBUG (context-aware)
        $debug = defined('WP_DEBUG') && WP_DEBUG;
        $isProduction = !in_array($_SERVER['SERVER_NAME'] ?? '', array('localhost', '127.0.0.1', 'local.test')) && 
                       !preg_match('/\.(local|test|dev)$/', $_SERVER['SERVER_NAME'] ?? '');
        $checks[] = array(
            'check' => 'Debug Mode',
            'status' => ($debug && $isProduction) ? 'warning' : 'ok',
            'message' => $debug ? 'WP_DEBUG is ON.' : 'WP_DEBUG is OFF.',
            'recommendation' => ($debug && $isProduction) ? 'Disable debugging on production sites.' : null,
            'severity' => ($debug && $isProduction) ? 'medium' : null
        );
        
        // 6. Keys & salts
        $keyConsts = array('AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT');
        $keysOk = true;
        $weakKeys = array();
        foreach ($keyConsts as $kc) {
            if (!defined($kc) || constant($kc) == 'put your unique phrase here' || strlen(constant($kc)) < 32) { 
                $keysOk = false; 
                $weakKeys[] = $kc;
            }
        }
        $checks[] = array(
            'check' => 'Security Keys & Salts',
            'status' => $keysOk ? 'ok' : 'critical',
            'message' => $keysOk ? 'Unique security keys configured.' : 'Default or weak security keys detected.',
            'recommendation' => $keysOk ? null : 'Update security keys in wp-config.php using WordPress.org secret-key generator.',
            'severity' => $keysOk ? null : 'high'
        );
        
        // 7. File editing
        $fileEdit = !defined('DISALLOW_FILE_EDIT') || !DISALLOW_FILE_EDIT;
        $checks[] = array(
            'check' => 'File Editing',
            'status' => $fileEdit ? 'warning' : 'ok',
            'message' => $fileEdit ? 'Theme/plugin file editing is enabled in admin.' : 'File editing disabled.',
            'recommendation' => $fileEdit ? 'Add define("DISALLOW_FILE_EDIT", true); to wp-config.php to disable admin file editing.' : null,
            'severity' => $fileEdit ? 'medium' : null
        );
        
        // 8. Directory indexing check
        $indexingCheck = $this->check_directory_indexing();
        $checks[] = array(
            'check' => 'Directory Indexing',
            'status' => $indexingCheck['enabled'] ? 'warning' : 'ok',
            'message' => $indexingCheck['enabled'] ? 'Directory indexing may be enabled.' : 'Directory indexing appears disabled.',
            'recommendation' => $indexingCheck['enabled'] ? 'Ensure directory indexing is disabled via .htaccess or server config.' : null,
            'severity' => $indexingCheck['enabled'] ? 'medium' : null
        );

        $summary = array(
            'total_checks' => count($checks),
            'critical' => count(array_filter($checks, function($c) { return $c['status'] == 'critical'; })),
            'warning' => count(array_filter($checks, function($c) { return $c['status'] == 'warning'; })),
            'ok' => count(array_filter($checks, function($c) { return $c['status'] == 'ok'; })),
            'security_score' => $this->calculate_security_score($checks),
            'notes' => array(
                'scope' => 'Basic WordPress security configuration audit',
                'focus' => 'Common security misconfigurations and hardening opportunities',
                'next_steps' => 'Run additional security tools for comprehensive analysis'
            )
        );
        
        return array('success' => true, 'audit_results' => $checks, 'summary' => $summary);
    }

    /**
     * Check if directory indexing is enabled
     */
    private function check_directory_indexing() {
        // Try to check wp-content/uploads directory
        $uploads_dir = wp_upload_dir();
        $test_url = $uploads_dir['baseurl'] . '/';
        
        $response = wp_remote_head($test_url, array('timeout' => 5));
        
        if (is_wp_error($response)) {
            return array('enabled' => false, 'checked' => false);
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        
        // If we get a 200 response, indexing might be enabled
        // If we get 403 (Forbidden), indexing is likely disabled
        return array(
            'enabled' => $response_code === 200,
            'checked' => true,
            'response_code' => $response_code
        );
    }

    /**
     * Calculate overall security score
     */
    private function calculate_security_score($checks) {
        $total_checks = count($checks);
        $critical_issues = count(array_filter($checks, function($c) { return $c['status'] == 'critical'; }));
        $warning_issues = count(array_filter($checks, function($c) { return $c['status'] == 'warning'; }));
        
        // Start with 100, subtract points for issues
        $score = 100;
        $score -= $critical_issues * 20; // Critical issues cost 20 points each
        $score -= $warning_issues * 10;  // Warning issues cost 10 points each
        
        return max(0, $score); // Don't go below 0
    }

    /**
     * Verify WordPress core checksums
     */
    public function security_core_checksum($args) {
        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;

        global $wp_version;
        // Ensure the checksum helper is loaded (front-end contexts may not include it)
        if ( ! function_exists( 'get_core_checksums' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        // Fetch official checksums from WordPress.org
        $checksums = get_core_checksums($wp_version, get_locale());
        if (!$checksums || !is_array($checksums)) {
            return array('success' => false, 'error' => 'Unable to fetch official checksums from WordPress.org API');
        }

        $missing  = array();
        $modified = array();
        $verified_count = 0;

        // Files that are commonly and safely removed from WordPress installations
        $safe_to_remove = array(
            'wp-content/themes/twentytwentyone',
            'wp-content/themes/twentytwentytwo', 
            'wp-content/themes/twentytwentythree',
            'wp-content/themes/twentytwentyfour',
            'wp-content/themes/twentytwentyfive',
            'wp-content/plugins/akismet',
            'wp-content/plugins/hello.php',
            'license.txt',
            'readme.html',
            'wp-config-sample.php'
        );

        foreach ($checksums as $file => $md5) {
            $local_path = ABSPATH . $file;
            if (!file_exists($local_path)) {
                // Skip commonly removed files that are safe to delete
                $is_safe_removal = false;
                foreach ($safe_to_remove as $safe_pattern) {
                    if (strpos($file, $safe_pattern) === 0) {
                        $is_safe_removal = true;
                        break;
                    }
                }
                
                if (!$is_safe_removal) {
                    $missing[] = $file;
                }
                continue;
            }
            $verified_count++;
            if (md5_file($local_path) !== $md5) {
                // Only flag modifications of potentially dangerous files
                if ($this->is_security_critical_file($file)) {
                    $modified[] = $file;
                }
            }
        }

        // Detect unexpected files in core directories (wp-admin, wp-includes, root php files)
        $core_dirs = array('wp-admin', 'wp-includes');
        $unexpected = array();
        foreach ($core_dirs as $dir) {
            $dir_path = ABSPATH . $dir;
            if (!is_dir($dir_path)) continue;
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dir_path, \RecursiveDirectoryIterator::SKIP_DOTS)
            );
            foreach ($iterator as $path => $info) {
                $relative = str_replace(ABSPATH, '', $path);
                if (!isset($checksums[$relative]) && !$this->is_harmless_unexpected_file($relative)) {
                    $unexpected[] = $relative;
                }
            }
        }
        // Also check root php files (index.php, wp-login.php etc.)
        foreach (glob(ABSPATH . '*.php') as $path) {
            $relative = str_replace(ABSPATH, '', $path);
            if (!isset($checksums[$relative]) && !$this->is_harmless_unexpected_file($relative)) {
                $unexpected[] = $relative;
            }
        }

        $summary = array(
            'total_core_files'        => count($checksums),
            'files_verified'          => $verified_count,
            'missing_files'           => count($missing),
            'modified_files'          => count($modified),
            'unexpected_files'        => count($unexpected),
            'integrity_ok'            => empty($missing) && empty($modified) && empty($unexpected),
            'notes' => array(
                'missing_files_note' => count($missing) > 0 ? 'Missing files detected. Common theme/plugin removals are ignored.' : null,
                'modified_files_note' => count($modified) > 0 ? 'Only security-critical file modifications are flagged.' : null,
                'unexpected_files_note' => count($unexpected) > 0 ? 'Unexpected files found. Development/system files are ignored.' : null
            )
        );

        if ($include_details) {
            // Limit detail arrays to reduce payload size
            $summary['details'] = array(
                'missing'    => array_slice($missing, 0, 50),
                'modified'   => array_slice($modified, 0, 50),
                'unexpected' => array_slice($unexpected, 0, 50)
            );
            
            // Add truncation info and counts
            $summary['counts'] = array(
                'missing_total'    => count($missing),
                'modified_total'   => count($modified), 
                'unexpected_total' => count($unexpected)
            );
            
            if (count($missing) > 50) {
                $summary['details']['missing_truncated'] = count($missing) - 50;
            }
            if (count($modified) > 50) {
                $summary['details']['modified_truncated'] = count($modified) - 50;
            }
            if (count($unexpected) > 50) {
                $summary['details']['unexpected_truncated'] = count($unexpected) - 50;
            }
        }

        return array('success' => true, 'checksum_report' => $summary);
    }

    /**
     * Check if a file modification is security critical
     */
    private function is_security_critical_file($file) {
        // Files that could be dangerous if modified
        $critical_patterns = array(
            '.php', // All PHP files are potentially dangerous
            'wp-config', // Configuration files
            '.htaccess', // Access control files
            'wp-admin/admin', // Admin interface files
            'wp-includes/class-', // Core class files
            'wp-includes/functions', // Core function files
            'wp-login.php', // Login functionality
            'wp-cron.php', // Cron functionality
            'wp-mail.php', // Mail functionality
            'wp-settings.php', // Core settings
            'wp-load.php' // Core loading
        );

        // Non-critical file types that are safe to modify
        $safe_extensions = array('.txt', '.md', '.html', '.css', '.js', '.json', '.xml');
        
        // Check if file has a safe extension
        $file_ext = '.' . pathinfo($file, PATHINFO_EXTENSION);
        if (in_array($file_ext, $safe_extensions)) {
            return false;
        }

        // Check if file matches critical patterns
        foreach ($critical_patterns as $pattern) {
            if (strpos($file, $pattern) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an unexpected file is harmless
     */
    private function is_harmless_unexpected_file($file) {
        // Common development and system files that are harmless
        $harmless_patterns = array(
            '.DS_Store', // macOS system files
            'Thumbs.db', // Windows thumbnail cache
            '.git', // Git version control
            '.svn', // SVN version control
            '.htaccess', // Often added by plugins/themes
            'robots.txt', // SEO files
            'sitemap', // SEO sitemaps
            '.well-known', // Security/verification files
            'favicon.ico', // Site icons
            'apple-touch-icon', // iOS icons
            'browserconfig.xml', // Windows tile config
            'manifest.json', // PWA manifest
            '.log', // Log files
            '.cache', // Cache files
            '.tmp', // Temporary files
            'local-', // Local development tool files
            'wp-cli.yml', // WP CLI config
            'composer.json', // Composer files
            'package.json', // NPM files
            'gulpfile.js', // Gulp task runner
            'gruntfile.js', // Grunt task runner
            'webpack.config.js', // Webpack config
            '.env', // Environment files (though should be secured)
            'debug.log', // Debug logs
            'error_log', // Error logs
            'access.log' // Access logs
        );

        $file_lower = strtolower($file);
        
        foreach ($harmless_patterns as $pattern) {
            if (strpos($file_lower, strtolower($pattern)) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check file and directory permissions across the installation.
     */
    public function security_file_permissions($args) {
        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;
        $max_files = isset($args['max_files']) ? (int) $args['max_files'] : 2000;
        $max_issues = isset($args['max_issues']) ? (int) $args['max_issues'] : 100;

        $paths_to_scan = array(
            ABSPATH,
            WP_CONTENT_DIR,
            wp_upload_dir()['basedir'],
            ABSPATH . 'wp-config.php'
        );

        $issues = array();
        $critical_issues = array();
        $total = 0;
        $start_time = time();
        $max_execution_time = 30; // 30 seconds max

        foreach ($paths_to_scan as $base) {
            if (!file_exists($base)) continue;

            $iterator = is_dir($base)
                ? new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($base, \FilesystemIterator::SKIP_DOTS))
                : array($base);

            foreach ($iterator as $path) {
                // Check execution time and file limits
                if (time() - $start_time > $max_execution_time || $total >= $max_files) {
                    break 2; // Break out of both loops
                }
                
                // Skip files that shouldn't be checked for permissions issues
                $relative_path = str_replace(ABSPATH, '', $path);
                if ($this->should_skip_permission_check($relative_path)) {
                    continue;
                }

                $total++;
                
                // Stop collecting more issues if we have enough critical ones
                if (count($critical_issues) >= $max_issues) {
                    continue;
                }
                $isDir = is_dir($path);
                $perms = substr(sprintf('%o', fileperms($path)), -4);
                
                // Check for permission issues with WordPress context
                $issue_details = $this->get_wordpress_permission_issue($path, $perms, $isDir);
                
                if ($issue_details) {
                    $issue = array(
                        'file_path' => $relative_path,
                        'full_path' => $path,
                        'filename' => basename($path),
                        'current_permissions' => $this->format_permissions_user_friendly($perms, $isDir),
                        'issue' => $issue_details['issue'],
                        'user_friendly_fix' => $issue_details['fix'],
                        'severity' => $issue_details['severity'],
                        'hosting_note' => $issue_details['hosting_note']
                    );
                    
                    $issues[] = $issue;
                    if ($issue_details['severity'] === 'critical') {
                        $critical_issues[] = $issue;
                    }
                }
            }
        }

        $summary = array(
            'total_items_scanned' => $total,
            'items_with_issues'   => count($issues),
            'critical_issues'     => count($critical_issues),
            'has_issues'          => !empty($issues),
            'has_critical_issues' => !empty($critical_issues),
            'notes' => array(
                'scope' => 'Basic permission check for WordPress security',
                'excluded' => 'Cache files, logs, uploads, and development files are excluded',
                'priority' => 'File permissions are less critical than other security issues',
                'hosting_awareness' => 'Permission recommendations may vary based on your hosting environment',
                'critical_note' => count($critical_issues) > 0 ? 'Some files may need attention, but consult your hosting provider first' : null
            )
        );
        
        if ($include_details) {
            // Limit details and prioritize critical issues
            $critical_details = array_slice($critical_issues, 0, 50);
            $warning_details = array_slice(array_diff($issues, $critical_issues), 0, 50);
            
            $summary['details'] = array(
                'critical' => $critical_details,
                'warnings' => $warning_details
            );
            
            // Add truncation info
            if (count($critical_issues) > 50) {
                $summary['details']['critical_truncated'] = count($critical_issues) - 50;
            }
            if (count($issues) - count($critical_issues) > 50) {
                $summary['details']['warnings_truncated'] = (count($issues) - count($critical_issues)) - 50;
            }
            
            $summary['counts'] = array(
                'critical_total' => count($critical_issues),
                'warnings_total' => count($issues) - count($critical_issues)
            );
        }
        
        return array('success' => true, 'report' => $summary);
    }

    /**
     * Get WordPress-aware permission issue with user-friendly messaging
     */
    private function get_wordpress_permission_issue($path, $perms, $isDir) {
        $filename = basename($path);
        $relative_path = str_replace(ABSPATH, '', $path);
        
        // Only flag truly dangerous permission issues
        
        // World-writable files are a real security risk
        if (substr($perms, -1) === '7') {
            return array(
                'severity' => 'critical',
                'issue' => 'This file can be modified by anyone on the server',
                'fix' => 'Contact your hosting provider to secure this file',
                'hosting_note' => 'Your hosting provider should help fix this - don\'t change permissions manually without their guidance'
            );
        }
        
        // Executable PHP files in uploads directory (major security risk)
        if (strpos($path, 'wp-content/uploads/') !== false && pathinfo($path, PATHINFO_EXTENSION) === 'php') {
            return array(
                'severity' => 'critical',
                'issue' => 'PHP files should not exist in the uploads directory',
                'fix' => 'Remove this PHP file from uploads directory - it may be malicious',
                'hosting_note' => 'This is likely a security threat - contact your hosting provider immediately'
            );
        }
        
        // wp-config.php with overly permissive permissions
        if ($filename === 'wp-config.php' && intval($perms) > 644) {
            return array(
                'severity' => 'warning',
                'issue' => 'WordPress configuration file has broad access permissions',
                'fix' => 'Ask your hosting provider to review wp-config.php permissions',
                'hosting_note' => 'Many hosting environments handle this automatically - check with support first'
            );
        }
        
        // Only report other issues if they're severely misconfigured
        if ($isDir && intval($perms) > 777) {
            return array(
                'severity' => 'warning',
                'issue' => 'Directory has unusual permissions',
                'fix' => 'Contact hosting support to review directory permissions',
                'hosting_note' => 'Some hosting environments use different permission schemes'
            );
        }
        
        return null; // No significant issue found
    }
    
    /**
     * Format permissions in user-friendly way
     */
    private function format_permissions_user_friendly($perms, $isDir) {
        $type = $isDir ? 'Directory' : 'File';
        $owner_perms = array();
        $group_perms = array();
        $other_perms = array();
        
        // Owner permissions (first digit after 0)
        $owner = intval($perms[1]);
        if ($owner >= 4) $owner_perms[] = 'read';
        if ($owner >= 2) $owner_perms[] = 'write';
        if ($owner % 2 === 1) $owner_perms[] = 'execute';
        
        // Other permissions (last digit)
        $other = intval($perms[3]);
        if ($other >= 4) $other_perms[] = 'read';
        if ($other >= 2) $other_perms[] = 'write';
        if ($other % 2 === 1) $other_perms[] = 'execute';
        
        $description = $type . ' permissions: Owner can ' . implode(', ', $owner_perms);
        if (!empty($other_perms)) {
            $description .= '; Everyone can ' . implode(', ', $other_perms);
        }
        
        return $description;
    }

    /**
     * Check if a file should be skipped in permission checks
     */
    private function should_skip_permission_check($file) {
        $skip_patterns = array(
            // Files that commonly have different permissions
            'wp-content/cache/',
            'wp-content/uploads/',
            'wp-content/backups/',
            '.log',
            '.tmp',
            '.cache',
            '.DS_Store',
            'Thumbs.db',
            '.git/',
            '.svn/',
            'error_log',
            'debug.log',
            'wp-content/upgrade/',
            'wp-content/languages/', // Language files may have different perms
        );

        $file_lower = strtolower($file);
        
        foreach ($skip_patterns as $pattern) {
            if (strpos($file_lower, strtolower($pattern)) !== false) {
                return true;
            }
        }

        return false;
    }

    /*
     * DEPRECATED: Old harsh permission checking methods - replaced with WordPress-aware alternatives
     * 
    private function assess_permission_issue($path, $perms, $isDir) {
        // This method was too strict and suggested changes that could break WordPress
        // Replaced with get_wordpress_permission_issue()
    }

    private function get_permission_issue_reason($path, $perms, $isDir) {
        // This method generated technical messages not suitable for end users
        // Replaced with user-friendly messaging in get_wordpress_permission_issue()
    }
    */

    /**
     * Inspect security-related HTTP headers.
     */
    public function security_http_headers($args) {
        $response = wp_remote_head(home_url());
        if (is_wp_error($response)) {
            return array('success' => false, 'error' => $response->get_error_message());
        }
        $raw_headers = wp_remote_retrieve_headers($response);

        if (is_array($raw_headers)) {
            $headers = array_change_key_case($raw_headers, CASE_LOWER);
        } elseif (is_object($raw_headers) && method_exists($raw_headers, 'getAll')) {
            $headers = array_change_key_case($raw_headers->getAll(), CASE_LOWER);
        } else {
            $headers = array();
        }

        $expected = array(
            'strict-transport-security' => 'max-age',
            'x-content-type-options'    => 'nosniff',
            'x-frame-options'           => 'SAMEORIGIN',
            'referrer-policy'          => '',
            'permissions-policy'       => '',
            'content-security-policy'  => ''
        );

        $results = array();
        foreach ($expected as $header => $required_value_fragment) {
            if (!isset($headers[$header])) {
                $results[$header] = array('status' => 'warning', 'message' => 'Header missing');
            } elseif ($required_value_fragment && stripos($headers[$header], $required_value_fragment) === false) {
                $results[$header] = array('status' => 'warning', 'message' => 'Header present but may be misconfigured', 'current_value' => $headers[$header]);
            } else {
                $results[$header] = array('status' => 'ok', 'current_value' => $headers[$header]);
            }
        }
        return array('success' => true, 'headers_report' => $results);
    }

    /**
     * Verify HTTPS enforcement and HSTS.
     */
    public function security_https_enforcement($args) {
        $home_is_https = stripos(home_url(), 'https://') === 0;
        $site_is_https = stripos(site_url(), 'https://') === 0;
        $is_ssl        = is_ssl();
        $hsts_header   = null;
        $response      = wp_remote_head(home_url());
        if (!is_wp_error($response)) {
            $hsts_header = wp_remote_retrieve_header($response, 'strict-transport-security');
        }
        $enforced = $home_is_https && $site_is_https && $is_ssl;
        return array('success' => true, 'https_report' => array(
            'home_url_https' => $home_is_https,
            'site_url_https' => $site_is_https,
            'is_ssl'         => $is_ssl,
            'hsts_present'   => !empty($hsts_header),
            'enforced'       => $enforced
        ));
    }

    /**
     * PHP version compliance check.
     */
    public function security_php_version_check($args) {
        $php_version = PHP_VERSION;
        $status      = version_compare($php_version, '8.1', '>=') ? 'ok' : (version_compare($php_version, '7.4', '>=') ? 'warning' : 'critical');
        return array('success' => true, 'php_report' => array(
            'version' => $php_version,
            'status'  => $status,
            'recommendation' => $status === 'ok' ? null : 'Upgrade to PHP 8.1 or later'
        ));
    }

    /**
     * Audit administrator accounts.
     */
    public function security_admin_users_audit($args) {
        $days = isset($args['dormant_days']) ? intval($args['dormant_days']) : 90;
        $threshold = time() - ($days * DAY_IN_SECONDS);

        $admins = get_users(array('role' => 'administrator'));
        $results = array();
        foreach ($admins as $user) {
            $last_login = (int) get_user_meta($user->ID, 'magicassistant_last_login', true);
            $dormant = $last_login && $last_login < $threshold;
            $results[] = array(
                'ID'          => $user->ID,
                'user_login'  => $user->user_login,
                'user_email'  => $user->user_email,
                'registered'  => $user->user_registered,
                'last_login'  => $last_login ? date('Y-m-d H:i:s', $last_login) : null,
                'dormant'     => $dormant
            );
        }
        return array('success' => true, 'administrators' => $results);
    }

    /**
     * Return recent login events captured by the plugin.
     */
    public function security_login_events($args) {
        $limit = isset($args['limit']) ? intval($args['limit']) : 20;
        $events = get_option('magicassistant_login_events', array());
        return array('success' => true, 'events' => array_slice($events, 0, $limit));
    }

    /**
     * Basic file integrity watcher.
     */
    public function security_file_integrity_watch($args) {
        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;
        $reset           = isset($args['reset_baseline']) ? (bool) $args['reset_baseline'] : false;

        $option_key = 'magicassistant_file_hashes';
        $baseline   = get_option($option_key, array());

        if ($reset || empty($baseline)) {
            $snapshot = $this->generate_file_hash_snapshot();
            update_option($option_key, $snapshot, false);
            return array(
                'success' => true, 
                'message' => 'Security-focused baseline snapshot '.($reset ? 'reset' : 'created').'. Monitoring core files, themes, plugins, and critical configurations only.',
                'monitored_files_count' => count($snapshot)
            );
        }

        $current   = $this->generate_file_hash_snapshot();

        $new_files      = array_diff_key($current, $baseline);
        $deleted_files  = array_diff_key($baseline, $current);
        $modified_files = array();
        foreach ($current as $file => $hash) {
            if (isset($baseline[$file]) && $baseline[$file] !== $hash) {
                $modified_files[$file] = array('old' => $baseline[$file], 'new' => $hash);
            }
        }

        // Update baseline for next time
        update_option($option_key, $current, false);

        $summary = array(
            'new_files'      => count($new_files),
            'deleted_files'  => count($deleted_files),
            'modified_files' => count($modified_files),
            'has_changes'    => !empty($new_files) || !empty($deleted_files) || !empty($modified_files),
            'total_monitored_files' => count($current),
            'monitoring_scope' => 'Security-critical files only (excludes logs, cache, uploads)',
            'notes' => array(
                'scope' => 'Monitoring WordPress core files, themes, plugins, and configuration files',
                'excluded' => 'Log files, cache files, uploads (except PHP), and temporary files are excluded',
                'new_files_note' => count($new_files) > 0 ? 'New files detected in monitored locations' : null,
                'deleted_files_note' => count($deleted_files) > 0 ? 'Previously monitored files have been removed' : null,
                'modified_files_note' => count($modified_files) > 0 ? 'Monitored files have been changed since last check' : null
            )
        );
        if ($include_details) {
            // Limit detail arrays to reduce payload size
            $summary['details'] = array(
                'new_files'      => array_slice(array_keys($new_files), 0, 50),
                'deleted_files'  => array_slice(array_keys($deleted_files), 0, 50),
                'modified_files' => array_slice($modified_files, 0, 50, true)
            );
            // Add truncation info if needed
            if (count($new_files) > 50) {
                $summary['details']['new_files_truncated'] = count($new_files) - 50;
            }
            if (count($deleted_files) > 50) {
                $summary['details']['deleted_files_truncated'] = count($deleted_files) - 50;
            }
            if (count($modified_files) > 50) {
                $summary['details']['modified_files_truncated'] = count($modified_files) - 50;
            }
        }
        return array('success' => true, 'integrity_report' => $summary);
    }

    /**
     * Helper to generate file => md5 hash snapshot.
     */
    private function generate_file_hash_snapshot($max_files = 1000) {
        $dirs = array(ABSPATH, WP_CONTENT_DIR);
        $snapshot = array();
        $file_count = 0;
        $priority_files = array();
        $regular_files = array();
        
        // First pass: collect and prioritize files
        foreach ($dirs as $base) {
            if (!is_dir($base)) continue;
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($base, \FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->isDir() || $file->isLink()) continue;
                $rel = str_replace(ABSPATH, '', (string) $file);
                
                // Skip files that are expected to change frequently and are not security critical
                if ($this->should_skip_file_integrity_check($rel)) {
                    continue;
                }
                
                // Only hash reasonably sized files (<5MB) to avoid memory issues
                if ($file->getSize() <= 5 * 1024 * 1024) {
                    // Prioritize critical files
                    if ($this->is_critical_security_file($rel)) {
                        $priority_files[$rel] = $file;
                    } else {
                        $regular_files[$rel] = $file;
                    }
                }
            }
        }
        
        // Process priority files first (always include)
        foreach ($priority_files as $rel => $file) {
            if ($file_count >= $max_files) break;
            $snapshot[$rel] = substr(md5_file($file), 0, 12); // 12-char hash for space efficiency
            $file_count++;
        }
        
        // Random sample from regular files if we have room
        $remaining_slots = $max_files - $file_count;
        if ($remaining_slots > 0 && !empty($regular_files)) {
            if (count($regular_files) > $remaining_slots) {
                $regular_files = array_slice($regular_files, 0, $remaining_slots, true);
            }
            foreach ($regular_files as $rel => $file) {
                $snapshot[$rel] = substr(md5_file($file), 0, 12);
                $file_count++;
            }
        }
        
        return $snapshot;
    }

    /**
     * Check if a file should be skipped in integrity monitoring
     */
    private function should_skip_file_integrity_check($file) {
        // Files/directories that change frequently and are not security-critical
        $skip_patterns = array(
            // Log files
            '.log',
            'debug.log',
            'error_log',
            'access.log',
            
            // Cache files and directories
            '/cache/',
            '.cache',
            '/tmp/',
            '.tmp',
            'wp-content/cache/',
            'wp-content/uploads/cache/',
            
            // Backup files
            '.bak',
            '.backup',
            'wp-content/backups/',
            
            // Update/upgrade temporary files
            'wp-content/upgrade/',
            'wp-content/uploads/wp-migrate-db/',
            
            // Development files
            '.DS_Store',
            'Thumbs.db',
            '.git/',
            '.svn/',
            'node_modules/',
            
            // Session files
            'wp-content/uploads/wpcf7_uploads/',
            
            // Plugin/theme update files
            '.tmp',
            '.zip',
            
            // Database exports
            '.sql',
            
            // Minified/compiled assets that may regenerate
            '.min.css',
            '.min.js',
            
            // Dynamic configuration files that may change
            'wp-content/advanced-cache.php',
            'wp-content/object-cache.php',
            'wp-content/db.php',
            
            // Some file managers create these
            '.quarantine',
            
            // Temporary plugin files
            'wp-content/mu-plugins/mu-plugin.php', // Some plugins auto-generate this
        );

        $file_lower = strtolower($file);
        
        foreach ($skip_patterns as $pattern) {
            if (strpos($file_lower, strtolower($pattern)) !== false) {
                return true;
            }
        }

        // Skip uploads directory except for critical files
        if (strpos($file, 'wp-content/uploads/') === 0) {
            // Only monitor PHP files in uploads (potential security risk)
            return pathinfo($file, PATHINFO_EXTENSION) !== 'php';
        }

        return false;
    }

    /**
     * Check if a file is critical for security monitoring
     */
    private function is_critical_security_file($file) {
        $critical_patterns = array(
            // WordPress core configuration
            'wp-config.php',
            'wp-config-sample.php',
            '.htaccess',
            
            // WordPress core admin files
            'wp-admin/admin.php',
            'wp-admin/admin-ajax.php',
            'wp-admin/index.php',
            'wp-login.php',
            'xmlrpc.php',
            
            // WordPress core includes
            'wp-includes/functions.php',
            'wp-includes/class-wp-user.php',
            'wp-includes/user.php',
            'wp-includes/pluggable.php',
            'wp-includes/wp-db.php',
            
            // Must-use plugins (always loaded)
            'wp-content/mu-plugins/',
            
            // Active theme files (especially index.php, functions.php)
            'wp-content/themes/'.get_template().'/index.php',
            'wp-content/themes/'.get_template().'/functions.php',
            'wp-content/themes/'.get_stylesheet().'/index.php',
            'wp-content/themes/'.get_stylesheet().'/functions.php',
        );
        
        $file_lower = strtolower($file);
        
        foreach ($critical_patterns as $pattern) {
            if (strpos($file_lower, strtolower($pattern)) !== false) {
                return true;
            }
        }
        
        // Any .php file in wp-admin root
        if (preg_match('/^wp-admin\/[^\/]+\.php$/', $file)) {
            return true;
        }
        
        // Any .php file in wp-includes root  
        if (preg_match('/^wp-includes\/[^\/]+\.php$/', $file)) {
            return true;
        }
        
        return false;
    }

    /**
     * Plugins checksum using WP.org zip for each active plugin.
     */
    public function security_plugins_checksum($args) {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!function_exists('plugins_api')) {
            require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        }
        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;
        $plugins = get_plugins();
        $results = array();

        foreach ($plugins as $file => $info) {
            $slug = dirname($file);
            $local_file = WP_PLUGIN_DIR . '/' . $file;
            $local_hash = md5_file($local_file);
            // Fetch remote information
            $api = \plugins_api('plugin_information', array('slug' => $slug, 'per_page' => 1, 'fields' => array('download_link' => true, 'version' => true)));
            if (is_wp_error($api) || empty($api->download_link)) {
                $results[$slug] = array('status' => 'unknown', 'message' => 'Could not fetch plugin info');
                continue;
            }
            $tmp = \download_url($api->download_link);
            if (is_wp_error($tmp)) {
                $results[$slug] = array('status' => 'unknown', 'message' => 'Failed to download remote plugin zip');
                continue;
            }
            $remote_hash = null;
            $zip = new \ZipArchive();
            if ($zip->open($tmp) === true) {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $stat = $zip->statIndex($i);
                    $name = $stat['name'];
                    // Look for main plugin file inside zip
                    if (stripos($name, $file) !== false) {
                        $content = $zip->getFromIndex($i);
                        $remote_hash = md5($content);
                        break;
                    }
                }
                $zip->close();
            }
            unlink($tmp);
            if (!$remote_hash) {
                $results[$slug] = array('status' => 'unknown', 'message' => 'Main file not found in zip');
                continue;
            }
            $status = ($local_hash === $remote_hash) ? 'ok' : 'modified';
            $results[$slug] = array('status' => $status);
            if ($include_details) {
                $results[$slug]['local_hash']  = $local_hash;
                $results[$slug]['remote_hash'] = $remote_hash;
            }
        }
        return array('success' => true, 'plugins_report' => $results);
    }

    /**
     * Themes checksum verification against WP.org.
     */
    public function security_themes_checksum($args) {
        if (!function_exists('themes_api')) {
            $theme_include_files = array(
                ABSPATH . 'wp-admin/includes/theme.php',          // WP 5.5+
                ABSPATH . 'wp-admin/includes/theme-install.php',  // Legacy fallback
            );
            foreach ($theme_include_files as $include_file) {
                if (file_exists($include_file)) {
                    require_once $include_file;
                    if (function_exists('themes_api')) {
                        break;
                    }
                }
            }
        }
        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;
        $results = array();
        $themes = wp_get_themes();

        foreach ($themes as $slug => $theme) {
            $local_file = $theme->get_stylesheet_directory() . '/style.css';
            $local_hash = md5_file($local_file);
            $api = \themes_api('theme_information', array('slug' => $slug, 'fields' => array('download_link' => true)));
            if (is_wp_error($api) || empty($api->download_link)) {
                $results[$slug] = array('status' => 'unknown', 'message' => 'Could not fetch theme info');
                continue;
            }
            $tmp = \download_url($api->download_link);
            if (is_wp_error($tmp)) {
                $results[$slug] = array('status' => 'unknown', 'message' => 'Failed to download remote theme zip');
                continue;
            }
            $remote_hash = null;
            $zip = new \ZipArchive();
            if ($zip->open($tmp) === true) {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $stat = $zip->statIndex($i);
                    $name = $stat['name'];
                    if (stripos($name, $slug . '/style.css') !== false) {
                        $content = $zip->getFromIndex($i);
                        $remote_hash = md5($content);
                        break;
                    }
                }
                $zip->close();
            }
            unlink($tmp);
            if (!$remote_hash) {
                $results[$slug] = array('status' => 'unknown', 'message' => 'style.css not found in zip');
                continue;
            }
            $status = ($local_hash === $remote_hash) ? 'ok' : 'modified';
            $results[$slug] = array('status' => $status);
            if ($include_details) {
                $results[$slug]['local_hash']  = $local_hash;
                $results[$slug]['remote_hash'] = $remote_hash;
            }
        }
        return array('success' => true, 'themes_report' => $results);
    }

    /**
     * Query WPScan for known vulnerabilities.
     */
    public function security_vulnerability_scan($args) {
        $include_details = isset($args['include_details']) ? (bool) $args['include_details'] : false;
        $token = get_option('magicassistant_wpscan_token');
        if (!$token) {
            return array('success' => false, 'error' => 'WPScan API token not configured.');
        }
        $components = array();
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $plugins = get_plugins();
        foreach ($plugins as $file => $info) {
            $components[] = array('type' => 'plugin', 'slug' => dirname($file), 'version' => $info['Version']);
        }
        $themes = wp_get_themes();
        foreach ($themes as $slug => $theme) {
            $components[] = array('type' => 'theme', 'slug' => $slug, 'version' => $theme->get('Version'));
        }

        $found = array();
        foreach ($components as $comp) {
            $url = sprintf('https://wpscan.com/api/v3/%s/%s', $comp['type'] === 'plugin' ? 'plugins' : 'themes', $comp['slug']);
            $response = wp_remote_get($url, array('headers' => array('Authorization' => 'Token token=' . $token)));
            if (is_wp_error($response)) continue;
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            if (empty($data['vulnerabilities'])) continue;
            foreach ($data['vulnerabilities'] as $vuln) {
                // Rough check – if fixed_in exists and our version < fixed_in, vuln applies
                $applies = true;
                if (!empty($vuln['fixed_in']) && $vuln['fixed_in'] !== 'null') {
                    $applies = version_compare($comp['version'], $vuln['fixed_in'], '<');
                }
                if (!$applies) continue;
                $entry = array(
                    'component' => $comp['type'].'/'.$comp['slug'],
                    'title'     => $vuln['title'],
                    'fixed_in'  => $vuln['fixed_in'],
                    'references'=> $vuln['references']
                );
                if ($include_details) {
                    $entry['vuln'] = $vuln;
                }
                $found[] = $entry;
            }
        }
        return array('success' => true, 'vulnerabilities_found' => $found, 'total' => count($found));
    }

    /**
     * Simple .htaccess hardening check.
     */
    public function security_htaccess_protection($args) {
        $file = ABSPATH . '.htaccess';
        if (!file_exists($file)) {
            return array('success' => true, 'htaccess_report' => array('has_htaccess' => false));
        }
        $content = file_get_contents($file);
        $checks = array(
            'wp-includes lock' => strpos($content, 'RewriteRule ^wp-includes') !== false,
            'block xmlrpc'     => strpos($content, 'xmlrpc.php') !== false,
            'protect wp-config'=> strpos($content, 'wp-config.php') !== false,
        );
        $missing = array_keys(array_filter($checks, function($v){ return !$v; }));
        return array('success' => true, 'htaccess_report' => array(
            'has_htaccess' => true,
            'checks'       => $checks,
            'missing_rules'=> $missing,
            'hardened'     => empty($missing)
        ));
    }

    // Site Info Tool implementations
    public function get_site_info($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions to access site information');
        }
        
        return array(
            'site_name' => get_bloginfo('name'),
            'site_url' => get_bloginfo('url'),
            'site_description' => get_bloginfo('description'),
            'site_admin_email' => get_bloginfo('admin_email'),
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'is_multisite' => is_multisite(),
            'plugins' => $this->get_plugins_info(),
            'themes' => array(
                'active' => $this->get_active_theme_info(),
                'all' => $this->get_all_themes_info()
            ),
            'users' => $this->get_users_info(),
            'server_info' => $this->get_server_info(),
            'database_info' => $this->get_database_info(),
            'content_stats' => $this->get_content_stats()
        );
    }
    
    public function wp_list_plugins($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions to access plugin information');
        }
        
        // Load the PluginsInfo utility class
        require_once plugin_dir_path(__FILE__) . 'Utils/PluginsInfo.php';
        
        $plugins_util = new \MagicAssistant\Utils\PluginsInfo();
        $plugins_data = $plugins_util->get_plugins_info();
        
        // Apply filters based on arguments
        $filtered_plugins = $plugins_data['plugins'];
        
        // Filter by status if specified
        if (!empty($args['status']) && $args['status'] !== 'all') {
            $filtered_plugins = array_filter($filtered_plugins, function($plugin) use ($args) {
                return $plugin['status'] === $args['status'];
            });
        }
        
        // Filter by search term if specified
        if (!empty($args['search'])) {
            $search_term = strtolower($args['search']);
            $filtered_plugins = array_filter($filtered_plugins, function($plugin) use ($search_term) {
                return strpos(strtolower($plugin['name']), $search_term) !== false ||
                       strpos(strtolower($plugin['description']), $search_term) !== false ||
                       strpos(strtolower($plugin['author']), $search_term) !== false;
            });
        }
        
        // Re-index the array after filtering
        $filtered_plugins = array_values($filtered_plugins);
        
        // Count statistics
        $active_count = count(array_filter($plugins_data['plugins'], function($plugin) {
            return $plugin['status'] === 'active';
        }));
        
        $inactive_count = count(array_filter($plugins_data['plugins'], function($plugin) {
            return $plugin['status'] === 'inactive';
        }));
        
        $updates_available = count(array_filter($plugins_data['plugins'], function($plugin) {
            return $plugin['update_available'];
        }));
        
        return array(
            'plugins' => $filtered_plugins,
            'total_count' => count($filtered_plugins),
            'total_plugins' => $plugins_data['total_count'],
            'active_count' => $active_count,
            'inactive_count' => $inactive_count,
            'updates_available' => $updates_available,
            'filtered_by' => array(
                'status' => $args['status'] ?? 'all',
                'search' => $args['search'] ?? null
            )
        );
    }
    
    public function wp_get_theme_info($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions to access theme information');
        }
        
        // Load the ThemeInfo utility class
        require_once plugin_dir_path(__FILE__) . 'Utils/ThemeInfo.php';
        
        return \MagicAssistant\Utils\ThemeInfo::get_theme_info($args);
    }
    
    public function wp_list_themes($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions to access theme information');
        }
        
        // Load the ThemeInfo utility class
        require_once plugin_dir_path(__FILE__) . 'Utils/ThemeInfo.php';
        
        $themes_data = \MagicAssistant\Utils\ThemeInfo::get_all_themes_info($args);
        
        // Apply search filter if specified
        $filtered_themes = $themes_data['themes'];
        
        if (!empty($args['search'])) {
            $search_term = strtolower($args['search']);
            $filtered_themes = array_filter($filtered_themes, function($theme) use ($search_term) {
                return strpos(strtolower($theme['name']), $search_term) !== false ||
                       strpos(strtolower($theme['description']), $search_term) !== false ||
                       strpos(strtolower($theme['author']), $search_term) !== false;
            });
        }
        
        // Re-index the array after filtering
        $filtered_themes = array_values($filtered_themes);
        
        // Count statistics
        $active_count = count(array_filter($themes_data['themes'], function($theme) {
            return $theme['is_active'];
        }));
        
        $inactive_count = count(array_filter($themes_data['themes'], function($theme) {
            return !$theme['is_active'];
        }));
        
        $updates_available = count(array_filter($themes_data['themes'], function($theme) {
            return $theme['update_available'];
        }));
        
        return array(
            'themes' => $filtered_themes,
            'total_count' => count($filtered_themes),
            'total_themes' => $themes_data['total_count'],
            'active_count' => $active_count,
            'inactive_count' => $inactive_count,
            'updates_available' => $updates_available,
            'active_theme' => $themes_data['active_theme'],
            'filtered_by' => array(
                'search' => $args['search'] ?? null
            )
        );
    }
    
    // Helper methods for site info
    private function get_plugins_info() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        $network_active_plugins = is_multisite() ? get_site_option('active_sitewide_plugins', array()) : array();
        
        $plugins_info = array(
            'total' => count($all_plugins),
            'active' => count($active_plugins) + count($network_active_plugins),
            'inactive' => count($all_plugins) - (count($active_plugins) + count($network_active_plugins)),
            'list' => array()
        );
        
        foreach ($all_plugins as $plugin_file => $plugin_data) {
            $is_active = in_array($plugin_file, $active_plugins) || array_key_exists($plugin_file, $network_active_plugins);
            $is_network_active = array_key_exists($plugin_file, $network_active_plugins);
            
            $plugins_info['list'][] = array(
                'name' => $plugin_data['Name'],
                'version' => $plugin_data['Version'],
                'description' => $plugin_data['Description'],
                'author' => $plugin_data['Author'],
                'author_uri' => $plugin_data['AuthorURI'],
                'plugin_uri' => $plugin_data['PluginURI'],
                'file' => $plugin_file,
                'is_active' => $is_active,
                'is_network_active' => $is_network_active,
                'requires_wp' => $plugin_data['RequiresWP'] ?? '',
                'tested_up_to' => $plugin_data['TestedUpTo'] ?? '',
                'requires_php' => $plugin_data['RequiresPHP'] ?? ''
            );
        }
        
        return $plugins_info;
    }
    
    private function get_active_theme_info() {
        $theme = wp_get_theme();
        $parent_theme = $theme->parent();
        
        $theme_info = array(
            'name' => $theme->get('Name'),
            'version' => $theme->get('Version'),
            'description' => $theme->get('Description'),
            'author' => $theme->get('Author'),
            'author_uri' => $theme->get('AuthorURI'),
            'theme_uri' => $theme->get('ThemeURI'),
            'template' => $theme->get_template(),
            'stylesheet' => $theme->get_stylesheet(),
            'is_child_theme' => !empty($parent_theme),
            'screenshot' => $theme->get_screenshot(),
            'tags' => $theme->get('Tags'),
            'requires_wp' => $theme->get('RequiresWP'),
            'requires_php' => $theme->get('RequiresPHP'),
            'text_domain' => $theme->get('TextDomain')
        );
        
        if (!empty($parent_theme)) {
            $theme_info['parent_theme'] = array(
                'name' => $parent_theme->get('Name'),
                'version' => $parent_theme->get('Version'),
                'template' => $parent_theme->get_template()
            );
        }
        
        return $theme_info;
    }
    
    private function get_all_themes_info() {
        $themes = wp_get_themes();
        $themes_info = array(
            'total' => count($themes),
            'list' => array()
        );
        
        foreach ($themes as $theme_slug => $theme) {
            $themes_info['list'][] = array(
                'name' => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'description' => $theme->get('Description'),
                'author' => $theme->get('Author'),
                'template' => $theme->get_template(),
                'stylesheet' => $theme->get_stylesheet(),
                'is_active' => ($theme_slug === get_option('stylesheet')),
                'screenshot' => $theme->get_screenshot()
            );
        }
        
        return $themes_info;
    }
    
    private function get_users_info() {
        $user_count = count_users();
        $users_info = array(
            'total' => $user_count['total_users'],
            'by_role' => $user_count['avail_roles'],
            'recent_users' => array()
        );
        
        // Get recent users (last 10)
        $recent_users = get_users(array(
            'number' => 10,
            'orderby' => 'registered',
            'order' => 'DESC',
            'fields' => array('ID', 'user_login', 'user_email', 'display_name', 'user_registered')
        ));
        
        foreach ($recent_users as $user) {
            $user_meta = get_userdata($user->ID);
            $users_info['recent_users'][] = array(
                'id' => $user->ID,
                'username' => $user->user_login,
                'display_name' => $user->display_name,
                'email' => $user->user_email,
                'registered' => $user->user_registered,
                'roles' => $user_meta->roles
            );
        }
        
        return $users_info;
    }
    
    private function get_server_info() {
        global $wpdb;
        
        return array(
            'php_version' => PHP_VERSION,
            'mysql_version' => $wpdb->db_version(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'max_execution_time' => ini_get('max_execution_time'),
            'memory_limit' => ini_get('memory_limit'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'max_input_vars' => ini_get('max_input_vars'),
            'wp_memory_limit' => WP_MEMORY_LIMIT,
            'wp_max_memory_limit' => WP_MAX_MEMORY_LIMIT,
            'wp_debug' => defined('WP_DEBUG') && WP_DEBUG,
            'wp_debug_log' => defined('WP_DEBUG_LOG') && WP_DEBUG_LOG,
            'wp_debug_display' => defined('WP_DEBUG_DISPLAY') && WP_DEBUG_DISPLAY
        );
    }
    
    private function get_database_info() {
        global $wpdb;
        
        $db_info = array(
            'database_name' => DB_NAME,
            'database_host' => DB_HOST,
            'database_charset' => DB_CHARSET,
            'database_collate' => DB_COLLATE,
            'table_prefix' => $wpdb->prefix,
            'tables' => array()
        );
        
        // Get table information
        $tables = $wpdb->get_results("SHOW TABLE STATUS", ARRAY_A);
        foreach ($tables as $table) {
            $db_info['tables'][] = array(
                'name' => $table['Name'],
                'engine' => $table['Engine'],
                'rows' => intval($table['Rows']),
                'data_length' => intval($table['Data_length']),
                'index_length' => intval($table['Index_length']),
                'collation' => $table['Collation']
            );
        }
        
        return $db_info;
    }
    
    private function get_content_stats() {
        $post_counts = wp_count_posts();
        $page_counts = wp_count_posts('page');
        $comment_counts = wp_count_comments();
        
        return array(
            'posts' => array(
                'published' => intval($post_counts->publish),
                'draft' => intval($post_counts->draft),
                'private' => intval($post_counts->private),
                'trash' => intval($post_counts->trash),
                'total' => intval($post_counts->publish) + intval($post_counts->draft) + intval($post_counts->private)
            ),
            'pages' => array(
                'published' => intval($page_counts->publish),
                'draft' => intval($page_counts->draft),
                'private' => intval($page_counts->private),
                'trash' => intval($page_counts->trash),
                'total' => intval($page_counts->publish) + intval($page_counts->draft) + intval($page_counts->private)
            ),
            'comments' => array(
                'approved' => intval($comment_counts->approved),
                'pending' => intval($comment_counts->moderated),
                'spam' => intval($comment_counts->spam),
                'trash' => intval($comment_counts->trash),
                'total' => intval($comment_counts->total_comments)
            ),
            'media' => array(
                'total' => array_sum((array) wp_count_attachments())
            ),
            'categories' => wp_count_terms('category'),
            'tags' => wp_count_terms('post_tag')
        );
    }
    
    private function register_users_tools() {
        // wp_users_search - Search and filter WordPress users with pagination
        $this->register_tool(array(
            'name' => 'wp_users_search',
            'description' => 'Search and filter WordPress users with pagination',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in user login, email, display name'),
                    'role' => array('type' => 'string', 'description' => 'Filter by user role (administrator, editor, author, contributor, subscriber)'),
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination (starts from 1)', 'default' => 1),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of users per page', 'default' => 10),
                    'orderby' => array('type' => 'string', 'description' => 'Order by: login, email, display_name, registered, post_count'),
                    'order' => array('type' => 'string', 'description' => 'Sort order: asc or desc'),
                    'has_published_posts' => array('type' => 'boolean', 'description' => 'Filter users who have published posts')
                )
            ),
            'callback' => array($this, 'wp_users_search')
        ));
        
        // wp_get_user - Get a WordPress user by ID
        $this->register_tool(array(
            'name' => 'wp_get_user',
            'description' => 'Get a WordPress user by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the user to get'),
                    'context' => array('type' => 'string', 'description' => 'Request context (view, edit, embed)')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_get_user')
        ));
        
        // wp_add_user - Add a new WordPress user
        $this->register_tool(array(
            'name' => 'wp_add_user',
            'description' => 'Add a new WordPress user',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'username' => array('type' => 'string', 'description' => 'The username for the new user'),
                    'email' => array('type' => 'string', 'description' => 'The email address for the new user'),
                    'password' => array('type' => 'string', 'description' => 'The password for the new user'),
                    'first_name' => array('type' => 'string', 'description' => 'The first name of the user'),
                    'last_name' => array('type' => 'string', 'description' => 'The last name of the user'),
                    'display_name' => array('type' => 'string', 'description' => 'The display name of the user'),
                    'role' => array('type' => 'string', 'description' => 'The role for the new user (administrator, editor, author, contributor, subscriber)'),
                    'description' => array('type' => 'string', 'description' => 'Biographical info about the user'),
                    'url' => array('type' => 'string', 'description' => 'The user\'s website URL')
                ),
                'required' => array('username', 'email', 'password')
            ),
            'callback' => array($this, 'wp_add_user')
        ));
        
        // wp_update_user - Update a WordPress user by ID
        $this->register_tool(array(
            'name' => 'wp_update_user',
            'description' => 'Update a WordPress user by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the user to update'),
                    'username' => array('type' => 'string', 'description' => 'The username (cannot be changed after creation)'),
                    'email' => array('type' => 'string', 'description' => 'The email address'),
                    'password' => array('type' => 'string', 'description' => 'New password for the user'),
                    'first_name' => array('type' => 'string', 'description' => 'The first name of the user'),
                    'last_name' => array('type' => 'string', 'description' => 'The last name of the user'),
                    'display_name' => array('type' => 'string', 'description' => 'The display name of the user'),
                    'role' => array('type' => 'string', 'description' => 'The role for the user'),
                    'description' => array('type' => 'string', 'description' => 'Biographical info about the user'),
                    'url' => array('type' => 'string', 'description' => 'The user\'s website URL')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_update_user')
        ));
        
        // wp_delete_user - Delete a WordPress user by ID
        $this->register_tool(array(
            'name' => 'wp_delete_user',
            'description' => 'Delete a WordPress user by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the user to delete'),
                    'reassign' => array('type' => 'integer', 'description' => 'ID of user to reassign posts to (required if user has posts)')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wp_delete_user')
        ));
        
        // wp_get_current_user - Get the current logged-in user
        $this->register_tool(array(
            'name' => 'wp_get_current_user',
            'description' => 'Get the current logged-in user',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'context' => array('type' => 'string', 'description' => 'Request context (view, edit, embed)')
                )
            ),
            'callback' => array($this, 'wp_get_current_user')
        ));
        
        // wp_update_current_user - Update the current logged-in user
        $this->register_tool(array(
            'name' => 'wp_update_current_user',
            'description' => 'Update the current logged-in user',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'email' => array('type' => 'string', 'description' => 'The email address'),
                    'password' => array('type' => 'string', 'description' => 'New password'),
                    'first_name' => array('type' => 'string', 'description' => 'The first name'),
                    'last_name' => array('type' => 'string', 'description' => 'The last name'),
                    'display_name' => array('type' => 'string', 'description' => 'The display name'),
                    'description' => array('type' => 'string', 'description' => 'Biographical info'),
                    'url' => array('type' => 'string', 'description' => 'The website URL')
                )
            ),
            'callback' => array($this, 'wp_update_current_user')
        ));
    }
    
    // Users Tool implementations
    public function wp_users_search($args) {
        if (!current_user_can('list_users')) {
            throw new Exception('Insufficient permissions to search users');
        }
        
        $page = isset($args['page']) ? max(1, intval($args['page'])) : 1;
        $per_page = isset($args['per_page']) ? max(1, intval($args['per_page'])) : 10;
        
        $query_args = array(
            'number' => $per_page,
            'offset' => ($page - 1) * $per_page,
            'fields' => 'all'
        );
        
        if (!empty($args['search'])) {
            $query_args['search'] = '*' . sanitize_text_field($args['search']) . '*';
            $query_args['search_columns'] = array('user_login', 'user_email', 'display_name');
        }
        
        if (!empty($args['role'])) {
            $query_args['role'] = sanitize_text_field($args['role']);
        }
        
        if (!empty($args['orderby'])) {
            $query_args['orderby'] = sanitize_text_field($args['orderby']);
        }
        
        if (!empty($args['order'])) {
            $query_args['order'] = sanitize_text_field($args['order']);
        }
        
        if (isset($args['has_published_posts']) && $args['has_published_posts']) {
            $query_args['has_published_posts'] = true;
        }
        
        $user_query = new WP_User_Query($query_args);
        $users = $user_query->get_results();
        $total_users = $user_query->get_total();
        
        $formatted_users = array();
        
        foreach ($users as $user) {
            $user_data = array(
                'id' => $user->ID,
                'username' => $user->user_login,
                'email' => $user->user_email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'display_name' => $user->display_name,
                'registered' => $user->user_registered,
                'roles' => $user->roles,
                'capabilities' => $user->allcaps,
                'avatar_url' => get_avatar_url($user->ID),
                'description' => $user->description,
                'url' => $user->user_url,
                'post_count' => count_user_posts($user->ID),
                'edit_link' => get_edit_user_link($user->ID)
            );
            
            $formatted_users[] = $user_data;
        }
        
        return array(
            'users' => $formatted_users,
            'total' => $total_users,
            'pages' => ceil($total_users / $per_page),
            'current_page' => $page,
            'per_page' => $per_page
        );
    }
    
    public function wp_get_user($args) {
        $id = intval($args['id']);
        
        if (!current_user_can('edit_user', $id) && get_current_user_id() !== $id) {
            throw new Exception('Insufficient permissions to view this user');
        }
        
        $user = get_userdata($id);
        
        if (!$user) {
            throw new Exception('User not found: ' . $id);
        }
        
        return array(
            'id' => $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'display_name' => $user->display_name,
            'registered' => $user->user_registered,
            'roles' => $user->roles,
            'capabilities' => $user->allcaps,
            'avatar_url' => get_avatar_url($user->ID),
            'description' => $user->description,
            'url' => $user->user_url,
            'post_count' => count_user_posts($user->ID),
            'edit_link' => get_edit_user_link($user->ID),
            'meta' => get_user_meta($user->ID)
        );
    }
    
    public function wp_add_user($args) {
        if (!current_user_can('create_users')) {
            throw new Exception('Insufficient permissions to create users');
        }
        
        $username = sanitize_user($args['username']);
        $email = sanitize_email($args['email']);
        $password = $args['password'];
        
        // Validate required fields
        if (empty($username)) {
            throw new Exception('Username is required');
        }
        
        if (empty($email) || !is_email($email)) {
            throw new Exception('Valid email address is required');
        }
        
        if (empty($password)) {
            throw new Exception('Password is required');
        }
        
        // Check if username or email already exists
        if (username_exists($username)) {
            throw new Exception('Username already exists: ' . $username);
        }
        
        if (email_exists($email)) {
            throw new Exception('Email address already exists: ' . $email);
        }
        
        $user_data = array(
            'user_login' => $username,
            'user_email' => $email,
            'user_pass' => $password
        );
        
        if (!empty($args['first_name'])) {
            $user_data['first_name'] = sanitize_text_field($args['first_name']);
        }
        
        if (!empty($args['last_name'])) {
            $user_data['last_name'] = sanitize_text_field($args['last_name']);
        }
        
        if (!empty($args['display_name'])) {
            $user_data['display_name'] = sanitize_text_field($args['display_name']);
        }
        
        if (!empty($args['description'])) {
            $user_data['description'] = sanitize_textarea_field($args['description']);
        }
        
        if (!empty($args['url'])) {
            $user_data['user_url'] = esc_url_raw($args['url']);
        }
        
        if (!empty($args['role'])) {
            $user_data['role'] = sanitize_text_field($args['role']);
        }
        
        $user_id = wp_insert_user($user_data);
        
        if (is_wp_error($user_id)) {
            throw new Exception('Failed to create user: ' . $user_id->get_error_message());
        }
        
        $user = get_userdata($user_id);
        
        return array(
            'id' => $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'display_name' => $user->display_name,
            'registered' => $user->user_registered,
            'roles' => $user->roles,
            'edit_link' => get_edit_user_link($user->ID)
        );
    }
    
    public function wp_update_user($args) {
        $id = intval($args['id']);
        
        if (!current_user_can('edit_user', $id) && get_current_user_id() !== $id) {
            throw new Exception('Insufficient permissions to update this user');
        }
        
        $user = get_userdata($id);
        
        if (!$user) {
            throw new Exception('User not found: ' . $id);
        }
        
        $user_data = array('ID' => $id);
        
        if (!empty($args['email'])) {
            $email = sanitize_email($args['email']);
            if (!is_email($email)) {
                throw new Exception('Invalid email address');
            }
            
            // Check if email already exists for another user
            $existing_user = get_user_by('email', $email);
            if ($existing_user && $existing_user->ID !== $id) {
                throw new Exception('Email address already exists for another user');
            }
            
            $user_data['user_email'] = $email;
        }
        
        if (!empty($args['password'])) {
            $user_data['user_pass'] = $args['password'];
        }
        
        if (isset($args['first_name'])) {
            $user_data['first_name'] = sanitize_text_field($args['first_name']);
        }
        
        if (isset($args['last_name'])) {
            $user_data['last_name'] = sanitize_text_field($args['last_name']);
        }
        
        if (!empty($args['display_name'])) {
            $user_data['display_name'] = sanitize_text_field($args['display_name']);
        }
        
        if (isset($args['description'])) {
            $user_data['description'] = sanitize_textarea_field($args['description']);
        }
        
        if (isset($args['url'])) {
            $user_data['user_url'] = esc_url_raw($args['url']);
        }
        
        if (!empty($args['role']) && current_user_can('edit_users')) {
            $user_data['role'] = sanitize_text_field($args['role']);
        }
        
        $result = wp_update_user($user_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update user: ' . $result->get_error_message());
        }
        
        $updated_user = get_userdata($id);
        
        return array(
            'id' => $updated_user->ID,
            'username' => $updated_user->user_login,
            'email' => $updated_user->user_email,
            'first_name' => $updated_user->first_name,
            'last_name' => $updated_user->last_name,
            'display_name' => $updated_user->display_name,
            'registered' => $updated_user->user_registered,
            'roles' => $updated_user->roles,
            'edit_link' => get_edit_user_link($updated_user->ID)
        );
    }
    
    public function wp_delete_user($args) {
        $id = intval($args['id']);
        
        if (!current_user_can('delete_users')) {
            throw new Exception('Insufficient permissions to delete users');
        }
        
        $user = get_userdata($id);
        
        if (!$user) {
            throw new Exception('User not found: ' . $id);
        }
        
        // Prevent deleting current user
        if (get_current_user_id() === $id) {
            throw new Exception('Cannot delete your own user account');
        }
        
        // Check if user has posts and reassign parameter is provided
        $post_count = count_user_posts($id);
        $reassign_id = isset($args['reassign']) ? intval($args['reassign']) : null;
        
        if ($post_count > 0 && !$reassign_id) {
            throw new Exception('User has ' . $post_count . ' posts. Please provide a reassign user ID.');
        }
        
        if ($reassign_id && !get_userdata($reassign_id)) {
            throw new Exception('Reassign user not found: ' . $reassign_id);
        }
        
        $result = wp_delete_user($id, $reassign_id);
        
        if (!$result) {
            throw new Exception('Failed to delete user');
        }
        
        return array(
            'deleted' => true,
            'id' => $id,
            'reassigned_to' => $reassign_id,
            'posts_reassigned' => $post_count
        );
    }
    
    public function wp_get_current_user($args) {
        $current_user_id = get_current_user_id();
        
        if (!$current_user_id) {
            throw new Exception('No user is currently logged in');
        }
        
        $user = get_userdata($current_user_id);
        
        return array(
            'id' => $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'display_name' => $user->display_name,
            'registered' => $user->user_registered,
            'roles' => $user->roles,
            'capabilities' => $user->allcaps,
            'avatar_url' => get_avatar_url($user->ID),
            'description' => $user->description,
            'url' => $user->user_url,
            'post_count' => count_user_posts($user->ID),
            'edit_link' => get_edit_user_link($user->ID)
        );
    }
    
    public function wp_update_current_user($args) {
        $current_user_id = get_current_user_id();
        
        if (!$current_user_id) {
            throw new Exception('No user is currently logged in');
        }
        
        $user_data = array('ID' => $current_user_id);
        
        if (!empty($args['email'])) {
            $email = sanitize_email($args['email']);
            if (!is_email($email)) {
                throw new Exception('Invalid email address');
            }
            
            // Check if email already exists for another user
            $existing_user = get_user_by('email', $email);
            if ($existing_user && $existing_user->ID !== $current_user_id) {
                throw new Exception('Email address already exists for another user');
            }
            
            $user_data['user_email'] = $email;
        }
        
        if (!empty($args['password'])) {
            $user_data['user_pass'] = $args['password'];
        }
        
        if (isset($args['first_name'])) {
            $user_data['first_name'] = sanitize_text_field($args['first_name']);
        }
        
        if (isset($args['last_name'])) {
            $user_data['last_name'] = sanitize_text_field($args['last_name']);
        }
        
        if (!empty($args['display_name'])) {
            $user_data['display_name'] = sanitize_text_field($args['display_name']);
        }
        
        if (isset($args['description'])) {
            $user_data['description'] = sanitize_textarea_field($args['description']);
        }
        
        if (isset($args['url'])) {
            $user_data['user_url'] = esc_url_raw($args['url']);
        }
        
        $result = wp_update_user($user_data);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update user: ' . $result->get_error_message());
        }
        
        $updated_user = get_userdata($current_user_id);
        
        return array(
            'id' => $updated_user->ID,
            'username' => $updated_user->user_login,
            'email' => $updated_user->user_email,
            'first_name' => $updated_user->first_name,
            'last_name' => $updated_user->last_name,
            'display_name' => $updated_user->display_name,
            'registered' => $updated_user->user_registered,
            'roles' => $updated_user->roles,
            'edit_link' => get_edit_user_link($updated_user->ID)
        );
    }
    
    private function register_woocommerce_tools() {
        // Only register tools if WooCommerce is active
        if (!$this->is_woocommerce_active()) {
            return;
        }
        
        // wc_orders_search - Get a list of WooCommerce orders
        $this->register_tool(array(
            'name' => 'wc_orders_search',
            'description' => 'Get a list of WooCommerce orders with filtering and pagination',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination', 'default' => 1),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of orders per page', 'default' => 10),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'after' => array('type' => 'string', 'description' => 'Limit response to orders created after a given ISO8601 compliant date'),
                    'before' => array('type' => 'string', 'description' => 'Limit response to orders created before a given ISO8601 compliant date'),
                    'status' => array('type' => 'string', 'description' => 'Limit result set to orders with specific status (pending, processing, on-hold, completed, cancelled, refunded, failed, trash)'),
                    'customer' => array('type' => 'integer', 'description' => 'Limit result set to orders assigned to a specific customer'),
                    'product' => array('type' => 'integer', 'description' => 'Limit result set to orders assigned to a specific product'),
                    'orderby' => array('type' => 'string', 'description' => 'Sort collection by object attribute (date, id, include, title, slug)'),
                    'order' => array('type' => 'string', 'description' => 'Order sort attribute ascending or descending (asc, desc)')
                )
            ),
            'callback' => array($this, 'wc_orders_search')
        ));
        
        // WooCommerce Reports Tools
        $this->register_tool(array(
            'name' => 'wc_reports_coupons_totals',
            'description' => 'Get WooCommerce coupons totals report',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wc_reports_coupons_totals')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_reports_customers_totals',
            'description' => 'Get WooCommerce customers totals report',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wc_reports_customers_totals')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_reports_orders_totals',
            'description' => 'Get WooCommerce orders totals report',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wc_reports_orders_totals')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_reports_products_totals',
            'description' => 'Get WooCommerce products totals report',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wc_reports_products_totals')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_reports_reviews_totals',
            'description' => 'Get WooCommerce reviews totals report',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => new \stdClass()
            ),
            'callback' => array($this, 'wc_reports_reviews_totals')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_reports_sales',
            'description' => 'Get WooCommerce sales report',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'period' => array('type' => 'string', 'description' => 'Report period (week, month, last_month, year)'),
                    'date_min' => array('type' => 'string', 'description' => 'Return sales for a specific start date (YYYY-MM-DD)'),
                    'date_max' => array('type' => 'string', 'description' => 'Return sales for a specific end date (YYYY-MM-DD)')
                )
            ),
            'callback' => array($this, 'wc_reports_sales')
        ));
        
        // WooCommerce Product Tools
        $this->register_tool(array(
            'name' => 'wc_products_search',
            'description' => 'Search and filter WooCommerce products with pagination',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination', 'default' => 1),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of products per page', 'default' => 10),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'after' => array('type' => 'string', 'description' => 'Limit response to products created after a given ISO8601 compliant date'),
                    'before' => array('type' => 'string', 'description' => 'Limit response to products created before a given ISO8601 compliant date'),
                    'status' => array('type' => 'string', 'description' => 'Limit result set to products with specific status (draft, pending, private, publish)'),
                    'type' => array('type' => 'string', 'description' => 'Limit result set to products with specific type (simple, grouped, external, variable)'),
                    'sku' => array('type' => 'string', 'description' => 'Limit result set to products with specific SKU'),
                    'featured' => array('type' => 'boolean', 'description' => 'Limit result set to featured products'),
                    'category' => array('type' => 'string', 'description' => 'Limit result set to products assigned to a specific category ID'),
                    'tag' => array('type' => 'string', 'description' => 'Limit result set to products assigned to a specific tag ID'),
                    'on_sale' => array('type' => 'boolean', 'description' => 'Limit result set to products on sale'),
                    'min_price' => array('type' => 'string', 'description' => 'Limit result set to products with a minimum price'),
                    'max_price' => array('type' => 'string', 'description' => 'Limit result set to products with a maximum price'),
                    'stock_status' => array('type' => 'string', 'description' => 'Limit result set to products with specified stock status (instock, outofstock, onbackorder)'),
                    'orderby' => array('type' => 'string', 'description' => 'Sort collection by object attribute (date, id, include, title, slug, price, popularity, rating, menu_order)'),
                    'order' => array('type' => 'string', 'description' => 'Order sort attribute ascending or descending (asc, desc)')
                )
            ),
            'callback' => array($this, 'wc_products_search')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_get_product',
            'description' => 'Get a WooCommerce product by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the product to get')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_get_product')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_add_product',
            'description' => 'Add a new WooCommerce product',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'name' => array('type' => 'string', 'description' => 'Product name'),
                    'type' => array('type' => 'string', 'description' => 'Product type (simple, grouped, external, variable)'),
                    'regular_price' => array('type' => 'string', 'description' => 'Product regular price'),
                    'sale_price' => array('type' => 'string', 'description' => 'Product sale price'),
                    'description' => array('type' => 'string', 'description' => 'Product description'),
                    'short_description' => array('type' => 'string', 'description' => 'Product short description'),
                    'sku' => array('type' => 'string', 'description' => 'Unique identifier'),
                    'manage_stock' => array('type' => 'boolean', 'description' => 'Stock management at product level'),
                    'stock_quantity' => array('type' => 'integer', 'description' => 'Stock quantity'),
                    'stock_status' => array('type' => 'string', 'description' => 'Controls the stock status of the product (instock, outofstock, onbackorder)'),
                    'weight' => array('type' => 'string', 'description' => 'Product weight'),
                    'dimensions' => array(
                        'type' => 'object',
                        'description' => 'Product dimensions',
                        'properties' => array(
                            'length' => array('type' => 'string', 'description' => 'Product length'),
                            'width' => array('type' => 'string', 'description' => 'Product width'),
                            'height' => array('type' => 'string', 'description' => 'Product height')
                        )
                    ),
                    'categories' => array(
                        'type' => 'array',
                        'description' => 'List of categories',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'id' => array('type' => 'integer', 'description' => 'Category ID')
                            ),
                            'required' => array('id')
                        )
                    ),
                    'tags' => array(
                        'type' => 'array',
                        'description' => 'List of tags',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'id' => array('type' => 'integer', 'description' => 'Tag ID')
                            ),
                            'required' => array('id')
                        )
                    ),
                    'images' => array(
                        'type' => 'array',
                        'description' => 'List of images',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'id' => array('type' => 'integer', 'description' => 'Image attachment ID'),
                                'src' => array('type' => 'string', 'description' => 'Image URL'),
                                'name' => array('type' => 'string', 'description' => 'Image name'),
                                'alt' => array('type' => 'string', 'description' => 'Image alternative text')
                            )
                        )
                    ),
                    'status' => array('type' => 'string', 'description' => 'Product status (draft, pending, private, publish)')
                ),
                'required' => array('name')
            ),
            'callback' => array($this, 'wc_add_product')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_update_product',
            'description' => 'Update a WooCommerce product by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the product to update'),
                    'name' => array('type' => 'string', 'description' => 'Product name'),
                    'type' => array('type' => 'string', 'description' => 'Product type'),
                    'regular_price' => array('type' => 'string', 'description' => 'Product regular price'),
                    'sale_price' => array('type' => 'string', 'description' => 'Product sale price'),
                    'description' => array('type' => 'string', 'description' => 'Product description'),
                    'short_description' => array('type' => 'string', 'description' => 'Product short description'),
                    'sku' => array('type' => 'string', 'description' => 'Unique identifier'),
                    'manage_stock' => array('type' => 'boolean', 'description' => 'Stock management at product level'),
                    'stock_quantity' => array('type' => 'integer', 'description' => 'Stock quantity'),
                    'stock_status' => array('type' => 'string', 'description' => 'Controls the stock status of the product'),
                    'weight' => array('type' => 'string', 'description' => 'Product weight'),
                    'status' => array('type' => 'string', 'description' => 'Product status')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_update_product')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_delete_product',
            'description' => 'Delete a WooCommerce product by ID',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the product to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_delete_product')
        ));
        
        // WooCommerce Product Category Tools
        $this->register_tool(array(
            'name' => 'wc_list_product_categories',
            'description' => 'List all WooCommerce product categories',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of categories per page'),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'parent' => array('type' => 'integer', 'description' => 'Limit result set to categories assigned to a specific parent'),
                    'hide_empty' => array('type' => 'boolean', 'description' => 'Whether to hide categories not assigned to any products')
                )
            ),
            'callback' => array($this, 'wc_list_product_categories')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_add_product_category',
            'description' => 'Add a new WooCommerce product category',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'name' => array('type' => 'string', 'description' => 'Category name'),
                    'slug' => array('type' => 'string', 'description' => 'Category slug'),
                    'parent' => array('type' => 'integer', 'description' => 'The ID for the parent of the category'),
                    'description' => array('type' => 'string', 'description' => 'HTML description of the category'),
                    'display' => array('type' => 'string', 'description' => 'Category archive display type (default, products, subcategories, both)'),
                    'image' => array(
                        'type' => 'object',
                        'description' => 'Image data',
                        'properties' => array(
                            'id' => array('type' => 'integer', 'description' => 'Image attachment ID'),
                            'src' => array('type' => 'string', 'description' => 'Image URL'),
                            'name' => array('type' => 'string', 'description' => 'Image name'),
                            'alt' => array('type' => 'string', 'description' => 'Image alternative text')
                        )
                    )
                ),
                'required' => array('name')
            ),
            'callback' => array($this, 'wc_add_product_category')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_update_product_category',
            'description' => 'Update a WooCommerce product category',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the category to update'),
                    'name' => array('type' => 'string', 'description' => 'Category name'),
                    'slug' => array('type' => 'string', 'description' => 'Category slug'),
                    'parent' => array('type' => 'integer', 'description' => 'The ID for the parent of the category'),
                    'description' => array('type' => 'string', 'description' => 'HTML description of the category'),
                    'display' => array('type' => 'string', 'description' => 'Category archive display type')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_update_product_category')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_delete_product_category',
            'description' => 'Delete a WooCommerce product category',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the category to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_delete_product_category')
        ));
        
        // WooCommerce Product Tag Tools
        $this->register_tool(array(
            'name' => 'wc_list_product_tags',
            'description' => 'List all WooCommerce product tags',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'page' => array('type' => 'integer', 'description' => 'Page number for pagination'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of tags per page'),
                    'search' => array('type' => 'string', 'description' => 'Search term'),
                    'hide_empty' => array('type' => 'boolean', 'description' => 'Whether to hide tags not assigned to any products')
                )
            ),
            'callback' => array($this, 'wc_list_product_tags')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_add_product_tag',
            'description' => 'Add a new WooCommerce product tag',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'name' => array('type' => 'string', 'description' => 'Tag name'),
                    'slug' => array('type' => 'string', 'description' => 'Tag slug'),
                    'description' => array('type' => 'string', 'description' => 'HTML description of the tag')
                ),
                'required' => array('name')
            ),
            'callback' => array($this, 'wc_add_product_tag')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_update_product_tag',
            'description' => 'Update a WooCommerce product tag',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the tag to update'),
                    'name' => array('type' => 'string', 'description' => 'Tag name'),
                    'slug' => array('type' => 'string', 'description' => 'Tag slug'),
                    'description' => array('type' => 'string', 'description' => 'HTML description of the tag')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_update_product_tag')
        ));
        
        $this->register_tool(array(
            'name' => 'wc_delete_product_tag',
            'description' => 'Delete a WooCommerce product tag',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'id' => array('type' => 'integer', 'description' => 'The ID of the tag to delete'),
                    'force' => array('type' => 'boolean', 'description' => 'Whether to bypass trash and force deletion')
                ),
                'required' => array('id')
            ),
            'callback' => array($this, 'wc_delete_product_tag')
        ));
    }
    
    // Helper method to check if WooCommerce is active
    private function is_woocommerce_active() {
        return class_exists('WooCommerce');
    }
    
    // WooCommerce Tool implementations
    public function wc_orders_search($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce orders');
        }
        
        $page = isset($args['page']) ? max(1, intval($args['page'])) : 1;
        $per_page = isset($args['per_page']) ? max(1, intval($args['per_page'])) : 10;
        
        $query_args = array(
            'limit' => $per_page,
            'offset' => ($page - 1) * $per_page,
            'return' => 'objects'
        );
        
        if (!empty($args['search'])) {
            $query_args['search'] = sanitize_text_field($args['search']);
        }
        
        if (!empty($args['status'])) {
            $query_args['status'] = sanitize_text_field($args['status']);
        }
        
        if (!empty($args['customer'])) {
            $query_args['customer'] = intval($args['customer']);
        }
        
        if (!empty($args['product'])) {
            $query_args['product'] = intval($args['product']);
        }
        
        if (!empty($args['after'])) {
            $query_args['date_created'] = '>=' . sanitize_text_field($args['after']);
        }
        
        if (!empty($args['before'])) {
            $query_args['date_created'] = '<=' . sanitize_text_field($args['before']);
        }
        
        if (!empty($args['orderby'])) {
            $query_args['orderby'] = sanitize_text_field($args['orderby']);
        }
        
        if (!empty($args['order'])) {
            $query_args['order'] = sanitize_text_field($args['order']);
        }
        
        $orders = wc_get_orders($query_args);
        $total_orders = wc_get_orders(array_merge($query_args, array('limit' => -1, 'count' => true)));
        
        // Ensure total_orders is an integer
        if (is_array($total_orders)) {
            $total_orders = count($total_orders);
        }
        $total_orders = intval($total_orders);
        
        $formatted_orders = array();
        
        foreach ($orders as $order) {
            $order_data = array(
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'currency' => $order->get_currency(),
                'total' => $order->get_total(),
                'subtotal' => $order->get_subtotal(),
                'tax_total' => $order->get_total_tax(),
                'shipping_total' => $order->get_shipping_total(),
                'discount_total' => $order->get_discount_total(),
                'date_created' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d H:i:s') : '',
                'date_modified' => $order->get_date_modified() ? $order->get_date_modified()->date('Y-m-d H:i:s') : '',
                'customer_id' => $order->get_customer_id(),
                'customer_email' => $order->get_billing_email(),
                'customer_name' => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
                'payment_method' => $order->get_payment_method(),
                'payment_method_title' => $order->get_payment_method_title(),
                'transaction_id' => $order->get_transaction_id(),
                'billing_address' => array(
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'company' => $order->get_billing_company(),
                    'address_1' => $order->get_billing_address_1(),
                    'address_2' => $order->get_billing_address_2(),
                    'city' => $order->get_billing_city(),
                    'state' => $order->get_billing_state(),
                    'postcode' => $order->get_billing_postcode(),
                    'country' => $order->get_billing_country(),
                    'email' => $order->get_billing_email(),
                    'phone' => $order->get_billing_phone()
                ),
                'shipping_address' => array(
                    'first_name' => $order->get_shipping_first_name(),
                    'last_name' => $order->get_shipping_last_name(),
                    'company' => $order->get_shipping_company(),
                    'address_1' => $order->get_shipping_address_1(),
                    'address_2' => $order->get_shipping_address_2(),
                    'city' => $order->get_shipping_city(),
                    'state' => $order->get_shipping_state(),
                    'postcode' => $order->get_shipping_postcode(),
                    'country' => $order->get_shipping_country()
                ),
                'line_items' => array(),
                'edit_link' => admin_url('post.php?post=' . $order->get_id() . '&action=edit')
            );
            
            // Get line items
            foreach ($order->get_items() as $item_id => $item) {
                $product = $item->get_product();
                $order_data['line_items'][] = array(
                    'id' => $item_id,
                    'name' => $item->get_name(),
                    'product_id' => $item->get_product_id(),
                    'variation_id' => $item->get_variation_id(),
                    'quantity' => $item->get_quantity(),
                    'subtotal' => $item->get_subtotal(),
                    'total' => $item->get_total(),
                    'sku' => $product ? $product->get_sku() : '',
                    'price' => $product ? $product->get_price() : ''
                );
            }
            
            $formatted_orders[] = $order_data;
        }
        
        return array(
            'orders' => $formatted_orders,
            'total' => $total_orders,
            'pages' => ceil($total_orders / $per_page),
            'current_page' => $page,
            'per_page' => $per_page
        );
    }
    
    public function wc_reports_coupons_totals($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce reports');
        }
        
        $coupons_count = wp_count_posts('shop_coupon');
        
        return array(
            'slug' => 'coupons',
            'name' => 'Coupons',
            'total' => intval($coupons_count->publish),
            'totals' => array(
                'publish' => intval($coupons_count->publish),
                'draft' => intval($coupons_count->draft),
                'pending' => intval($coupons_count->pending),
                'private' => intval($coupons_count->private),
                'trash' => intval($coupons_count->trash)
            )
        );
    }
    
    public function wc_reports_customers_totals($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce reports');
        }
        
        $customer_count = count_users();
        $paying_customers = get_users(array(
            'meta_key' => '_money_spent',
            'meta_value' => 0,
            'meta_compare' => '>',
            'count_total' => true
        ));
        
        return array(
            'slug' => 'customers',
            'name' => 'Customers',
            'total' => intval($customer_count['total_users']),
            'paying_customers' => intval($paying_customers)
        );
    }
    
    public function wc_reports_orders_totals($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce reports');
        }
        
        $order_statuses = wc_get_order_statuses();
        $totals = array();
        
        foreach ($order_statuses as $status => $label) {
            $status_key = str_replace('wc-', '', $status);
            $count = wc_orders_count($status_key);
            $totals[] = array(
                'slug' => $status_key,
                'name' => $label,
                'total' => intval($count)
            );
        }
        
        return $totals;
    }
    
    public function wc_reports_products_totals($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce reports');
        }
        
        $products_count = wp_count_posts('product');
        $variations_count = wp_count_posts('product_variation');
        
        return array(
            array(
                'slug' => 'simple',
                'name' => 'Simple',
                'total' => intval($products_count->publish)
            ),
            array(
                'slug' => 'variations',
                'name' => 'Variations',
                'total' => intval($variations_count->publish)
            ),
            array(
                'slug' => 'total',
                'name' => 'Total Products',
                'total' => intval($products_count->publish) + intval($variations_count->publish)
            )
        );
    }
    
    public function wc_reports_reviews_totals($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce reports');
        }
        
        $reviews_count = wp_count_comments();
        
        return array(
            'slug' => 'reviews',
            'name' => 'Product Reviews',
            'total' => intval($reviews_count->approved),
            'totals' => array(
                'approved' => intval($reviews_count->approved),
                'moderated' => intval($reviews_count->moderated),
                'spam' => intval($reviews_count->spam),
                'trash' => intval($reviews_count->trash)
            )
        );
    }
    
    public function wc_reports_sales($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce reports');
        }
        
        $period = isset($args['period']) ? sanitize_text_field($args['period']) : 'week';
        $date_min = isset($args['date_min']) ? sanitize_text_field($args['date_min']) : '';
        $date_max = isset($args['date_max']) ? sanitize_text_field($args['date_max']) : '';
        
        // Set date range based on period
        if (empty($date_min) || empty($date_max)) {
            switch ($period) {
                case 'week':
                    $date_min = date('Y-m-d', strtotime('-7 days'));
                    $date_max = date('Y-m-d');
                    break;
                case 'month':
                    $date_min = date('Y-m-01');
                    $date_max = date('Y-m-d');
                    break;
                case 'last_month':
                    $date_min = date('Y-m-01', strtotime('last month'));
                    $date_max = date('Y-m-t', strtotime('last month'));
                    break;
                case 'year':
                    $date_min = date('Y-01-01');
                    $date_max = date('Y-m-d');
                    break;
                default:
                    $date_min = date('Y-m-d', strtotime('-7 days'));
                    $date_max = date('Y-m-d');
            }
        }
        
        // Get orders for the period
        $orders = wc_get_orders(array(
            'status' => array('completed', 'processing', 'on-hold'),
            'date_created' => $date_min . '...' . $date_max,
            'limit' => -1
        ));
        
        $total_sales = 0;
        $total_orders = count($orders);
        $total_items = 0;
        $total_tax = 0;
        $total_shipping = 0;
        $total_discount = 0;
        $net_sales = 0;
        
        foreach ($orders as $order) {
            $total_sales += $order->get_total();
            $total_items += $order->get_item_count();
            $total_tax += $order->get_total_tax();
            $total_shipping += $order->get_shipping_total();
            $total_discount += $order->get_discount_total();
            $net_sales += $order->get_total() - $order->get_total_tax() - $order->get_shipping_total();
        }
        
        $average_sales = $total_orders > 0 ? $total_sales / $total_orders : 0;
        
        return array(
            'total_sales' => wc_format_decimal($total_sales, 2),
            'net_sales' => wc_format_decimal($net_sales, 2),
            'average_sales' => wc_format_decimal($average_sales, 2),
            'total_orders' => $total_orders,
            'total_items' => $total_items,
            'total_tax' => wc_format_decimal($total_tax, 2),
            'total_shipping' => wc_format_decimal($total_shipping, 2),
            'total_discount' => wc_format_decimal($total_discount, 2),
            'totals_grouped_by' => $period,
            'period' => $period,
            'date_min' => $date_min,
            'date_max' => $date_max
        );
    }
    
    // REST API Tool implementations
    /**
     * WooCommerce Product Tools Implementation
     */
    public function wc_products_search($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce products');
        }
        
        $defaults = array(
            'page' => 1,
            'per_page' => 10,
            'orderby' => 'date',
            'order' => 'desc'
        );
        
        $args = wp_parse_args($args, $defaults);
        
        // Build WC_Product_Query args
        $query_args = array(
            'limit' => $args['per_page'],
            'offset' => ($args['page'] - 1) * $args['per_page'],
            'orderby' => $args['orderby'],
            'order' => $args['order'],
            'return' => 'objects'
        );
        
        // Add filters
        if (!empty($args['search'])) {
            $query_args['s'] = $args['search'];
        }
        if (!empty($args['status'])) {
            $query_args['status'] = $args['status'];
        }
        if (!empty($args['type'])) {
            $query_args['type'] = $args['type'];
        }
        if (!empty($args['sku'])) {
            $query_args['sku'] = $args['sku'];
        }
        if (isset($args['featured'])) {
            $query_args['featured'] = $args['featured'];
        }
        if (!empty($args['category'])) {
            $query_args['category'] = array($args['category']);
        }
        if (!empty($args['tag'])) {
            $query_args['tag'] = array($args['tag']);
        }
        if (isset($args['on_sale'])) {
            $query_args['on_sale'] = $args['on_sale'];
        }
        if (!empty($args['stock_status'])) {
            $query_args['stock_status'] = $args['stock_status'];
        }
        
        $query = new WC_Product_Query($query_args);
        $products = $query->get_products();
        
        // Get total count for pagination
        $total_query = new WC_Product_Query(array_merge($query_args, array('limit' => -1, 'return' => 'ids')));
        $total = count($total_query->get_products());
        
        $formatted_products = array();
        foreach ($products as $product) {
            $formatted_products[] = array(
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'slug' => $product->get_slug(),
                'permalink' => $product->get_permalink(),
                'date_created' => $product->get_date_created()->date('Y-m-d H:i:s'),
                'date_modified' => $product->get_date_modified()->date('Y-m-d H:i:s'),
                'type' => $product->get_type(),
                'status' => $product->get_status(),
                'featured' => $product->get_featured(),
                'catalog_visibility' => $product->get_catalog_visibility(),
                'description' => $product->get_description(),
                'short_description' => $product->get_short_description(),
                'sku' => $product->get_sku(),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'on_sale' => $product->is_on_sale(),
                'purchasable' => $product->is_purchasable(),
                'total_sales' => $product->get_total_sales(),
                'virtual' => $product->get_virtual(),
                'downloadable' => $product->get_downloadable(),
                'manage_stock' => $product->get_manage_stock(),
                'stock_quantity' => $product->get_stock_quantity(),
                'stock_status' => $product->get_stock_status(),
                'backorders' => $product->get_backorders(),
                'weight' => $product->get_weight(),
                'dimensions' => array(
                    'length' => $product->get_length(),
                    'width' => $product->get_width(),
                    'height' => $product->get_height()
                ),
                'shipping_required' => $product->needs_shipping(),
                'shipping_taxable' => $product->is_shipping_taxable(),
                'shipping_class' => $product->get_shipping_class(),
                'reviews_allowed' => $product->get_reviews_allowed(),
                'average_rating' => $product->get_average_rating(),
                'rating_count' => $product->get_rating_count(),
                'related_ids' => wc_get_related_products($product->get_id()),
                'upsell_ids' => $product->get_upsell_ids(),
                'cross_sell_ids' => $product->get_cross_sell_ids(),
                'parent_id' => $product->get_parent_id(),
                'purchase_note' => $product->get_purchase_note(),
                'categories' => wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names')),
                'tags' => wp_get_post_terms($product->get_id(), 'product_tag', array('fields' => 'names')),
                'images' => $this->get_product_images($product),
                'edit_link' => get_edit_post_link($product->get_id())
            );
        }
        
        return array(
            'products' => $formatted_products,
            'total' => $total,
            'page' => $args['page'],
            'per_page' => $args['per_page'],
            'total_pages' => ceil($total / $args['per_page'])
        );
    }
    
    public function wc_get_product($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce products');
        }
        
        $product_id = intval($args['id']);
        $product = wc_get_product($product_id);
        
        if (!$product) {
            throw new Exception('Product not found');
        }
        
        return array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'permalink' => $product->get_permalink(),
            'date_created' => $product->get_date_created()->date('Y-m-d H:i:s'),
            'date_modified' => $product->get_date_modified()->date('Y-m-d H:i:s'),
            'type' => $product->get_type(),
            'status' => $product->get_status(),
            'featured' => $product->get_featured(),
            'catalog_visibility' => $product->get_catalog_visibility(),
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'on_sale' => $product->is_on_sale(),
            'purchasable' => $product->is_purchasable(),
            'total_sales' => $product->get_total_sales(),
            'virtual' => $product->get_virtual(),
            'downloadable' => $product->get_downloadable(),
            'manage_stock' => $product->get_manage_stock(),
            'stock_quantity' => $product->get_stock_quantity(),
            'stock_status' => $product->get_stock_status(),
            'backorders' => $product->get_backorders(),
            'weight' => $product->get_weight(),
            'dimensions' => array(
                'length' => $product->get_length(),
                'width' => $product->get_width(),
                'height' => $product->get_height()
            ),
            'shipping_required' => $product->needs_shipping(),
            'shipping_taxable' => $product->is_shipping_taxable(),
            'shipping_class' => $product->get_shipping_class(),
            'reviews_allowed' => $product->get_reviews_allowed(),
            'average_rating' => $product->get_average_rating(),
            'rating_count' => $product->get_rating_count(),
            'related_ids' => wc_get_related_products($product->get_id()),
            'upsell_ids' => $product->get_upsell_ids(),
            'cross_sell_ids' => $product->get_cross_sell_ids(),
            'parent_id' => $product->get_parent_id(),
            'purchase_note' => $product->get_purchase_note(),
            'categories' => wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'all')),
            'tags' => wp_get_post_terms($product->get_id(), 'product_tag', array('fields' => 'all')),
            'images' => $this->get_product_images($product),
            'attributes' => $product->get_attributes(),
            'default_attributes' => $product->get_default_attributes(),
            'variations' => $product->get_type() === 'variable' ? $product->get_children() : array(),
            'grouped_products' => $product->get_type() === 'grouped' ? $product->get_children() : array(),
            'menu_order' => $product->get_menu_order(),
            'edit_link' => get_edit_post_link($product->get_id())
        );
    }
    
    public function wc_add_product($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to create WooCommerce products');
        }
        
        // Check if create operations are enabled using custom DB
        $enable_create_tools = $this->db ? $this->db->get_setting('enable_create_tools', true) : true;
        if (!$enable_create_tools) {
            throw new Exception('Create operations are disabled in settings');
        }
        
        $product = new WC_Product_Simple();
        
        // Set basic properties
        $product->set_name(sanitize_text_field($args['name']));
        
        if (!empty($args['description'])) {
            $product->set_description(wp_kses_post($args['description']));
        }
        if (!empty($args['short_description'])) {
            $product->set_short_description(wp_kses_post($args['short_description']));
        }
        if (!empty($args['sku'])) {
            $product->set_sku(sanitize_text_field($args['sku']));
        }
        if (!empty($args['regular_price'])) {
            $product->set_regular_price(sanitize_text_field($args['regular_price']));
        }
        if (!empty($args['sale_price'])) {
            $product->set_sale_price(sanitize_text_field($args['sale_price']));
        }
        if (isset($args['manage_stock'])) {
            $product->set_manage_stock($args['manage_stock']);
        }
        if (!empty($args['stock_quantity'])) {
            $product->set_stock_quantity(intval($args['stock_quantity']));
        }
        if (!empty($args['stock_status'])) {
            $product->set_stock_status(sanitize_text_field($args['stock_status']));
        }
        if (!empty($args['weight'])) {
            $product->set_weight(sanitize_text_field($args['weight']));
        }
        if (!empty($args['status'])) {
            $product->set_status(sanitize_text_field($args['status']));
        }
        
        // Set dimensions
        if (!empty($args['dimensions'])) {
            if (isset($args['dimensions']['length'])) {
                $product->set_length(sanitize_text_field($args['dimensions']['length']));
            }
            if (isset($args['dimensions']['width'])) {
                $product->set_width(sanitize_text_field($args['dimensions']['width']));
            }
            if (isset($args['dimensions']['height'])) {
                $product->set_height(sanitize_text_field($args['dimensions']['height']));
            }
        }
        
        $product_id = $product->save();
        
        if (!$product_id) {
            throw new Exception('Failed to create product');
        }
        
        // Set categories
        if (!empty($args['categories'])) {
            $category_ids = array();
            foreach ($args['categories'] as $category) {
                if (is_numeric($category)) {
                    $category_ids[] = intval($category);
                } elseif (isset($category['id'])) {
                    $category_ids[] = intval($category['id']);
                }
            }
            if (!empty($category_ids)) {
                wp_set_object_terms($product_id, $category_ids, 'product_cat');
            }
        }
        
        // Set tags
        if (!empty($args['tags'])) {
            $tag_ids = array();
            foreach ($args['tags'] as $tag) {
                if (is_numeric($tag)) {
                    $tag_ids[] = intval($tag);
                } elseif (isset($tag['id'])) {
                    $tag_ids[] = intval($tag['id']);
                }
            }
            if (!empty($tag_ids)) {
                wp_set_object_terms($product_id, $tag_ids, 'product_tag');
            }
        }
        
        // Refresh product object
        $product = wc_get_product($product_id);
        
        return array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'permalink' => $product->get_permalink(),
            'status' => $product->get_status(),
            'type' => $product->get_type(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'stock_status' => $product->get_stock_status(),
            'edit_link' => get_edit_post_link($product->get_id())
        );
    }
    
    public function wc_update_product($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to update WooCommerce products');
        }
        
        // Check if update operations are enabled using custom DB
        $enable_update_tools = $this->db ? $this->db->get_setting('enable_update_tools', true) : true;
        if (!$enable_update_tools) {
            throw new Exception('Update operations are disabled in settings');
        }
        
        $product_id = intval($args['id']);
        $product = wc_get_product($product_id);
        
        if (!$product) {
            throw new Exception('Product not found');
        }
        
        // Update properties
        if (!empty($args['name'])) {
            $product->set_name(sanitize_text_field($args['name']));
        }
        if (isset($args['description'])) {
            $product->set_description(wp_kses_post($args['description']));
        }
        if (isset($args['short_description'])) {
            $product->set_short_description(wp_kses_post($args['short_description']));
        }
        if (isset($args['sku'])) {
            $product->set_sku(sanitize_text_field($args['sku']));
        }
        if (isset($args['regular_price'])) {
            $product->set_regular_price(sanitize_text_field($args['regular_price']));
        }
        if (isset($args['sale_price'])) {
            $product->set_sale_price(sanitize_text_field($args['sale_price']));
        }
        if (isset($args['manage_stock'])) {
            $product->set_manage_stock($args['manage_stock']);
        }
        if (isset($args['stock_quantity'])) {
            $product->set_stock_quantity(intval($args['stock_quantity']));
        }
        if (isset($args['stock_status'])) {
            $product->set_stock_status(sanitize_text_field($args['stock_status']));
        }
        if (isset($args['weight'])) {
            $product->set_weight(sanitize_text_field($args['weight']));
        }
        if (isset($args['status'])) {
            $product->set_status(sanitize_text_field($args['status']));
        }
        
        $product->save();
        
        return array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'permalink' => $product->get_permalink(),
            'status' => $product->get_status(),
            'type' => $product->get_type(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'stock_status' => $product->get_stock_status(),
            'edit_link' => get_edit_post_link($product->get_id())
        );
    }
    
    public function wc_delete_product($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to delete WooCommerce products');
        }
        
        // Check if delete operations are enabled using custom DB
        $enable_delete_tools = $this->db ? $this->db->get_setting('enable_delete_tools', false) : false;
        if (!$enable_delete_tools) {
            throw new Exception('Delete operations are disabled in settings');
        }
        
        $product_id = intval($args['id']);
        $force = $args['force'] ?? false;
        
        $product = wc_get_product($product_id);
        if (!$product) {
            throw new Exception('Product not found');
        }
        
        $result = $product->delete($force);
        
        if (!$result) {
            throw new Exception('Failed to delete product');
        }
        
        return array(
            'id' => $product_id,
            'deleted' => true,
            'force' => $force
        );
    }
    
    // Product Category Tools
    public function wc_list_product_categories($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce product categories');
        }
        
        $defaults = array(
            'page' => 1,
            'per_page' => 10,
            'hide_empty' => false
        );
        
        $args = wp_parse_args($args, $defaults);
        
        $query_args = array(
            'taxonomy' => 'product_cat',
            'number' => $args['per_page'],
            'offset' => ($args['page'] - 1) * $args['per_page'],
            'hide_empty' => $args['hide_empty']
        );
        
        if (!empty($args['search'])) {
            $query_args['search'] = $args['search'];
        }
        if (isset($args['parent'])) {
            $query_args['parent'] = $args['parent'];
        }
        
        $categories = get_terms($query_args);
        $total = wp_count_terms('product_cat', array('hide_empty' => $args['hide_empty']));
        
        $formatted_categories = array();
        foreach ($categories as $category) {
            $formatted_categories[] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'parent' => $category->parent,
                'description' => $category->description,
                'count' => $category->count,
                'image' => $this->get_category_image($category->term_id),
                'permalink' => get_term_link($category),
                'edit_link' => get_edit_term_link($category->term_id, 'product_cat')
            );
        }
        
        return array(
            'categories' => $formatted_categories,
            'total' => $total,
            'page' => $args['page'],
            'per_page' => $args['per_page'],
            'total_pages' => ceil($total / $args['per_page'])
        );
    }
    
    public function wc_add_product_category($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to create WooCommerce product categories');
        }
        
        // Check if create operations are enabled using custom DB
        $enable_create_tools = $this->db ? $this->db->get_setting('enable_create_tools', true) : true;
        if (!$enable_create_tools) {
            throw new Exception('Create operations are disabled in settings');
        }
        
        $term_args = array(
            'description' => $args['description'] ?? '',
            'parent' => $args['parent'] ?? 0,
            'slug' => $args['slug'] ?? ''
        );
        
        $result = wp_insert_term(sanitize_text_field($args['name']), 'product_cat', $term_args);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to create category: ' . $result->get_error_message());
        }
        
        $category = get_term($result['term_id'], 'product_cat');
        
        return array(
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'parent' => $category->parent,
            'description' => $category->description,
            'count' => $category->count,
            'permalink' => get_term_link($category),
            'edit_link' => get_edit_term_link($category->term_id, 'product_cat')
        );
    }
    
    public function wc_update_product_category($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to update WooCommerce product categories');
        }
        
        // Check if update operations are enabled using custom DB
        $enable_update_tools = $this->db ? $this->db->get_setting('enable_update_tools', true) : true;
        if (!$enable_update_tools) {
            throw new Exception('Update operations are disabled in settings');
        }
        
        $category_id = intval($args['id']);
        $category = get_term($category_id, 'product_cat');
        
        if (!$category || is_wp_error($category)) {
            throw new Exception('Category not found');
        }
        
        $update_args = array();
        if (isset($args['name'])) {
            $update_args['name'] = sanitize_text_field($args['name']);
        }
        if (isset($args['slug'])) {
            $update_args['slug'] = sanitize_text_field($args['slug']);
        }
        if (isset($args['description'])) {
            $update_args['description'] = wp_kses_post($args['description']);
        }
        if (isset($args['parent'])) {
            $update_args['parent'] = intval($args['parent']);
        }
        
        $result = wp_update_term($category_id, 'product_cat', $update_args);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update category: ' . $result->get_error_message());
        }
        
        $category = get_term($category_id, 'product_cat');
        
        return array(
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'parent' => $category->parent,
            'description' => $category->description,
            'count' => $category->count,
            'permalink' => get_term_link($category),
            'edit_link' => get_edit_term_link($category->term_id, 'product_cat')
        );
    }
    
    public function wc_delete_product_category($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to delete WooCommerce product categories');
        }
        
        // Check if delete operations are enabled using custom DB
        $enable_delete_tools = $this->db ? $this->db->get_setting('enable_delete_tools', false) : false;
        if (!$enable_delete_tools) {
            throw new Exception('Delete operations are disabled in settings');
        }
        
        $category_id = intval($args['id']);
        $category = get_term($category_id, 'product_cat');
        
        if (!$category || is_wp_error($category)) {
            throw new Exception('Category not found');
        }
        
        $result = wp_delete_term($category_id, 'product_cat');
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to delete category: ' . $result->get_error_message());
        }
        
        return array(
            'id' => $category_id,
            'deleted' => true
        );
    }
    
    // Product Tag Tools
    public function wc_list_product_tags($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to access WooCommerce product tags');
        }
        
        $defaults = array(
            'page' => 1,
            'per_page' => 10,
            'hide_empty' => false
        );
        
        $args = wp_parse_args($args, $defaults);
        
        $query_args = array(
            'taxonomy' => 'product_tag',
            'number' => $args['per_page'],
            'offset' => ($args['page'] - 1) * $args['per_page'],
            'hide_empty' => $args['hide_empty']
        );
        
        if (!empty($args['search'])) {
            $query_args['search'] = $args['search'];
        }
        
        $tags = get_terms($query_args);
        $total = wp_count_terms('product_tag', array('hide_empty' => $args['hide_empty']));
        
        $formatted_tags = array();
        foreach ($tags as $tag) {
            $formatted_tags[] = array(
                'id' => $tag->term_id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'description' => $tag->description,
                'count' => $tag->count,
                'permalink' => get_term_link($tag),
                'edit_link' => get_edit_term_link($tag->term_id, 'product_tag')
            );
        }
        
        return array(
            'tags' => $formatted_tags,
            'total' => $total,
            'page' => $args['page'],
            'per_page' => $args['per_page'],
            'total_pages' => ceil($total / $args['per_page'])
        );
    }
    
    public function wc_add_product_tag($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to create WooCommerce product tags');
        }
        
        // Check if create operations are enabled using custom DB
        $enable_create_tools = $this->db ? $this->db->get_setting('enable_create_tools', true) : true;
        if (!$enable_create_tools) {
            throw new Exception('Create operations are disabled in settings');
        }
        
        $term_args = array(
            'description' => $args['description'] ?? '',
            'slug' => $args['slug'] ?? ''
        );
        
        $result = wp_insert_term(sanitize_text_field($args['name']), 'product_tag', $term_args);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to create tag: ' . $result->get_error_message());
        }
        
        $tag = get_term($result['term_id'], 'product_tag');
        
        return array(
            'id' => $tag->term_id,
            'name' => $tag->name,
            'slug' => $tag->slug,
            'description' => $tag->description,
            'count' => $tag->count,
            'permalink' => get_term_link($tag),
            'edit_link' => get_edit_term_link($tag->term_id, 'product_tag')
        );
    }
    
    public function wc_update_product_tag($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to update WooCommerce product tags');
        }
        
        // Check if update operations are enabled using custom DB
        $enable_update_tools = $this->db ? $this->db->get_setting('enable_update_tools', true) : true;
        if (!$enable_update_tools) {
            throw new Exception('Update operations are disabled in settings');
        }
        
        $tag_id = intval($args['id']);
        $tag = get_term($tag_id, 'product_tag');
        
        if (!$tag || is_wp_error($tag)) {
            throw new Exception('Tag not found');
        }
        
        $update_args = array();
        if (isset($args['name'])) {
            $update_args['name'] = sanitize_text_field($args['name']);
        }
        if (isset($args['slug'])) {
            $update_args['slug'] = sanitize_text_field($args['slug']);
        }
        if (isset($args['description'])) {
            $update_args['description'] = wp_kses_post($args['description']);
        }
        
        $result = wp_update_term($tag_id, 'product_tag', $update_args);
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to update tag: ' . $result->get_error_message());
        }
        
        $tag = get_term($tag_id, 'product_tag');
        
        return array(
            'id' => $tag->term_id,
            'name' => $tag->name,
            'slug' => $tag->slug,
            'description' => $tag->description,
            'count' => $tag->count,
            'permalink' => get_term_link($tag),
            'edit_link' => get_edit_term_link($tag->term_id, 'product_tag')
        );
    }
    
    public function wc_delete_product_tag($args) {
        if (!$this->is_woocommerce_active()) {
            throw new Exception('WooCommerce is not active');
        }
        
        if (!current_user_can('manage_woocommerce')) {
            throw new Exception('Insufficient permissions to delete WooCommerce product tags');
        }
        
        // Check if delete operations are enabled using custom DB
        $enable_delete_tools = $this->db ? $this->db->get_setting('enable_delete_tools', false) : false;
        if (!$enable_delete_tools) {
            throw new Exception('Delete operations are disabled in settings');
        }
        
        $tag_id = intval($args['id']);
        $tag = get_term($tag_id, 'product_tag');
        
        if (!$tag || is_wp_error($tag)) {
            throw new Exception('Tag not found');
        }
        
        $result = wp_delete_term($tag_id, 'product_tag');
        
        if (is_wp_error($result)) {
            throw new Exception('Failed to delete tag: ' . $result->get_error_message());
        }
        
        return array(
            'id' => $tag_id,
            'deleted' => true
        );
    }
    
    /**
     * Helper method to get product images
     */
    private function get_product_images($product) {
        $images = array();
        
        // Main image
        $image_id = $product->get_image_id();
        if ($image_id) {
            $images[] = array(
                'id' => $image_id,
                'src' => wp_get_attachment_url($image_id),
                'name' => get_the_title($image_id),
                'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                'position' => 0
            );
        }
        
        // Gallery images
        $gallery_ids = $product->get_gallery_image_ids();
        $position = 1;
        foreach ($gallery_ids as $gallery_id) {
            $images[] = array(
                'id' => $gallery_id,
                'src' => wp_get_attachment_url($gallery_id),
                'name' => get_the_title($gallery_id),
                'alt' => get_post_meta($gallery_id, '_wp_attachment_image_alt', true),
                'position' => $position++
            );
        }
        
        return $images;
    }
    
    /**
     * Helper method to get category image
     */
    private function get_category_image($term_id) {
        $image_id = get_term_meta($term_id, 'thumbnail_id', true);
        if ($image_id) {
            return array(
                'id' => $image_id,
                'src' => wp_get_attachment_url($image_id),
                'name' => get_the_title($image_id),
                'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true)
            );
        }
        return null;
    }

    public function list_api_functions($args) {
        $exact_ignore_routes = array(
            '/',
            '/batch/v1',
        );
        $containing_ignore_strings = array(
            'oembed',
            'autosaves',
            'revisions',
            'jwt-auth',
        );
        
        // Get all routes and methods from the WordPress REST API
        $routes = rest_get_server()->get_routes();
        $result = array();
        
        foreach ($routes as $route => $methods) {
            // Skip if route exactly matches any ignore route
            if (in_array($route, $exact_ignore_routes, true)) {
                continue;
            }
            
            // Skip if route contains any of the ignore strings
            $skip_route = false;
            foreach ($containing_ignore_strings as $ignore_string) {
                if (strpos($route, $ignore_string) !== false) {
                    $skip_route = true;
                    break;
                }
            }
            if ($skip_route) {
                continue;
            }
            
            // Apply namespace filter if provided
            if (!empty($args['namespace'])) {
                $namespace = sanitize_text_field($args['namespace']);
                if (strpos($route, '/' . $namespace . '/') !== 0) {
                    continue;
                }
            }
            
            // Apply search filter if provided
            if (!empty($args['search'])) {
                $search = sanitize_text_field($args['search']);
                if (stripos($route, $search) === false) {
                    continue;
                }
            }
            
            foreach ($methods as $method_data) {
                if (isset($method_data['methods']) && is_array($method_data['methods'])) {
                    foreach ($method_data['methods'] as $method => $enabled) {
                        if ($enabled) {
                            $result[] = array(
                                'route' => $route,
                                'method' => $method,
                                'description' => isset($method_data['callback']) ? $this->get_callback_description($method_data['callback']) : 'No description available'
                            );
                        }
                    }
                }
            }
        }
        
        // Apply limit if provided
        $limit = isset($args['limit']) ? intval($args['limit']) : 20;
        if ($limit > 0 && count($result) > $limit) {
            $result = array_slice($result, 0, $limit);
        }
        
        return array(
            'endpoints' => $result,
            'total' => count($result)
        );
    }
    
    public function get_function_details($args) {
        $route = sanitize_text_field($args['route']);
        $method = strtoupper(sanitize_text_field($args['method']));
        
        $routes = rest_get_server()->get_routes();
        
        if (!isset($routes[$route])) {
            throw new Exception('Route not found: ' . $route);
        }
        
        $route_methods = $routes[$route];
        $method_data = null;
        
        // Find the method data
        foreach ($route_methods as $method_info) {
            if (isset($method_info['methods'][$method]) && $method_info['methods'][$method]) {
                $method_data = $method_info;
                break;
            }
        }
        
        if (!$method_data) {
            throw new Exception('Method ' . $method . ' not supported for route: ' . $route);
        }
        
        $details = array(
            'route' => $route,
            'method' => $method,
            'description' => $this->get_callback_description($method_data['callback']),
            'permission_callback' => isset($method_data['permission_callback']) ? 'Set' : 'None',
            'args' => array()
        );
        
        // Extract argument details
        if (isset($method_data['args']) && is_array($method_data['args'])) {
            foreach ($method_data['args'] as $arg_name => $arg_config) {
                $arg_details = array(
                    'name' => $arg_name,
                    'required' => isset($arg_config['required']) ? $arg_config['required'] : false,
                    'type' => isset($arg_config['type']) ? $arg_config['type'] : 'mixed',
                    'description' => isset($arg_config['description']) ? $arg_config['description'] : 'No description available'
                );
                
                if (isset($arg_config['enum'])) {
                    $arg_details['enum'] = $arg_config['enum'];
                }
                
                if (isset($arg_config['default'])) {
                    $arg_details['default'] = $arg_config['default'];
                }
                
                $details['args'][] = $arg_details;
            }
        }
        
        return $details;
    }
    
    public function run_api_function($args) {
        $route = sanitize_text_field($args['route']);
        $method = strtoupper(sanitize_text_field($args['method']));
        $data = isset($args['data']) ? $args['data'] : array();
        $params = isset($args['params']) ? $args['params'] : array();
        
        // Check if the method is allowed based on settings from custom DB
        $enable_delete_tools = $this->db ? $this->db->get_setting('enable_delete_tools', false) : false;
        $enable_create_tools = $this->db ? $this->db->get_setting('enable_create_tools', true) : true;
        $enable_update_tools = $this->db ? $this->db->get_setting('enable_update_tools', true) : true;
        
        switch ($method) {
            case 'DELETE':
                if (!$enable_delete_tools) {
                    throw new Exception('Delete operations are disabled in MCP settings.');
                }
                break;
            case 'POST':
                if (!$enable_create_tools) {
                    throw new Exception('Create operations are disabled in MCP settings.');
                }
                break;
            case 'PATCH':
            case 'PUT':
                if (!$enable_update_tools) {
                    throw new Exception('Update operations are disabled in MCP settings.');
                }
                break;
        }
        
        // Create the REST request
        $request = new WP_REST_Request($method, $route);
        
        // Set query parameters for GET requests or body parameters for others
        if ($method === 'GET' && !empty($params)) {
            foreach ($params as $key => $value) {
                $request->set_param($key, $value);
            }
        } elseif (!empty($data)) {
            if (is_array($data)) {
                foreach ($data as $key => $value) {
                    $request->set_param($key, $value);
                }
            } else {
                $request->set_body($data);
            }
        }
        
        // Execute the request
        $response = rest_do_request($request);
        
        if (is_wp_error($response)) {
            throw new Exception('REST API request failed: ' . $response->get_error_message());
        }
        
        $response_data = $response->get_data();
        $status_code = $response->get_status();
        
        return array(
            'status' => $status_code,
            'data' => $response_data,
            'route' => $route,
            'method' => $method,
            'success' => $status_code >= 200 && $status_code < 300
        );
    }
    
    // Helper method to get callback description
    private function get_callback_description($callback) {
        if (is_string($callback)) {
            return 'Function: ' . $callback;
        } elseif (is_array($callback) && count($callback) === 2) {
            if (is_object($callback[0])) {
                return 'Method: ' . get_class($callback[0]) . '::' . $callback[1];
            } elseif (is_string($callback[0])) {
                return 'Static method: ' . $callback[0] . '::' . $callback[1];
            }
        }
        return 'Callback defined';
    }
    
    // Helper methods for media tools
    private function get_attachment_sizes($attachment_id) {
        $metadata = wp_get_attachment_metadata($attachment_id);
        $sizes = array();
        
        if (isset($metadata['sizes']) && is_array($metadata['sizes'])) {
            foreach ($metadata['sizes'] as $size_name => $size_data) {
                $sizes[$size_name] = array(
                    'file' => $size_data['file'],
                    'width' => $size_data['width'],
                    'height' => $size_data['height'],
                    'mime_type' => $size_data['mime-type'] ?? get_post_mime_type($attachment_id),
                    'url' => wp_get_attachment_image_url($attachment_id, $size_name)
                );
            }
        }
        
        return $sizes;
    }
    
    private function get_extension_from_mime_type($mime_type) {
        $mime_map = array(
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/svg+xml' => 'svg',
            'image/svg' => 'svg',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/vnd.ms-powerpoint' => 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
            'text/plain' => 'txt',
            'text/csv' => 'csv',
            'text/html' => 'html',
            'text/xml' => 'xml',
            'application/json' => 'json',
            'audio/mpeg' => 'mp3',
            'audio/wav' => 'wav',
            'audio/ogg' => 'ogg',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'video/ogg' => 'ogv',
            'video/quicktime' => 'mov',
            'video/x-msvideo' => 'avi',
            'video/x-ms-wmv' => 'wmv',
        );
        
        if (!isset($mime_map[$mime_type])) {
            throw new Exception('File type not supported: ' . $mime_type);
        }
        
        return $mime_map[$mime_type];
    }
    
    public function is_enabled() {
        return $this->enabled;
    }
    
    public function get_endpoint_url() {
        return rest_url('magicassistant/v1/mcp');
    }

    public function get_registered_tools() {
        // Expose the list of currently registered tools so other components (e.g. the AI provider)
        // can dynamically generate function/tool schemas without duplicating definitions.
        return $this->registered_tools;
    }

    /**
     * Execute a registered tool directly and return the raw callback result.
     *
     * This mirrors the internal call_tool() logic but exposes it publicly so that
     * first-party consumers (like the AI provider) can bypass the JSON-RPC layer
     * and avoid re-implementing permission / callback wiring.
     *
     * @param string $name      The tool name (must be registered).
     * @param array  $arguments Arguments to pass to the tool callback.
     *
     * @return mixed            Whatever the tool callback returns.
     * @throws Exception        If the tool is not found or the callback fails.
     */
    public function invoke_tool($name, $arguments = array()) {
        // Mark that dynamic discovery was performed when get_available_tools is invoked
        if ($name === 'get_available_tools') {
            $this->tools_discovered = true;
        }

        if (!isset($this->registered_tools[$name])) {
            throw new Exception('Tool not found: ' . $name);
        }

        $tool = $this->registered_tools[$name];
        $callback = $tool['callback'];

        if (!is_callable($callback)) {
            throw new Exception('Tool callback not callable: ' . $name);
        }

        return call_user_func($callback, $arguments);
    }

    /**
     * Check if dynamic tool discovery was already performed
     * @return bool
     */
    public function get_tools_discovered() {
        return $this->tools_discovered;
    }
    
    public function reset_tools_discovered() {
        $this->tools_discovered = false;
    }

    private function register_rest_api_tools() {
        // list_api_functions - List all available WordPress REST API endpoints
        $this->register_tool(array(
            'name' => 'list_api_functions',
            'description' => 'List all available WordPress REST API endpoints that support CRUD operations (Create, Read, Update, Delete). Use this first to discover what API functions are available before inspecting or calling them.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'namespace' => array('type' => 'string', 'description' => 'Filter by namespace (e.g. wp/v2, wc/v3)'),
                    'limit' => array('type' => 'integer', 'description' => 'Maximum number of endpoints to return (default: 20)'),
                    'search' => array('type' => 'string', 'description' => 'Search for endpoints containing this term'),
                ),
            ),
            'callback' => array($this, 'list_api_functions'),
        ));

        // get_function_details - Get detailed metadata for a specific REST API endpoint and method
        $this->register_tool(array(
            'name' => 'get_function_details',
            'description' => 'Get detailed metadata for a specific WordPress REST API endpoint and HTTP method. Includes available parameters, required fields, authentication needs, and expected response structure. Use this to get the details of a specific function before calling it.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'route' => array('type' => 'string', 'description' => 'The REST API route (e.g., "/wp/v2/posts", "/wp/v2/users")'),
                    'method' => array('type' => 'string', 'description' => 'The HTTP method to retrieve metadata for (GET, POST, PATCH, DELETE)'),
                ),
                'required' => array('route', 'method'),
            ),
            'callback' => array($this, 'get_function_details'),
        ));

        // run_api_function - Execute any WordPress REST API endpoint
        $this->register_tool(array(
            'name' => 'run_api_function',
            'description' => 'Execute a specific WordPress REST API function by providing the endpoint route, HTTP method, and any required parameters or request body. Supports standard CRUD operations: GET (read), POST (create), PATCH (update), DELETE (remove).',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'route' => array('type' => 'string', 'description' => 'The REST API route (e.g., "/wp/v2/posts", "/wp/v2/users/123")'),
                    'method' => array('type' => 'string', 'description' => 'The HTTP method to use: GET, POST, PATCH, or DELETE'),
                    'data' => array('type' => 'string', 'description' => 'JSON string payload for POST or PATCH requests'),
                    'params' => array('type' => 'string', 'description' => 'JSON string query parameters for GET requests')
                ),
                'required' => array('route', 'method')
            ),
            'callback' => array($this, 'run_api_function'),
        ));
    }
    
    private function register_default_resources() {
        // Register Site Settings Resource
        $this->register_resource(array(
            'uri' => 'WordPress://site-settings',
            'name' => 'site-settings',
            'description' => 'Provides detailed information about WordPress site settings',
            'mimeType' => 'application/json',
            'callback' => array($this, 'get_site_settings_resource')
        ));
        
        // Register General Site Info Resource
        $this->register_resource(array(
            'uri' => 'WordPress://site-info',
            'name' => 'site-info',
            'description' => 'Provides general information about the WordPress site including site details, plugins, themes, and users',
            'mimeType' => 'application/json',
            'callback' => array($this, 'get_general_site_info_resource')
        ));
        
        // Register Theme Info Resource
        $this->register_resource(array(
            'uri' => 'WordPress://theme-info',
            'name' => 'theme-info',
            'description' => 'Provides detailed information about the active WordPress theme',
            'mimeType' => 'application/json',
            'callback' => array($this, 'get_theme_info_resource')
        ));
        
        // Register User Info Resource
        $this->register_resource(array(
            'uri' => 'WordPress://user-info',
            'name' => 'user-info',
            'description' => 'Provides detailed information about registered WordPress users and their roles',
            'mimeType' => 'application/json',
            'callback' => array($this, 'get_user_info_resource')
        ));
    }
    
    public function get_site_settings_resource($params = array()) {
        if (!class_exists('MagicAssistant\Utils\SiteSettings')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/SiteSettings.php';
        }
        
        return \MagicAssistant\Utils\SiteSettings::get_site_settings($params);
    }
    
    public function wp_get_site_settings($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions. User must have manage_options capability.');
        }
        
        if (!class_exists('MagicAssistant\Utils\SiteSettings')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/SiteSettings.php';
        }
        
        $category = $args['category'] ?? 'all';
        
        if ($category !== 'all') {
            $settings = \MagicAssistant\Utils\SiteSettings::get_settings_category($category);
            if (empty($settings)) {
                throw new Exception('Invalid settings category: ' . $category);
            }
            return array(
                'category' => $category,
                'settings' => $settings
            );
        }
        
        $all_settings = \MagicAssistant\Utils\SiteSettings::get_site_settings($args);
        
        return array(
            'categories' => array_keys($all_settings),
            'settings' => $all_settings
        );
    }
    
    public function get_general_site_info_resource($params = array()) {
        if (!class_exists('MagicAssistant\Utils\GeneralSiteInfo')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/GeneralSiteInfo.php';
        }
        
        return \MagicAssistant\Utils\GeneralSiteInfo::get_site_info($params);
    }
    
    public function wp_get_general_site_info($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions. User must have manage_options capability.');
        }
        
        if (!class_exists('MagicAssistant\Utils\GeneralSiteInfo')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/GeneralSiteInfo.php';
        }
        
        $view = $args['view'] ?? 'full';
        
        switch ($view) {
            case 'overview':
                return \MagicAssistant\Utils\GeneralSiteInfo::get_site_overview();
            case 'requirements':
                return \MagicAssistant\Utils\GeneralSiteInfo::get_system_requirements();
            case 'full':
            default:
                return \MagicAssistant\Utils\GeneralSiteInfo::get_site_info($args);
        }
    }
    
    public function get_theme_info_resource($params = array()) {
        if (!class_exists('MagicAssistant\Utils\ThemeInfo')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/ThemeInfo.php';
        }
        
        return \MagicAssistant\Utils\ThemeInfo::get_theme_info($params);
    }
    
    public function wp_get_detailed_theme_info($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions. User must have manage_options capability.');
        }
        
        if (!class_exists('MagicAssistant\Utils\ThemeInfo')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/ThemeInfo.php';
        }
        
        return \MagicAssistant\Utils\ThemeInfo::get_theme_info($args);
    }
    
    public function get_user_info_resource($params = array()) {
        if (!class_exists('MagicAssistant\Utils\UserInfo')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/UserInfo.php';
        }
        
        return \MagicAssistant\Utils\UserInfo::get_user_info($params);
    }
    
    public function wp_get_detailed_user_info($args) {
        if (!current_user_can('manage_options')) {
            throw new Exception('Insufficient permissions. User must have manage_options capability.');
        }
        
        if (!class_exists('MagicAssistant\Utils\UserInfo')) {
            require_once plugin_dir_path(__FILE__) . 'Utils/UserInfo.php';
        }
        
        $view = $args['view'] ?? 'full';
        
        switch ($view) {
            case 'statistics':
                return \MagicAssistant\Utils\UserInfo::get_user_statistics();
            case 'roles':
                return \MagicAssistant\Utils\UserInfo::get_role_capabilities();
            case 'role_stats':
                return \MagicAssistant\Utils\UserInfo::get_role_stats();
            case 'single':
                $user_id = $args['user_id'] ?? null;
                if (!$user_id) {
                    throw new Exception('User ID is required for single user view.');
                }
                $user_info = \MagicAssistant\Utils\UserInfo::get_single_user_info($user_id);
                if (!$user_info) {
                    throw new Exception('User not found with ID: ' . $user_id);
                }
                return $user_info;
            case 'full':
            default:
                return \MagicAssistant\Utils\UserInfo::get_user_info($args);
        }
    }

    /**
     * Register WordPress.org repository tools for searching and installing plugins/themes
     */
    private function register_repository_tools() {
        // wp_search_repo_plugins - Search WordPress.org plugin repository
        $this->register_tool(array(
            'name' => 'wp_search_repo_plugins',
            'description' => 'Search the WordPress.org plugin repository for plugins. Returns plugin information including name, description, author, ratings, and download stats.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in plugin names and descriptions'),
                    'tag' => array('type' => 'string', 'description' => 'Filter by plugin tag (e.g., "seo", "security", "backup")'),
                    'author' => array('type' => 'string', 'description' => 'Filter by plugin author'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of results per page (default: 12, max: 24)', 'default' => 12),
                    'page' => array('type' => 'integer', 'description' => 'Page number (default: 1)', 'default' => 1),
                    'browse' => array('type' => 'string', 'description' => 'Browse by category: popular, featured, updated, new (default: popular)', 'default' => 'popular')
                )
            ),
            'callback' => array($this, 'wp_search_repo_plugins')
        ));

        // wp_get_repo_plugin_info - Get detailed information about a specific plugin from WordPress.org repository
        $this->register_tool(array(
            'name' => 'wp_get_repo_plugin_info',
            'description' => 'Get detailed information about a specific plugin from WordPress.org repository, including description, installation instructions, changelog, and compatibility.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'slug' => array('type' => 'string', 'description' => 'The plugin slug (e.g., "akismet", "shortpixel-image-optimiser")')
                ),
                'required' => array('slug')
            ),
            'callback' => array($this, 'wp_get_repo_plugin_info')
        ));

        // wp_install_repo_plugin - Install a plugin from WordPress.org repository
        $this->register_tool(array(
            'name' => 'wp_install_repo_plugin',
            'description' => 'Install a plugin from the WordPress.org repository. Requires the plugin slug and optionally can activate it immediately.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'slug' => array('type' => 'string', 'description' => 'The plugin slug from WordPress.org (e.g., "akismet", "shortpixel-image-optimiser")'),
                    'activate' => array('type' => 'boolean', 'description' => 'Whether to activate the plugin after installation (default: false)', 'default' => false)
                ),
                'required' => array('slug')
            ),
            'callback' => array($this, 'wp_install_repo_plugin')
        ));

        // wp_search_repo_themes - Search WordPress.org theme repository
        $this->register_tool(array(
            'name' => 'wp_search_repo_themes',
            'description' => 'Search the WordPress.org theme repository for themes. Returns theme information including name, description, author, ratings, and preview images.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'search' => array('type' => 'string', 'description' => 'Search term to look for in theme names and descriptions'),
                    'tag' => array('type' => 'string', 'description' => 'Filter by theme tag (e.g., "blog", "business", "portfolio")'),
                    'author' => array('type' => 'string', 'description' => 'Filter by theme author'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of results per page (default: 12, max: 24)', 'default' => 12),
                    'page' => array('type' => 'integer', 'description' => 'Page number (default: 1)', 'default' => 1),
                    'browse' => array('type' => 'string', 'description' => 'Browse by category: popular, featured, updated, new (default: popular)', 'default' => 'popular')
                )
            ),
            'callback' => array($this, 'wp_search_repo_themes')
        ));

        // wp_get_repo_theme_info - Get detailed information about a specific theme from WordPress.org repository
        $this->register_tool(array(
            'name' => 'wp_get_repo_theme_info',
            'description' => 'Get detailed information about a specific theme from WordPress.org repository, including description, installation instructions, preview images, and compatibility.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'slug' => array('type' => 'string', 'description' => 'The theme slug (e.g., "twentytwentyfour", "astra")')
                ),
                'required' => array('slug')
            ),
            'callback' => array($this, 'wp_get_repo_theme_info')
        ));

        // wp_install_repo_theme - Install a theme from WordPress.org repository
        $this->register_tool(array(
            'name' => 'wp_install_repo_theme',
            'description' => 'Install a theme from the WordPress.org repository. Requires the theme slug and optionally can activate it immediately.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'slug' => array('type' => 'string', 'description' => 'The theme slug from WordPress.org (e.g., "twentytwentyfour", "astra")'),
                    'activate' => array('type' => 'boolean', 'description' => 'Whether to activate the theme after installation (default: false)', 'default' => false)
                ),
                'required' => array('slug')
            ),
            'callback' => array($this, 'wp_install_repo_theme')
        ));

        // wp_check_plugin_updates - Check for available plugin updates
        $this->register_tool(array(
            'name' => 'wp_check_plugin_updates',
            'description' => 'Check for available plugin updates on the WordPress site. Returns a list of plugins that have updates available.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => (object)array(),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_check_plugin_updates')
        ));

        // wp_update_plugin - Update a specific plugin
        $this->register_tool(array(
            'name' => 'wp_update_plugin',
            'description' => 'Update a specific plugin to its latest version.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'plugin_file' => array('type' => 'string', 'description' => 'The plugin file path (e.g., "plugin-folder/plugin-file.php")')
                ),
                'required' => array('plugin_file'),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_update_plugin')
        ));

        // wp_update_all_plugins - Update all plugins that have updates available
        $this->register_tool(array(
            'name' => 'wp_update_all_plugins',
            'description' => 'Update all plugins that have updates available.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => (object)array(),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_update_all_plugins')
        ));

        // wp_check_theme_updates - Check for available theme updates
        $this->register_tool(array(
            'name' => 'wp_check_theme_updates',
            'description' => 'Check for available theme updates on the WordPress site. Returns a list of themes that have updates available.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => (object)array(),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_check_theme_updates')
        ));

        // wp_update_theme - Update a specific theme
        $this->register_tool(array(
            'name' => 'wp_update_theme',
            'description' => 'Update a specific theme to its latest version.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'theme_slug' => array('type' => 'string', 'description' => 'The theme slug (folder name)')
                ),
                'required' => array('theme_slug'),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_update_theme')
        ));

        // wp_update_all_themes - Update all themes that have updates available
        $this->register_tool(array(
            'name' => 'wp_update_all_themes',
            'description' => 'Update all themes that have updates available.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => (object)array(),
                'additionalProperties' => false
            ),
            'callback' => array($this, 'wp_update_all_themes')
        ));
    }

    /**
     * Search WordPress.org plugin repository
     */
    public function wp_search_repo_plugins($args) {
        if (!current_user_can('install_plugins')) {
            throw new Exception('Insufficient permissions. User must have install_plugins capability.');
        }

        $search = $args['search'] ?? '';
        $tag = $args['tag'] ?? '';
        $author = $args['author'] ?? '';
        $per_page = min(intval($args['per_page'] ?? 12), 24);
        $page = max(intval($args['page'] ?? 1), 1);
        $browse = $args['browse'] ?? 'popular';

        $url = 'https://api.wordpress.org/plugins/info/1.2/';
        $request_data = array(
            'action' => 'query_plugins',
            'request' => array(
                'per_page' => $per_page,
                'page' => $page,
                'browse' => $browse,
                'fields' => array(
                    'description' => false,
                    'sections' => false,
                    'rating' => true,
                    'ratings' => false,
                    'downloaded' => true,
                    'download_link' => false,
                    'last_updated' => true,
                    'homepage' => true,
                    'tags' => true,
                    'active_installs' => true,
                    'short_description' => true,
                    'author' => true
                )
            )
        );

        if (!empty($search)) {
            $request_data['request']['search'] = $search;
        }
        if (!empty($tag)) {
            $request_data['request']['tag'] = array($tag);
        }
        if (!empty($author)) {
            $request_data['request']['author'] = $author;
        }

        $response = wp_remote_get(add_query_arg($request_data, $url), array(
            'timeout' => 15,
            'user-agent' => 'WordPress/' . get_bloginfo('version') . '; ' . home_url()
        ));

        if (is_wp_error($response)) {
            throw new Exception('Failed to search WordPress.org: ' . $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid response from WordPress.org');
        }

        $plugins = array();
        if (isset($data['plugins']) && is_array($data['plugins'])) {
            foreach ($data['plugins'] as $plugin) {
                $plugins[] = array(
                    'name' => $plugin['name'] ?? '',
                    'slug' => $plugin['slug'] ?? '',
                    'version' => $plugin['version'] ?? '',
                    'author' => strip_tags($plugin['author'] ?? ''),
                    'rating' => floatval($plugin['rating'] ?? 0),
                    'num_ratings' => intval($plugin['num_ratings'] ?? 0),
                    'active_installs' => intval($plugin['active_installs'] ?? 0),
                    'downloaded' => intval($plugin['downloaded'] ?? 0),
                    'last_updated' => $plugin['last_updated'] ?? '',
                    'tested' => $plugin['tested'] ?? '',
                    'requires' => $plugin['requires'] ?? '',
                    'requires_php' => $plugin['requires_php'] ?? '',
                    'short_description' => $plugin['short_description'] ?? '',
                    'homepage' => $plugin['homepage'] ?? '',
                    'tags' => is_array($plugin['tags'] ?? null) ? array_keys($plugin['tags']) : array()
                );
            }
        }

        return array(
            'plugins' => $plugins,
            'info' => array(
                'page' => $page,
                'pages' => intval($data['info']['pages'] ?? 1),
                'results' => intval($data['info']['results'] ?? 0)
            )
        );
    }

    /**
     * Get detailed information about a specific plugin from WordPress.org repository
     */
    public function wp_get_repo_plugin_info($args) {
        $slug = $args['slug'] ?? '';

        if (empty($slug)) {
            throw new Exception('Plugin slug is required');
        }

        $url = 'https://api.wordpress.org/plugins/info/1.2/';
        $request_data = array(
            'action' => 'plugin_information',
            'request' => array(
                'slug' => $slug,
                'fields' => array(
                    'description' => true,
                    'installation' => true,
                    'changelog' => true,
                    'sections' => true,
                    'rating' => true,
                    'ratings' => true,
                    'downloaded' => true,
                    'download_link' => true,
                    'last_updated' => true,
                    'homepage' => true,
                    'tags' => true,
                    'active_installs' => true,
                    'screenshots' => true,
                    'banners' => true
                )
            )
        );

        $response = wp_remote_get(add_query_arg($request_data, $url), array(
            'timeout' => 15,
            'user-agent' => 'WordPress/' . get_bloginfo('version') . '; ' . home_url()
        ));

        if (is_wp_error($response)) {
            throw new Exception('Failed to get plugin info from WordPress.org: ' . $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $plugin = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE || empty($plugin)) {
            throw new Exception('Plugin not found or invalid response from WordPress.org');
        }

        // Check if already installed
        $installed_plugins = get_plugins();
        $is_installed = false;
        $installed_file = '';

        foreach ($installed_plugins as $file => $details) {
            if (strpos($file, $slug . '/') === 0 || $file === $slug . '.php') {
                $is_installed = true;
                $installed_file = $file;
                break;
            }
        }

        return array(
            'name' => $plugin['name'] ?? '',
            'slug' => $plugin['slug'] ?? '',
            'version' => $plugin['version'] ?? '',
            'author' => strip_tags($plugin['author'] ?? ''),
            'rating' => floatval($plugin['rating'] ?? 0),
            'num_ratings' => intval($plugin['num_ratings'] ?? 0),
            'active_installs' => intval($plugin['active_installs'] ?? 0),
            'downloaded' => intval($plugin['downloaded'] ?? 0),
            'last_updated' => $plugin['last_updated'] ?? '',
            'tested' => $plugin['tested'] ?? '',
            'requires' => $plugin['requires'] ?? '',
            'requires_php' => $plugin['requires_php'] ?? '',
            'short_description' => $plugin['short_description'] ?? '',
            'description' => $plugin['sections']['description'] ?? '',
            'installation' => $plugin['sections']['installation'] ?? '',
            'changelog' => $plugin['sections']['changelog'] ?? '',
            'homepage' => $plugin['homepage'] ?? '',
            'download_link' => $plugin['download_link'] ?? '',
            'tags' => is_array($plugin['tags'] ?? null) ? array_keys($plugin['tags']) : array(),
            'screenshots' => $plugin['screenshots'] ?? array(),
            'banners' => $plugin['banners'] ?? array(),
            'is_installed' => $is_installed,
            'installed_file' => $installed_file,
            'is_active' => $is_installed ? is_plugin_active($installed_file) : false
        );
    }

    /**
     * Install a plugin from WordPress.org repository
     */
    public function wp_install_repo_plugin($args) {
        if (!current_user_can('install_plugins')) {
            throw new Exception('Insufficient permissions. User must have install_plugins capability.');
        }

        $slug = $args['slug'] ?? '';
        $activate = $args['activate'] ?? false;

        if (empty($slug)) {
            throw new Exception('Plugin slug is required');
        }

        // Check if plugin is already installed
        $installed_plugins = get_plugins();
        foreach ($installed_plugins as $file => $details) {
            if (strpos($file, $slug . '/') === 0 || $file === $slug . '.php') {
                if ($activate && !is_plugin_active($file)) {
                    $activation_result = activate_plugin($file);
                    if (is_wp_error($activation_result)) {
                        throw new Exception('Plugin is already installed but failed to activate: ' . $activation_result->get_error_message());
                    }
                    return array(
                        'success' => true,
                        'message' => 'Plugin was already installed and has been activated',
                        'plugin_file' => $file,
                        'activated' => true
                    );
                }
                return array(
                    'success' => true,
                    'message' => 'Plugin is already installed',
                    'plugin_file' => $file,
                    'activated' => is_plugin_active($file)
                );
            }
        }

        // Include required WordPress files
        if (!function_exists('plugins_api')) {
            require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        }
        if (!class_exists('\WP_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        // Get plugin information
        $api = \plugins_api('plugin_information', array(
            'slug' => $slug,
            'fields' => array(
                'sections' => false,
                'tags' => false,
                'ratings' => false,
                'screenshots' => false,
                'changelog' => false,
                'description' => false,
                'tested' => false,
                'requires' => true,
                'requires_php' => true,
                'downloaded' => false,
                'last_updated' => false
            )
        ));

        if (is_wp_error($api)) {
            throw new Exception('Failed to get plugin information: ' . $api->get_error_message());
        }

        // Check WordPress version compatibility
        if (!empty($api->requires) && version_compare(get_bloginfo('version'), $api->requires, '<')) {
            throw new Exception('Plugin requires WordPress version ' . $api->requires . ' or higher. Current version: ' . get_bloginfo('version'));
        }

        // Check PHP version compatibility
        if (!empty($api->requires_php) && version_compare(PHP_VERSION, $api->requires_php, '<')) {
            throw new Exception('Plugin requires PHP version ' . $api->requires_php . ' or higher. Current version: ' . PHP_VERSION);
        }

        // Install the plugin
        $upgrader = new \Plugin_Upgrader(new \WP_Ajax_Upgrader_Skin());
        $install_result = $upgrader->install($api->download_link);

        if (is_wp_error($install_result)) {
            throw new Exception('Plugin installation failed: ' . $install_result->get_error_message());
        }

        if (!$install_result) {
            throw new Exception('Plugin installation failed: Unknown error');
        }

        $plugin_file = $upgrader->plugin_info();
        if (!$plugin_file) {
            throw new Exception('Plugin installed but could not determine plugin file');
        }

        $result = array(
            'success' => true,
            'message' => 'Plugin installed successfully',
            'plugin_file' => $plugin_file,
            'activated' => false
        );

        // Activate if requested
        if ($activate) {
            $activation_result = activate_plugin($plugin_file);
            if (is_wp_error($activation_result)) {
                $result['message'] .= ' but failed to activate: ' . $activation_result->get_error_message();
            } else {
                $result['activated'] = true;
                $result['message'] = 'Plugin installed and activated successfully';
            }
        }

        return $result;
    }

    /**
     * Search WordPress.org theme repository
     */
    public function wp_search_repo_themes($args) {
        if (!current_user_can('install_themes')) {
            throw new Exception('Insufficient permissions. User must have install_themes capability.');
        }

        $search = $args['search'] ?? '';
        $tag = $args['tag'] ?? '';
        $author = $args['author'] ?? '';
        $per_page = min(intval($args['per_page'] ?? 12), 24);
        $page = max(intval($args['page'] ?? 1), 1);
        $browse = $args['browse'] ?? 'popular';

        $url = 'https://api.wordpress.org/themes/info/1.2/';
        $request_data = array(
            'action' => 'query_themes',
            'request' => array(
                'per_page' => $per_page,
                'page' => $page,
                'browse' => $browse,
                'fields' => array(
                    'description' => false,
                    'sections' => false,
                    'rating' => true,
                    'ratings' => false,
                    'downloaded' => true,
                    'download_link' => false,
                    'last_updated' => true,
                    'homepage' => true,
                    'tags' => true,
                    'screenshot_url' => true,
                    'preview_url' => true
                )
            )
        );

        if (!empty($search)) {
            $request_data['request']['search'] = $search;
        }
        if (!empty($tag)) {
            $request_data['request']['tag'] = array($tag);
        }
        if (!empty($author)) {
            $request_data['request']['author'] = $author;
        }

        $response = wp_remote_get(add_query_arg($request_data, $url), array(
            'timeout' => 15,
            'user-agent' => 'WordPress/' . get_bloginfo('version') . '; ' . home_url()
        ));

        if (is_wp_error($response)) {
            throw new Exception('Failed to search WordPress.org: ' . $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid response from WordPress.org');
        }

        $themes = array();
        if (isset($data['themes']) && is_array($data['themes'])) {
            foreach ($data['themes'] as $theme) {
                $themes[] = array(
                    'name' => $theme['name'] ?? '',
                    'slug' => $theme['slug'] ?? '',
                    'version' => $theme['version'] ?? '',
                    'author' => strip_tags($theme['author']['display_name'] ?? $theme['author'] ?? ''),
                    'rating' => floatval($theme['rating'] ?? 0),
                    'num_ratings' => intval($theme['num_ratings'] ?? 0),
                    'downloaded' => intval($theme['downloaded'] ?? 0),
                    'last_updated' => $theme['last_updated'] ?? '',
                    'requires' => $theme['requires'] ?? '',
                    'requires_php' => $theme['requires_php'] ?? '',
                    'homepage' => $theme['homepage'] ?? '',
                    'preview_url' => $theme['preview_url'] ?? '',
                    'screenshot_url' => $theme['screenshot_url'] ?? '',
                    'tags' => is_array($theme['tags'] ?? null) ? array_keys($theme['tags']) : array()
                );
            }
        }

        return array(
            'themes' => $themes,
            'info' => array(
                'page' => $page,
                'pages' => intval($data['info']['pages'] ?? 1),
                'results' => intval($data['info']['results'] ?? 0)
            )
        );
    }

    /**
     * Get detailed information about a specific theme from WordPress.org repository
     */
    public function wp_get_repo_theme_info($args) {
        $slug = $args['slug'] ?? '';

        if (empty($slug)) {
            throw new Exception('Theme slug is required');
        }

        $url = 'https://api.wordpress.org/themes/info/1.2/';
        $request_data = array(
            'action' => 'theme_information',
            'request' => array(
                'slug' => $slug,
                'fields' => array(
                    'description' => true,
                    'sections' => true,
                    'rating' => true,
                    'ratings' => true,
                    'downloaded' => true,
                    'download_link' => true,
                    'last_updated' => true,
                    'homepage' => true,
                    'tags' => true,
                    'screenshot_url' => true,
                    'screenshots' => true,
                    'preview_url' => true
                )
            )
        );

        $response = wp_remote_get(add_query_arg($request_data, $url), array(
            'timeout' => 15,
            'user-agent' => 'WordPress/' . get_bloginfo('version') . '; ' . home_url()
        ));

        if (is_wp_error($response)) {
            throw new Exception('Failed to get theme info from WordPress.org: ' . $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $theme = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE || empty($theme)) {
            throw new Exception('Theme not found or invalid response from WordPress.org');
        }

        // Check if already installed
        $installed_themes = wp_get_themes();
        $is_installed = isset($installed_themes[$slug]);
        $current_theme = get_stylesheet();

        return array(
            'name' => $theme['name'] ?? '',
            'slug' => $theme['slug'] ?? '',
            'version' => $theme['version'] ?? '',
            'author' => strip_tags($theme['author']['display_name'] ?? $theme['author'] ?? ''),
            'rating' => floatval($theme['rating'] ?? 0),
            'num_ratings' => intval($theme['num_ratings'] ?? 0),
            'downloaded' => intval($theme['downloaded'] ?? 0),
            'last_updated' => $theme['last_updated'] ?? '',
            'requires' => $theme['requires'] ?? '',
            'requires_php' => $theme['requires_php'] ?? '',
            'description' => $theme['sections']['description'] ?? '',
            'homepage' => $theme['homepage'] ?? '',
            'preview_url' => $theme['preview_url'] ?? '',
            'download_link' => $theme['download_link'] ?? '',
            'screenshot_url' => $theme['screenshot_url'] ?? '',
            'screenshots' => $theme['screenshots'] ?? array(),
            'tags' => is_array($theme['tags'] ?? null) ? array_keys($theme['tags']) : array(),
            'is_installed' => $is_installed,
            'is_active' => ($current_theme === $slug)
        );
    }

    /**
     * Install a theme from WordPress.org repository
     */
    public function wp_install_repo_theme($args) {
        if (!current_user_can('install_themes')) {
            throw new Exception('Insufficient permissions. User must have install_themes capability.');
        }

        $slug = $args['slug'] ?? '';
        $activate = $args['activate'] ?? false;

        if (empty($slug)) {
            throw new Exception('Theme slug is required');
        }

        // Check if theme is already installed
        $installed_themes = wp_get_themes();
        if (isset($installed_themes[$slug])) {
            if ($activate && get_stylesheet() !== $slug) {
                switch_theme($slug);
                return array(
                    'success' => true,
                    'message' => 'Theme was already installed and has been activated',
                    'theme_slug' => $slug,
                    'activated' => true
                );
            }
            return array(
                'success' => true,
                'message' => 'Theme is already installed',
                'theme_slug' => $slug,
                'activated' => (get_stylesheet() === $slug)
            );
        }

        // Include required WordPress files and maintain compatibility across WP versions
        if (!function_exists('themes_api')) {
            $theme_include_files = array(
                ABSPATH . 'wp-admin/includes/theme.php',
                ABSPATH . 'wp-admin/includes/theme-install.php',
            );
            foreach ($theme_include_files as $include_file) {
                if (file_exists($include_file)) {
                    require_once $include_file;
                    if (function_exists('themes_api')) {
                        break;
                    }
                }
            }
        }

        // Get theme information
        $api = \themes_api('theme_information', array(
            'slug' => $slug,
            'fields' => array(
                'sections' => false,
                'tags' => false,
                'ratings' => false,
                'screenshots' => false,
                'description' => false,
                'requires' => true,
                'requires_php' => true,
                'downloaded' => false,
                'last_updated' => false
            )
        ));

        if (is_wp_error($api)) {
            throw new Exception('Failed to get theme information: ' . $api->get_error_message());
        }

        // Check WordPress version compatibility
        if (!empty($api->requires) && version_compare(get_bloginfo('version'), $api->requires, '<')) {
            throw new Exception('Theme requires WordPress version ' . $api->requires . ' or higher. Current version: ' . get_bloginfo('version'));
        }

        // Check PHP version compatibility
        if (!empty($api->requires_php) && version_compare(PHP_VERSION, $api->requires_php, '<')) {
            throw new Exception('Theme requires PHP version ' . $api->requires_php . ' or higher. Current version: ' . PHP_VERSION);
        }

        // Install the theme
        $upgrader = new \Theme_Upgrader(new \WP_Ajax_Upgrader_Skin());
        $install_result = $upgrader->install($api->download_link);

        if (is_wp_error($install_result)) {
            throw new Exception('Theme installation failed: ' . $install_result->get_error_message());
        }

        if (!$install_result) {
            throw new Exception('Theme installation failed: Unknown error');
        }

        $theme_slug = $upgrader->theme_info();
        if (!$theme_slug) {
            $theme_slug = $slug; // Fallback to provided slug
        }

        $result = array(
            'success' => true,
            'message' => 'Theme installed successfully',
            'theme_slug' => $theme_slug,
            'activated' => false
        );

        // Activate if requested
        if ($activate) {
            switch_theme($theme_slug);
            $result['activated'] = true;
            $result['message'] = 'Theme installed and activated successfully';
        }

        return $result;
    }
    /**
     * Check for available plugin updates
     */
    public function wp_check_plugin_updates($args) {
        if (!current_user_can('update_plugins')) {
            throw new Exception('Insufficient permissions. User must have update_plugins capability.');
        }

        // Force check for updates
        wp_update_plugins();

        $updates = get_site_transient('update_plugins');
        $installed_plugins = get_plugins();
        
        $plugins_with_updates = array();

        if (!empty($updates->response)) {
            foreach ($updates->response as $plugin_file => $plugin_data) {
                if (isset($installed_plugins[$plugin_file])) {
                    $plugins_with_updates[] = array(
                        'name' => $installed_plugins[$plugin_file]['Name'],
                        'plugin_file' => $plugin_file,
                        'current_version' => $installed_plugins[$plugin_file]['Version'],
                        'new_version' => $plugin_data->new_version,
                        'package' => $plugin_data->package ?? '',
                        'is_active' => is_plugin_active($plugin_file),
                        'update_info' => array(
                            'requires' => $plugin_data->requires ?? '',
                            'tested' => $plugin_data->tested ?? '',
                            'requires_php' => $plugin_data->requires_php ?? ''
                        )
                    );
                }
            }
        }

        return array(
            'plugins_with_updates' => $plugins_with_updates,
            'total_updates' => count($plugins_with_updates),
            'last_checked' => get_site_transient('update_plugins')->last_checked ?? null
        );
    }

    /**
     * Update a specific plugin
     */
    public function wp_update_plugin($args) {
        if (!current_user_can('update_plugins')) {
            throw new Exception('Insufficient permissions. User must have update_plugins capability.');
        }

        $plugin_file = $args['plugin_file'] ?? '';

        if (empty($plugin_file)) {
            throw new Exception('Plugin file is required');
        }

        // Check if plugin exists
        $installed_plugins = get_plugins();
        if (!isset($installed_plugins[$plugin_file])) {
            throw new Exception('Plugin not found: ' . $plugin_file);
        }

        // Check if update is available
        wp_update_plugins();
        $updates = get_site_transient('update_plugins');
        
        if (!isset($updates->response[$plugin_file])) {
            return array(
                'success' => true,
                'message' => 'Plugin is already up to date',
                'plugin_name' => $installed_plugins[$plugin_file]['Name'],
                'current_version' => $installed_plugins[$plugin_file]['Version'],
                'updated' => false
            );
        }

        // Include required WordPress files
        if (!class_exists('\WP_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        $was_active = is_plugin_active($plugin_file);
        $plugin_name = $installed_plugins[$plugin_file]['Name'];
        $old_version = $installed_plugins[$plugin_file]['Version'];
        $new_version = $updates->response[$plugin_file]->new_version;

        // Perform the update
        $upgrader = new \Plugin_Upgrader(new \WP_Ajax_Upgrader_Skin());
        $result = $upgrader->upgrade($plugin_file);

        if (is_wp_error($result)) {
            throw new Exception('Plugin update failed: ' . $result->get_error_message());
        }

        if (!$result) {
            throw new Exception('Plugin update failed: Unknown error');
        }

        // Reactivate plugin if it was active before update
        if ($was_active) {
            $activation_result = activate_plugin($plugin_file);
            if (is_wp_error($activation_result)) {
                throw new Exception('Plugin updated but failed to reactivate: ' . $activation_result->get_error_message());
            }
        }

        return array(
            'success' => true,
            'message' => 'Plugin updated successfully',
            'plugin_name' => $plugin_name,
            'plugin_file' => $plugin_file,
            'old_version' => $old_version,
            'new_version' => $new_version,
            'was_active' => $was_active,
            'updated' => true
        );
    }

    /**
     * Update all plugins that have updates available
     */
    public function wp_update_all_plugins($args) {
        if (!current_user_can('update_plugins')) {
            throw new Exception('Insufficient permissions. User must have update_plugins capability.');
        }

        // Get available updates
        $check_result = $this->wp_check_plugin_updates(array());
        $plugins_to_update = $check_result['plugins_with_updates'];

        if (empty($plugins_to_update)) {
            return array(
                'success' => true,
                'message' => 'All plugins are already up to date',
                'updated_plugins' => array(),
                'total_updated' => 0,
                'failed_updates' => array()
            );
        }

        $updated_plugins = array();
        $failed_updates = array();

        foreach ($plugins_to_update as $plugin) {
            try {
                $update_result = $this->wp_update_plugin(array('plugin_file' => $plugin['plugin_file']));
                if ($update_result['updated']) {
                    $updated_plugins[] = $update_result;
                }
            } catch (Exception $e) {
                $failed_updates[] = array(
                    'plugin_name' => $plugin['name'],
                    'plugin_file' => $plugin['plugin_file'],
                    'error' => $e->getMessage()
                );
            }
        }

        $message = '';
        if (!empty($updated_plugins)) {
            $message .= 'Successfully updated ' . count($updated_plugins) . ' plugin(s)';
        }
        if (!empty($failed_updates)) {
            if (!empty($message)) $message .= '. ';
            $message .= count($failed_updates) . ' plugin(s) failed to update';
        }

        return array(
            'success' => true,
            'message' => $message,
            'updated_plugins' => $updated_plugins,
            'total_updated' => count($updated_plugins),
            'failed_updates' => $failed_updates
        );
    }

    /**
     * Check for available theme updates
     */
    public function wp_check_theme_updates($args) {
        if (!current_user_can('update_themes')) {
            throw new Exception('Insufficient permissions. User must have update_themes capability.');
        }

        // Force check for updates
        wp_update_themes();

        $updates = get_site_transient('update_themes');
        $installed_themes = wp_get_themes();
        
        $themes_with_updates = array();

        if (!empty($updates->response)) {
            foreach ($updates->response as $theme_slug => $theme_data) {
                if (isset($installed_themes[$theme_slug])) {
                    $theme = $installed_themes[$theme_slug];
                    $themes_with_updates[] = array(
                        'name' => $theme->get('Name'),
                        'theme_slug' => $theme_slug,
                        'current_version' => $theme->get('Version'),
                        'new_version' => $theme_data['new_version'],
                        'package' => $theme_data['package'] ?? '',
                        'is_active' => (get_stylesheet() === $theme_slug),
                        'update_info' => array(
                            'requires' => $theme_data['requires'] ?? '',
                            'tested' => $theme_data['tested'] ?? '',
                            'requires_php' => $theme_data['requires_php'] ?? ''
                        )
                    );
                }
            }
        }

        return array(
            'themes_with_updates' => $themes_with_updates,
            'total_updates' => count($themes_with_updates),
            'last_checked' => get_site_transient('update_themes')->last_checked ?? null
        );
    }

    /**
     * Update a specific theme
     */
    public function wp_update_theme($args) {
        if (!current_user_can('update_themes')) {
            throw new Exception('Insufficient permissions. User must have update_themes capability.');
        }

        $theme_slug = $args['theme_slug'] ?? '';

        if (empty($theme_slug)) {
            throw new Exception('Theme slug is required');
        }

        // Check if theme exists
        $installed_themes = wp_get_themes();
        if (!isset($installed_themes[$theme_slug])) {
            throw new Exception('Theme not found: ' . $theme_slug);
        }

        // Check if update is available
        wp_update_themes();
        $updates = get_site_transient('update_themes');
        
        if (!isset($updates->response[$theme_slug])) {
            return array(
                'success' => true,
                'message' => 'Theme is already up to date',
                'theme_name' => $installed_themes[$theme_slug]->get('Name'),
                'current_version' => $installed_themes[$theme_slug]->get('Version'),
                'updated' => false
            );
        }

        // Include required WordPress files
        if (!class_exists('\WP_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        $was_active = (get_stylesheet() === $theme_slug);
        $theme_name = $installed_themes[$theme_slug]->get('Name');
        $old_version = $installed_themes[$theme_slug]->get('Version');
        $new_version = $updates->response[$theme_slug]['new_version'];

        // Perform the update
        $upgrader = new \Theme_Upgrader(new \WP_Ajax_Upgrader_Skin());
        $result = $upgrader->upgrade($theme_slug);

        if (is_wp_error($result)) {
            throw new Exception('Theme update failed: ' . $result->get_error_message());
        }

        if (!$result) {
            throw new Exception('Theme update failed: Unknown error');
        }

        return array(
            'success' => true,
            'message' => 'Theme updated successfully',
            'theme_name' => $theme_name,
            'theme_slug' => $theme_slug,
            'old_version' => $old_version,
            'new_version' => $new_version,
            'was_active' => $was_active,
            'updated' => true
        );
    }

    /**
     * Update all themes that have updates available
     */
    public function wp_update_all_themes($args) {
        if (!current_user_can('update_themes')) {
            throw new Exception('Insufficient permissions. User must have update_themes capability.');
        }

        // Get available updates
        $check_result = $this->wp_check_theme_updates(array());
        $themes_to_update = $check_result['themes_with_updates'];

        if (empty($themes_to_update)) {
            return array(
                'success' => true,
                'message' => 'All themes are already up to date',
                'updated_themes' => array(),
                'total_updated' => 0,
                'failed_updates' => array()
            );
        }

        $updated_themes = array();
        $failed_updates = array();

        foreach ($themes_to_update as $theme) {
            try {
                $update_result = $this->wp_update_theme(array('theme_slug' => $theme['theme_slug']));
                if ($update_result['updated']) {
                    $updated_themes[] = $update_result;
                }
            } catch (Exception $e) {
                $failed_updates[] = array(
                    'theme_name' => $theme['name'],
                    'theme_slug' => $theme['theme_slug'],
                    'error' => $e->getMessage()
                );
            }
        }

        $message = '';
        if (!empty($updated_themes)) {
            $message .= 'Successfully updated ' . count($updated_themes) . ' theme(s)';
        }
        if (!empty($failed_updates)) {
            if (!empty($message)) $message .= '. ';
            $message .= count($failed_updates) . ' theme(s) failed to update';
        }

        return array(
            'success' => true,
            'message' => $message,
            'updated_themes' => $updated_themes,
            'total_updated' => count($updated_themes),
            'failed_updates' => $failed_updates
        );
    }
    
    /**
     * Register DataForSEO tools
     */
    private function register_dataforseo_tools() {
        // Get the DataForSEO instance from the main plugin
        if (function_exists('MATDFS') && MATDFS()) {
            $dataforseo = MATDFS();
            
            // Check if DataForSEO is available
            if (!$dataforseo->is_available()) {
                return;
            }
            
            // Register helper tool for location suggestions
            $this->register_tool(array(
                'name' => 'dataforseo_suggest_location',
                'description' => 'Get suggested location and language codes based on keyword context. Use this BEFORE making SEO requests to get intelligent suggestions.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'keyword' => array(
                            'type' => 'string',
                            'description' => 'The keyword to analyze for location/language context'
                        )
                    ),
                    'required' => array('keyword')
                ),
                'callback' => array($dataforseo, 'handle_location_suggestion')
            ));
            
            // Register SERP analysis tool
            $this->register_tool(array(
                'name' => 'dataforseo_serp_analysis',
                'description' => 'Analyze SERP (Search Engine Results Page) for a specific keyword. IMPORTANT: Always consider the language and geographic context of the keyword to select appropriate location_code and language_code.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'keyword' => array(
                            'type' => 'string',
                            'description' => 'The keyword to analyze SERP for'
                        ),
                        'location_code' => array(
                            'type' => 'integer',
                            'description' => 'Location code for search. Common codes: USA (2840), Germany (2276), UK (2826), France (2250), Spain (2724), Canada (2124), Australia (2036). Choose based on keyword language/target market. Ask user if unclear.'
                        ),
                        'language_code' => array(
                            'type' => 'string',
                            'description' => 'Language code. Common codes: en (English), de (German), fr (French), es (Spanish), it (Italian). Must match the keyword language. Ask user if unclear.'
                        ),
                        'device' => array(
                            'type' => 'string',
                            'description' => 'Device type: desktop, mobile, or tablet',
                            'enum' => array('desktop', 'mobile', 'tablet'),
                            'default' => 'desktop'
                        )
                    ),
                    'required' => array('keyword', 'location_code', 'language_code')
                ),
                'callback' => array($dataforseo, 'handle_serp_analysis')
            ));
            
            // Register keyword difficulty tool
            $this->register_tool(array(
                'name' => 'dataforseo_keyword_difficulty',
                'description' => 'Get keyword difficulty and search volume data. IMPORTANT: Consider the language and geographic context of keywords to select appropriate location_code and language_code.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'keywords' => array(
                            'type' => 'array',
                            'items' => array('type' => 'string'),
                            'description' => 'Array of keywords to analyze (max 1000)'
                        ),
                        'location_code' => array(
                            'type' => 'integer',
                            'description' => 'Location code for search. Common codes: USA (2840), Germany (2276), UK (2826), France (2250), Spain (2724), Canada (2124), Australia (2036). Choose based on keyword language/target market. Ask user if unclear.'
                        ),
                        'language_code' => array(
                            'type' => 'string',
                            'description' => 'Language code. Common codes: en (English), de (German), fr (French), es (Spanish), it (Italian). Must match the keyword language. Ask user if unclear.'
                        )
                    ),
                    'required' => array('keywords', 'location_code', 'language_code')
                ),
                'callback' => array($dataforseo, 'handle_keyword_difficulty')
            ));
            
            // Register domain analysis tool
            $this->register_tool(array(
                'name' => 'dataforseo_domain_analysis',
                'description' => 'Analyze domain metrics and SEO performance including backlinks, organic keywords, and authority',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'domain' => array(
                            'type' => 'string',
                            'description' => 'Domain to analyze (without http/https)'
                        ),
                        'analysis_type' => array(
                            'type' => 'string',
                            'description' => 'Type of analysis: overview, backlinks, or organic_keywords',
                            'enum' => array('overview', 'backlinks', 'organic_keywords'),
                            'default' => 'overview'
                        )
                    ),
                    'required' => array('domain')
                ),
                'callback' => array($dataforseo, 'handle_domain_analysis')
            ));
            
            // Register competitor analysis tool
            $this->register_tool(array(
                'name' => 'dataforseo_competitor_analysis',
                'description' => 'Find competitors and analyze their SEO performance. IMPORTANT: Consider the geographic market of the domain to select appropriate location_code.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'domain' => array(
                            'type' => 'string',
                            'description' => 'Your domain to find competitors for'
                        ),
                        'limit' => array(
                            'type' => 'integer',
                            'description' => 'Number of competitors to return (max 100)',
                            'default' => 10,
                            'maximum' => 100
                        ),
                        'location_code' => array(
                            'type' => 'integer',
                            'description' => 'Location code for search. Common codes: USA (2840), Germany (2276), UK (2826), France (2250), Spain (2724), Canada (2124), Australia (2036). Choose based on target market. Ask user if unclear.'
                        )
                    ),
                    'required' => array('domain', 'location_code')
                ),
                'callback' => array($dataforseo, 'handle_competitor_analysis')
            ));
            
            // Register technical SEO audit tool
            $this->register_tool(array(
                'name' => 'dataforseo_technical_audit',
                'description' => 'Perform technical SEO audit of a website including performance, accessibility, and best practices',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'url' => array(
                            'type' => 'string',
                            'description' => 'URL to audit (full URL including protocol)'
                        ),
                        'audit_type' => array(
                            'type' => 'string',
                            'description' => 'Type of audit: lighthouse, page_speed, or crawl',
                            'enum' => array('lighthouse', 'page_speed', 'crawl'),
                            'default' => 'lighthouse'
                        )
                    ),
                    'required' => array('url')
                ),
                'callback' => array($dataforseo, 'handle_technical_audit')
            ));
            
            // Register manual competitors tool
            $this->register_tool(array(
                'name' => 'dataforseo_get_manual_competitors',
                'description' => 'Get manually configured competitors from settings as a fallback when automated competitor analysis fails or returns insufficient data',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => new \stdClass()
                ),
                'callback' => array($dataforseo, 'get_manual_competitors')
            ));
            
            // Register content generation tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_generate',
                'description' => 'Generate content based on initial text using DataForSEO Content Generation API. Use this to continue or expand existing text.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'text' => array(
                            'type' => 'string',
                            'description' => 'The initial text to continue or expand upon (1-500 tokens)'
                        ),
                        'creativity_index' => array(
                            'type' => 'number',
                            'description' => 'Creativity level from 0 to 1 (default: 0.5)',
                            'minimum' => 0,
                            'maximum' => 1,
                            'default' => 0.5
                        ),
                        'max_new_tokens' => array(
                            'type' => 'integer',
                            'description' => 'Maximum number of new tokens to generate (default: 100)',
                            'minimum' => 1,
                            'maximum' => 300,
                            'default' => 100
                        ),
                        'max_tokens' => array(
                            'type' => 'integer',
                            'description' => 'Maximum total tokens including input (default: 1024)',
                            'minimum' => 1,
                            'maximum' => 1024,
                            'default' => 1024
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('text')
                ),
                'callback' => array($dataforseo, 'handle_content_generate')
            ));
            
            // Register text generation tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_generate_text',
                'description' => 'Generate text content based on a topic using DataForSEO Content Generation API. Use this to create new content from scratch.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'topic' => array(
                            'type' => 'string',
                            'description' => 'The main topic to generate content about (1-50 tokens)'
                        ),
                        'word_count' => array(
                            'type' => 'integer',
                            'description' => 'Desired word count for the generated text (default: 100)',
                            'minimum' => 10,
                            'maximum' => 1000,
                            'default' => 100
                        ),
                        'creativity_index' => array(
                            'type' => 'number',
                            'description' => 'Creativity level from 0 to 1 (default: 0.5)',
                            'minimum' => 0,
                            'maximum' => 1,
                            'default' => 0.5
                        ),
                        'sub_topics' => array(
                            'type' => 'array',
                            'items' => array('type' => 'string'),
                            'description' => 'Optional array of sub-topics to include'
                        ),
                        'meta_keywords' => array(
                            'type' => 'array',
                            'items' => array('type' => 'string'),
                            'description' => 'Optional array of keywords to incorporate'
                        ),
                        'avoid_words' => array(
                            'type' => 'array',
                            'items' => array('type' => 'string'),
                            'description' => 'Optional array of words to avoid'
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('topic')
                ),
                'callback' => array($dataforseo, 'handle_content_generate_text')
            ));
            
            // Register meta tags generation tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_generate_meta_tags',
                'description' => 'Generate SEO-optimized meta title and description based on content using DataForSEO Content Generation API.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'content' => array(
                            'type' => 'string',
                            'description' => 'The content to generate meta tags for'
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('content')
                ),
                'callback' => array($dataforseo, 'handle_content_generate_meta_tags')
            ));
            
            // Register sub-topics generation tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_generate_sub_topics',
                'description' => 'Generate relevant sub-topics for a given topic using DataForSEO Content Generation API. Returns 10 related subtopics.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'topic' => array(
                            'type' => 'string',
                            'description' => 'The main topic to generate sub-topics for'
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('topic')
                ),
                'callback' => array($dataforseo, 'handle_content_generate_sub_topics')
            ));
            
            // Register paraphrase tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_paraphrase',
                'description' => 'Paraphrase or rewrite existing text using DataForSEO Content Generation API. Use this to create variations of existing content.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'text' => array(
                            'type' => 'string',
                            'description' => 'The text to paraphrase or rewrite'
                        ),
                        'creativity_index' => array(
                            'type' => 'number',
                            'description' => 'Creativity level from 0 to 1 (default: 0.5)',
                            'minimum' => 0,
                            'maximum' => 1,
                            'default' => 0.5
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('text')
                ),
                'callback' => array($dataforseo, 'handle_content_paraphrase')
            ));
            
            // Register grammar check tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_check_grammar',
                'description' => 'Check grammar and spelling in text using DataForSEO Content Generation API. Provides detailed error detection and suggestions.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'text' => array(
                            'type' => 'string',
                            'description' => 'The text to check for grammar and spelling errors (1-10000 tokens)'
                        ),
                        'language_code' => array(
                            'type' => 'string',
                            'description' => 'Language code for grammar checking (default: en)',
                            'default' => 'en'
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('text')
                ),
                'callback' => array($dataforseo, 'handle_content_check_grammar')
            ));
            
            // Register text summary tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_text_summary',
                'description' => 'Analyze text and provide comprehensive summary with readability metrics using DataForSEO Content Generation API.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => array(
                        'text' => array(
                            'type' => 'string',
                            'description' => 'The text to analyze and summarize (1-10000 tokens)'
                        ),
                        'language_code' => array(
                            'type' => 'string',
                            'description' => 'Language code for text analysis (default: en)',
                            'default' => 'en'
                        ),
                        'tag' => array(
                            'type' => 'string',
                            'description' => 'Optional tag for tracking (max 255 characters)'
                        )
                    ),
                    'required' => array('text')
                ),
                'callback' => array($dataforseo, 'handle_content_text_summary')
            ));
            
            // Register grammar languages tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_grammar_languages',
                'description' => 'Get list of supported languages for grammar checking using DataForSEO Content Generation API.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => new \stdClass()
                ),
                'callback' => array($dataforseo, 'handle_content_grammar_languages')
            ));
            
            // Register grammar rules tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_grammar_rules',
                'description' => 'Get available grammar rules and categories from DataForSEO Content Generation API.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => new \stdClass()
                ),
                'callback' => array($dataforseo, 'handle_content_grammar_rules')
            ));
            
            // Register summary languages tool
            $this->register_tool(array(
                'name' => 'dataforseo_content_summary_languages',
                'description' => 'Get list of supported languages for text summary analysis using DataForSEO Content Generation API.',
                'inputSchema' => array(
                    'type' => 'object',
                    'properties' => new \stdClass()
                ),
                'callback' => array($dataforseo, 'handle_content_summary_languages')
            ));
        }
    }
    
    /**
     * Register PageSpeed Insights tools
     */
    private function register_pagespeed_tools() {
        // Get the PageSpeed service from the main plugin instance
        $pagespeed_service = magic_assistant()->get_pagespeed_service();
        
        // Check if service is available
        if (!$pagespeed_service || !$pagespeed_service->is_available()) {
            return;
        }
        
        // Register PageSpeed Insights analysis tool
        $this->register_tool(array(
            'name' => 'pagespeed_analyze',
            'description' => 'Analyze website performance using Google PageSpeed Insights through MagicProxy. Provides detailed performance metrics including Core Web Vitals, accessibility, best practices, and SEO scores. Data is saved ONLY to pagespeed_data (never to seo_data) with base64 image filtering.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'url' => array(
                        'type' => 'string',
                        'description' => 'The URL to analyze (must include https:// or http://)'
                    ),
                    'strategy' => array(
                        'type' => 'string',
                        'description' => 'Analysis strategy: mobile or desktop',
                        'enum' => array('mobile', 'desktop'),
                        'default' => 'mobile'
                    ),
                    'category' => array(
                        'type' => 'array',
                        'items' => array(
                            'type' => 'string',
                            'enum' => array('performance', 'accessibility', 'best-practices', 'seo')
                        ),
                        'description' => 'Categories to analyze. If not specified, all categories will be analyzed.',
                        'default' => array('performance', 'accessibility', 'best-practices', 'seo')
                    ),
                    'locale' => array(
                        'type' => 'string',
                        'description' => 'Locale for the analysis (e.g., en, de, fr, es)',
                        'default' => 'en'
                    )
                ),
                'required' => array('url')
            ),
            'callback' => array($pagespeed_service, 'handle_pagespeed_analysis')
        ));
    }

    /**
     * Register Unsplash tools for image search via MagicProxy
     */
    private function register_unsplash_tools() {
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/Unsplash_Service.php';
        $unsplash_service = new Unsplash_Service($this->ai_provider);

        $this->register_tool(array(
            'name' => 'unsplash_search_images',
            'description' => 'Search images using the Unsplash API via MagicProxy',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'query' => array('type' => 'string', 'description' => 'Search query for images'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of images per page', 'default' => 10),
                    'orientation' => array('type' => 'string', 'description' => 'Image orientation (landscape, portrait, squarish)', 'enum' => array('landscape', 'portrait', 'squarish'), 'default' => 'landscape'),
                ),
                'required' => array('query')
            ),
            'callback' => array($unsplash_service, 'search_images')
        ));

        $this->register_tool(array(
            'name' => 'unsplash_get_random_images',
            'description' => 'Get random images from Unsplash API via MagicProxy',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'count' => array('type' => 'integer', 'description' => 'Number of random images to fetch', 'default' => 1),
                    'orientation' => array('type' => 'string', 'description' => 'Image orientation (landscape, portrait, squarish)', 'enum' => array('landscape', 'portrait', 'squarish'), 'default' => 'landscape'),
                    'query' => array('type' => 'string', 'description' => 'Optional search keyword'),
                )
            ),
            'callback' => array($unsplash_service, 'get_random_images')
        ));
    }

    /**
     * Register SEO analysis tools for direct site inspection
     */
    private function register_seo_analysis_tools() {
        // Initialize SEO Data Extractor
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/SEO_Data_Extractor.php';
        
        // SEO Plugin Status
        $this->register_tool(array(
            'name' => 'seo_plugin_status',
            'description' => 'Get information about active SEO plugins and their configurations',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'detailed' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to include detailed configuration information (default: false)'
                    )
                )
            ),
            'callback' => array($this, 'seo_plugin_status')
        ));
        
        // Meta tags analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_meta_tags',
            'description' => 'Analyze meta title, description, and other meta tags for a specific page or all pages',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'url' => array(
                        'type' => 'string',
                        'description' => 'Specific URL to analyze (optional, defaults to homepage)'
                    ),
                    'analyze_all_pages' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to analyze all published pages (default: false)'
                    ),
                    'max_pages' => array(
                        'type' => 'integer',
                        'description' => 'Maximum number of pages to analyze when analyze_all_pages is true (default: 50)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_meta_tags')
        ));

        // Schema/structured data analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_structured_data',
            'description' => 'Detect and analyze schema markup and structured data on pages',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'url' => array(
                        'type' => 'string',
                        'description' => 'Specific URL to analyze (optional, defaults to homepage)'
                    ),
                    'analyze_all_pages' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to analyze all published pages (default: false)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_structured_data')
        ));

        // OpenGraph tags analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_opengraph',
            'description' => 'Analyze OpenGraph meta tags for social media sharing',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'url' => array(
                        'type' => 'string',
                        'description' => 'Specific URL to analyze (optional, defaults to homepage)'
                    ),
                    'analyze_all_pages' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to analyze all published pages (default: false)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_opengraph')
        ));

        // Sitemap analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_sitemap',
            'description' => 'Analyze XML sitemaps and their structure',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'sitemap_url' => array(
                        'type' => 'string',
                        'description' => 'Custom sitemap URL (optional, will auto-detect if not provided)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_sitemap')
        ));

        // Canonical URLs analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_canonical_urls',
            'description' => 'Analyze canonical URLs across the site to detect issues',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'max_pages' => array(
                        'type' => 'integer',
                        'description' => 'Maximum number of pages to analyze (default: 100)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_canonical_urls')
        ));

        // Internal linking analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_internal_links',
            'description' => 'Analyze internal linking structure and patterns',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'max_pages' => array(
                        'type' => 'integer',
                        'description' => 'Maximum number of pages to analyze (default: 50)'
                    ),
                    'include_orphaned' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to find orphaned pages (default: true)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_internal_links')
        ));

        // Indexation analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_indexation',
            'description' => 'Analyze indexation status and robots meta tags',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'check_robots_txt' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to analyze robots.txt file (default: true)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_indexation')
        ));

        // Page-specific SEO analysis
        $this->register_tool(array(
            'name' => 'seo_analyze_page_content',
            'description' => 'Analyze page-specific SEO elements like headings, images alt text, and accessibility',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'url' => array(
                        'type' => 'string',
                        'description' => 'Specific URL to analyze (optional, defaults to homepage)'
                    ),
                    'post_id' => array(
                        'type' => 'integer',
                        'description' => 'WordPress post/page ID to analyze (alternative to URL)'
                    ),
                    'analyze_all_pages' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to analyze all published pages (default: false)'
                    ),
                    'max_pages' => array(
                        'type' => 'integer',
                        'description' => 'Maximum number of pages to analyze when analyze_all_pages is true (default: 20)'
                    )
                )
            ),
            'callback' => array($this, 'seo_analyze_page_content')
        ));

        // Comprehensive SEO audit
        $this->register_tool(array(
            'name' => 'seo_comprehensive_audit',
            'description' => 'Perform a comprehensive SEO audit covering all aspects of on-page SEO',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'max_pages' => array(
                        'type' => 'integer',
                        'description' => 'Maximum number of pages to analyze (default: 25)'
                    ),
                    'include_performance' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to include basic performance metrics (default: true)'
                    )
                )
            ),
            'callback' => array($this, 'seo_comprehensive_audit')
        ));

        // Get SEO settings for targeted analysis
        $this->register_tool(array(
            'name' => 'get_seo_settings',
            'description' => 'Get the user-configured SEO settings including target keywords, location, language, and competitors. This provides context for SEO analysis and keyword research.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => (object)array()
            ),
            'callback' => array($this, 'get_seo_settings')
        ));
    }

    /**
     * Analyze meta tags for a page or all pages with plugin integration
     */
    public function seo_analyze_meta_tags($args) {
        $url = isset($args['url']) ? $args['url'] : home_url();
        $analyze_all = isset($args['analyze_all_pages']) ? $args['analyze_all_pages'] : false;
        $max_pages = isset($args['max_pages']) ? intval($args['max_pages']) : 50;

        // Initialize SEO Data Extractor
        $seo_extractor = new SEO_Data_Extractor();
        $results = array();

        if ($analyze_all) {
            // Get all published pages and posts
            $posts = get_posts(array(
                'post_type' => array('post', 'page'),
                'post_status' => 'publish',
                'numberposts' => $max_pages,
                'orderby' => 'date',
                'order' => 'DESC'
            ));

            foreach ($posts as $post) {
                $page_url = get_permalink($post->ID);
                
                // Try plugin integration first, fallback to HTML parsing
                $plugin_data = $seo_extractor->extract_meta_tags($page_url, $post->ID);
                if ($plugin_data && !isset($plugin_data['error'])) {
                    $plugin_data['post_title'] = $post->post_title;
                    $plugin_data['url'] = $page_url;
                    $plugin_data['post_id'] = $post->ID;
                    $plugin_data['post_type'] = $post->post_type;
                    $results[] = $plugin_data;
                } else {
                    // Fallback to HTML parsing
                    $results[] = $this->analyze_single_page_meta($page_url, $post);
                }
            }
        } else {
            // Analyze single page
            $post_id = url_to_postid($url);
            $post = $post_id ? get_post($post_id) : null;
            
            // Try plugin integration first
            $plugin_data = $seo_extractor->extract_meta_tags($url, $post_id);
            if ($plugin_data && !isset($plugin_data['error'])) {
                if ($post) {
                    $plugin_data['post_title'] = $post->post_title;
                    $plugin_data['post_id'] = $post->ID;
                    $plugin_data['post_type'] = $post->post_type;
                }
                $plugin_data['url'] = $url;
                $results[] = $plugin_data;
            } else {
                // Fallback to HTML parsing
                $results[] = $this->analyze_single_page_meta($url, $post);
            }
        }

        $summary = $this->generate_meta_tags_summary($results);
        
        // Save data to database for SEO Analytics view
        $this->save_meta_analysis_to_db($results, $summary, $seo_extractor);
        
        return array(
            'success' => true,
            'analyzed_pages' => count($results),
            'active_seo_plugins' => $seo_extractor->get_active_plugins(),
            'data_source' => count($seo_extractor->get_active_plugins()) > 0 ? 'plugin_integration_with_fallback' : 'html_parsing',
            'pages' => $results,
            'summary' => $summary
        );
    }

    /**
     * Analyze meta tags for a single page
     */
    private function analyze_single_page_meta($url, $post = null) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return array(
                'url' => $url,
                'error' => $response->get_error_message()
            );
        }

        $body = wp_remote_retrieve_body($response);
        $doc = new \DOMDocument();
        @$doc->loadHTML($body);
        $xpath = new \DOMXPath($doc);

        // Extract meta tags
        $title = $xpath->query('//title')->item(0);
        $meta_description = $xpath->query('//meta[@name="description"]')->item(0);
        $meta_keywords = $xpath->query('//meta[@name="keywords"]')->item(0);
        $meta_robots = $xpath->query('//meta[@name="robots"]')->item(0);
        $meta_viewport = $xpath->query('//meta[@name="viewport"]')->item(0);

        $result = array(
            'url' => $url,
            'title' => array(
                'content' => $title ? $title->textContent : null,
                'length' => $title ? strlen($title->textContent) : 0,
                'issues' => array()
            ),
            'meta_description' => array(
                'content' => $meta_description ? $meta_description->getAttribute('content') : null,
                'length' => $meta_description ? strlen($meta_description->getAttribute('content')) : 0,
                'issues' => array()
            ),
            'meta_keywords' => $meta_keywords ? $meta_keywords->getAttribute('content') : null,
            'meta_robots' => $meta_robots ? $meta_robots->getAttribute('content') : null,
            'meta_viewport' => $meta_viewport ? $meta_viewport->getAttribute('content') : null,
            'post_id' => $post ? $post->ID : null,
            'post_title' => $post ? $post->post_title : null,
            'post_type' => $post ? $post->post_type : null
        );

        // Check for issues
        if (!$result['title']['content']) {
            $result['title']['issues'][] = 'Missing title tag';
        } elseif ($result['title']['length'] < 30) {
            $result['title']['issues'][] = 'Title too short (recommended: 30-60 characters)';
        } elseif ($result['title']['length'] > 60) {
            $result['title']['issues'][] = 'Title too long (recommended: 30-60 characters)';
        }

        if (!$result['meta_description']['content']) {
            $result['meta_description']['issues'][] = 'Missing meta description';
        } elseif ($result['meta_description']['length'] < 120) {
            $result['meta_description']['issues'][] = 'Meta description too short (recommended: 120-160 characters)';
        } elseif ($result['meta_description']['length'] > 160) {
            $result['meta_description']['issues'][] = 'Meta description too long (recommended: 120-160 characters)';
        }

        if (!$result['meta_viewport']) {
            $result['meta_viewport'] = 'Missing viewport meta tag';
        }

        return $result;
    }

    /**
     * Generate summary for meta tags analysis
     */
    private function generate_meta_tags_summary($results) {
        $total = count($results);
        $missing_titles = 0;
        $missing_descriptions = 0;
        $title_issues = 0;
        $description_issues = 0;

        foreach ($results as $result) {
            if (isset($result['error'])) continue;
            
            if (!$result['title']['content']) $missing_titles++;
            if (!$result['meta_description']['content']) $missing_descriptions++;
            if (!empty($result['title']['issues'])) $title_issues++;
            if (!empty($result['meta_description']['issues'])) $description_issues++;
        }

        return array(
            'total_pages' => $total,
            'missing_titles' => $missing_titles,
            'missing_descriptions' => $missing_descriptions,
            'pages_with_title_issues' => $title_issues,
            'pages_with_description_issues' => $description_issues,
            'title_completion_rate' => round((($total - $missing_titles) / $total) * 100, 2),
            'description_completion_rate' => round((($total - $missing_descriptions) / $total) * 100, 2)
        );
    }

    /**
     * Get SEO plugin status and information
     */
    public function seo_plugin_status($args) {
        $seo_extractor = new SEO_Data_Extractor();
        
        return array(
            'success' => true,
            'active_plugins' => $seo_extractor->get_active_plugins(),
            'global_settings' => $seo_extractor->get_comprehensive_analysis()['global_settings'] ?? array(),
            'has_seo_plugins' => count($seo_extractor->get_active_plugins()) > 0,
            'message' => count($seo_extractor->get_active_plugins()) > 0 
                ? 'SEO plugins detected - advanced integration available' 
                : 'No SEO plugins detected - will use HTML parsing fallback'
        );
    }

    /**
     * Analyze structured data and schema markup with plugin integration
     */
    public function seo_analyze_structured_data($args) {
        $url = isset($args['url']) ? $args['url'] : home_url();
        $analyze_all = isset($args['analyze_all_pages']) ? $args['analyze_all_pages'] : false;

        // Initialize SEO Data Extractor
        $seo_extractor = new SEO_Data_Extractor();
        $results = array();

        if ($analyze_all) {
            $posts = get_posts(array(
                'post_type' => array('post', 'page'),
                'post_status' => 'publish',
                'numberposts' => 20, // Limit for performance
                'orderby' => 'date',
                'order' => 'DESC'
            ));

            foreach ($posts as $post) {
                $page_url = get_permalink($post->ID);
                
                // Try plugin integration first
                $plugin_data = $seo_extractor->extract_structured_data($page_url, $post->ID);
                if ($plugin_data && !isset($plugin_data['error'])) {
                    $plugin_data['post_title'] = $post->post_title;
                    $plugin_data['url'] = $page_url;
                    $plugin_data['post_id'] = $post->ID;
                    $plugin_data['post_type'] = $post->post_type;
                    $results[] = $plugin_data;
                } else {
                    // Fallback to HTML parsing
                    $results[] = $this->analyze_single_page_structured_data($page_url, $post);
                }
            }
        } else {
            $post_id = url_to_postid($url);
            $post = $post_id ? get_post($post_id) : null;
            
            // Try plugin integration first
            $plugin_data = $seo_extractor->extract_structured_data($url, $post_id);
            if ($plugin_data && !isset($plugin_data['error'])) {
                if ($post) {
                    $plugin_data['post_title'] = $post->post_title;
                    $plugin_data['post_id'] = $post->ID;
                    $plugin_data['post_type'] = $post->post_type;
                }
                $plugin_data['url'] = $url;
                $results[] = $plugin_data;
            } else {
                // Fallback to HTML parsing
                $results[] = $this->analyze_single_page_structured_data($url, $post);
            }
        }

        return array(
            'success' => true,
            'analyzed_pages' => count($results),
            'active_seo_plugins' => $seo_extractor->get_active_plugins(),
            'data_source' => count($seo_extractor->get_active_plugins()) > 0 ? 'plugin_integration_with_fallback' : 'html_parsing',
            'pages' => $results,
            'summary' => $this->generate_structured_data_summary($results)
        );
    }

    /**
     * Analyze structured data for a single page
     */
    private function analyze_single_page_structured_data($url, $post = null) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return array(
                'url' => $url,
                'error' => $response->get_error_message()
            );
        }

        $body = wp_remote_retrieve_body($response);
        $doc = new \DOMDocument();
        @$doc->loadHTML($body);
        $xpath = new \DOMXPath($doc);

        $structured_data = array();

        // Look for JSON-LD scripts
        $json_ld_scripts = $xpath->query('//script[@type="application/ld+json"]');
        foreach ($json_ld_scripts as $script) {
            $json_content = $script->textContent;
            $data = json_decode($json_content, true);
            if ($data) {
                $structured_data[] = array(
                    'type' => 'JSON-LD',
                    'schema_type' => isset($data['@type']) ? $data['@type'] : 'Unknown',
                    'data' => $data
                );
            }
        }

        // Look for microdata
        $microdata_items = $xpath->query('//*[@itemscope]');
        foreach ($microdata_items as $item) {
            $itemtype = $item->getAttribute('itemtype');
            $structured_data[] = array(
                'type' => 'Microdata',
                'schema_type' => basename($itemtype),
                'itemtype' => $itemtype
            );
        }

        // Look for RDFa
        $rdfa_items = $xpath->query('//*[@typeof]');
        foreach ($rdfa_items as $item) {
            $typeof = $item->getAttribute('typeof');
            $structured_data[] = array(
                'type' => 'RDFa',
                'schema_type' => $typeof
            );
        }

        return array(
            'url' => $url,
            'post_id' => $post ? $post->ID : null,
            'post_title' => $post ? $post->post_title : null,
            'post_type' => $post ? $post->post_type : null,
            'structured_data_count' => count($structured_data),
            'structured_data' => $structured_data,
            'has_organization' => $this->has_schema_type($structured_data, 'Organization'),
            'has_website' => $this->has_schema_type($structured_data, 'WebSite'),
            'has_breadcrumbs' => $this->has_schema_type($structured_data, 'BreadcrumbList'),
            'has_article' => $this->has_schema_type($structured_data, 'Article')
        );
    }

    /**
     * Check if structured data contains a specific schema type
     */
    private function has_schema_type($structured_data, $type) {
        foreach ($structured_data as $data) {
            if (strpos($data['schema_type'], $type) !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate summary for structured data analysis
     */
    private function generate_structured_data_summary($results) {
        $total = count($results);
        $pages_with_schema = 0;
        $schema_types = array();

        foreach ($results as $result) {
            if (isset($result['error'])) continue;
            
            if ($result['structured_data_count'] > 0) {
                $pages_with_schema++;
            }

            foreach ($result['structured_data'] as $data) {
                $type = $data['schema_type'];
                if (!isset($schema_types[$type])) {
                    $schema_types[$type] = 0;
                }
                $schema_types[$type]++;
            }
        }

        return array(
            'total_pages' => $total,
            'pages_with_schema' => $pages_with_schema,
            'schema_adoption_rate' => round(($pages_with_schema / $total) * 100, 2),
            'most_common_schemas' => array_slice($schema_types, 0, 10, true)
        );
    }

    /**
     * Analyze OpenGraph tags with plugin integration
     */
    public function seo_analyze_opengraph($args) {
        $url = isset($args['url']) ? $args['url'] : home_url();
        $analyze_all = isset($args['analyze_all_pages']) ? $args['analyze_all_pages'] : false;

        // Initialize SEO Data Extractor
        $seo_extractor = new SEO_Data_Extractor();
        $results = array();

        if ($analyze_all) {
            $posts = get_posts(array(
                'post_type' => array('post', 'page'),
                'post_status' => 'publish',
                'numberposts' => 30,
                'orderby' => 'date',
                'order' => 'DESC'
            ));

            foreach ($posts as $post) {
                $page_url = get_permalink($post->ID);
                
                // Try plugin integration first, fallback to HTML parsing
                $plugin_data = $seo_extractor->extract_opengraph_data($page_url, $post->ID);
                if ($plugin_data && !isset($plugin_data['error'])) {
                    $plugin_data['post_title'] = $post->post_title;
                    $plugin_data['url'] = $page_url;
                    $plugin_data['post_id'] = $post->ID;
                    $plugin_data['post_type'] = $post->post_type;
                    $results[] = $plugin_data;
                } else {
                    // Fallback to HTML parsing
                    $result = $this->analyze_single_page_opengraph($page_url, $post);
                    $result['data_source'] = 'html_fallback';
                    $results[] = $result;
                }
            }
        } else {
            $post_id = url_to_postid($url);
            $post = $post_id ? get_post($post_id) : null;
            
            // Try plugin integration first
            $plugin_data = $seo_extractor->extract_opengraph_data($url, $post_id);
            if ($plugin_data && !isset($plugin_data['error'])) {
                if ($post) {
                    $plugin_data['post_title'] = $post->post_title;
                    $plugin_data['post_id'] = $post->ID;
                    $plugin_data['post_type'] = $post->post_type;
                }
                $plugin_data['url'] = $url;
                $results[] = $plugin_data;
            } else {
                // Fallback to HTML parsing
                $result = $this->analyze_single_page_opengraph($url, $post);
                $result['data_source'] = 'html_fallback';
                $results[] = $result;
            }
        }

        return array(
            'success' => true,
            'analyzed_pages' => count($results),
            'active_seo_plugins' => $seo_extractor->get_active_plugins(),
            'data_source' => count($seo_extractor->get_active_plugins()) > 0 ? 'html_parsing_with_plugin_context' : 'html_parsing',
            'pages' => $results,
            'summary' => $this->generate_opengraph_summary($results)
        );
    }

    /**
     * Analyze OpenGraph tags for a single page
     */
    private function analyze_single_page_opengraph($url, $post = null) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return array(
                'url' => $url,
                'error' => $response->get_error_message()
            );
        }

        $body = wp_remote_retrieve_body($response);
        $doc = new \DOMDocument();
        @$doc->loadHTML($body);
        $xpath = new \DOMXPath($doc);

        $og_tags = array();
        $twitter_tags = array();

        // Get OpenGraph tags
        $og_metas = $xpath->query('//meta[starts-with(@property, "og:")]');
        foreach ($og_metas as $meta) {
            $property = $meta->getAttribute('property');
            $content = $meta->getAttribute('content');
            $og_tags[$property] = $content;
        }

        // Get Twitter Card tags
        $twitter_metas = $xpath->query('//meta[starts-with(@name, "twitter:")]');
        foreach ($twitter_metas as $meta) {
            $name = $meta->getAttribute('name');
            $content = $meta->getAttribute('content');
            $twitter_tags[$name] = $content;
        }

        $issues = array();

        // Check for required OpenGraph tags
        if (!isset($og_tags['og:title'])) {
            $issues[] = 'Missing og:title';
        }
        if (!isset($og_tags['og:description'])) {
            $issues[] = 'Missing og:description';
        }
        if (!isset($og_tags['og:image'])) {
            $issues[] = 'Missing og:image';
        }
        if (!isset($og_tags['og:url'])) {
            $issues[] = 'Missing og:url';
        }
        if (!isset($og_tags['og:type'])) {
            $issues[] = 'Missing og:type';
        }

        return array(
            'url' => $url,
            'post_id' => $post ? $post->ID : null,
            'post_title' => $post ? $post->post_title : null,
            'post_type' => $post ? $post->post_type : null,
            'opengraph_tags' => $og_tags,
            'twitter_tags' => $twitter_tags,
            'issues' => $issues,
            'opengraph_complete' => count($issues) === 0
        );
    }

    /**
     * Generate summary for OpenGraph analysis
     */
    private function generate_opengraph_summary($results) {
        $total = count($results);
        $complete_og = 0;
        $has_twitter = 0;
        $common_issues = array();

        foreach ($results as $result) {
            if (isset($result['error'])) continue;
            
            if ($result['opengraph_complete']) {
                $complete_og++;
            }
            if (!empty($result['twitter_tags'])) {
                $has_twitter++;
            }

            foreach ($result['issues'] as $issue) {
                if (!isset($common_issues[$issue])) {
                    $common_issues[$issue] = 0;
                }
                $common_issues[$issue]++;
            }
        }

        arsort($common_issues);

        return array(
            'total_pages' => $total,
            'complete_opengraph' => $complete_og,
            'has_twitter_cards' => $has_twitter,
            'opengraph_completion_rate' => round(($complete_og / $total) * 100, 2),
            'twitter_adoption_rate' => round(($has_twitter / $total) * 100, 2),
            'most_common_issues' => array_slice($common_issues, 0, 5, true)
        );
    }

    /**
     * Analyze sitemaps
     */
    public function seo_analyze_sitemap($args) {
        $sitemap_url = isset($args['sitemap_url']) ? $args['sitemap_url'] : null;
        
        // Auto-detect sitemap URLs if not provided
        if (!$sitemap_url) {
            $possible_sitemaps = array(
                home_url('/sitemap.xml'),
                home_url('/sitemap_index.xml'),
                home_url('/wp-sitemap.xml'), // WordPress core sitemap
                home_url('/sitemaps.xml')
            );

            foreach ($possible_sitemaps as $url) {
                $response = wp_remote_head($url);
                if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                    $sitemap_url = $url;
                    break;
                }
            }
        }

        if (!$sitemap_url) {
            return array(
                'success' => false,
                'error' => 'No sitemap found. Common locations checked: /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml'
            );
        }

        return $this->analyze_sitemap_content($sitemap_url);
    }

    /**
     * Analyze sitemap content
     */
    private function analyze_sitemap_content($sitemap_url) {
        $response = wp_remote_get($sitemap_url, array('timeout' => 15));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => $response->get_error_message()
            );
        }

        $body = wp_remote_retrieve_body($response);
        $doc = new \DOMDocument();
        @$doc->loadXML($body);

        if (!$doc->documentElement) {
            return array(
                'success' => false,
                'error' => 'Invalid XML sitemap'
            );
        }

        $xpath = new \DOMXPath($doc);
        $xpath->registerNamespace('sm', 'http://www.sitemaps.org/schemas/sitemap/0.9');

        $urls = array();
        $sitemaps = array();

        // Check if this is a sitemap index or regular sitemap
        $sitemap_elements = $xpath->query('//sm:sitemap');
        if ($sitemap_elements->length > 0) {
            // This is a sitemap index
            foreach ($sitemap_elements as $sitemap) {
                $loc = $xpath->query('.//sm:loc', $sitemap)->item(0);
                $lastmod = $xpath->query('.//sm:lastmod', $sitemap)->item(0);
                
                if ($loc) {
                    $sitemaps[] = array(
                        'url' => $loc->textContent,
                        'lastmod' => $lastmod ? $lastmod->textContent : null
                    );
                }
            }
        } else {
            // This is a regular sitemap
            $url_elements = $xpath->query('//sm:url');
            foreach ($url_elements as $url_element) {
                $loc = $xpath->query('.//sm:loc', $url_element)->item(0);
                $lastmod = $xpath->query('.//sm:lastmod', $url_element)->item(0);
                $changefreq = $xpath->query('.//sm:changefreq', $url_element)->item(0);
                $priority = $xpath->query('.//sm:priority', $url_element)->item(0);
                
                if ($loc) {
                    $urls[] = array(
                        'url' => $loc->textContent,
                        'lastmod' => $lastmod ? $lastmod->textContent : null,
                        'changefreq' => $changefreq ? $changefreq->textContent : null,
                        'priority' => $priority ? $priority->textContent : null
                    );
                }
            }
        }

        return array(
            'success' => true,
            'sitemap_url' => $sitemap_url,
            'is_index' => !empty($sitemaps),
            'url_count' => count($urls),
            'sitemap_count' => count($sitemaps),
            'urls' => array_slice($urls, 0, 50), // Limit for performance
            'sitemaps' => $sitemaps,
            'analysis' => array(
                'total_urls' => count($urls),
                'urls_with_lastmod' => count(array_filter($urls, function($url) { return !empty($url['lastmod']); })),
                'urls_with_priority' => count(array_filter($urls, function($url) { return !empty($url['priority']); })),
                'changefreq_usage' => $this->analyze_changefreq_usage($urls)
            )
        );
    }

    /**
     * Analyze changefreq usage in sitemap
     */
    private function analyze_changefreq_usage($urls) {
        $changefreq_counts = array();
        foreach ($urls as $url) {
            if (!empty($url['changefreq'])) {
                $freq = $url['changefreq'];
                if (!isset($changefreq_counts[$freq])) {
                    $changefreq_counts[$freq] = 0;
                }
                $changefreq_counts[$freq]++;
            }
        }
        return $changefreq_counts;
    }

    /**
     * Analyze canonical URLs
     */
    public function seo_analyze_canonical_urls($args) {
        $max_pages = isset($args['max_pages']) ? intval($args['max_pages']) : 100;

        $posts = get_posts(array(
            'post_type' => array('post', 'page'),
            'post_status' => 'publish',
            'numberposts' => $max_pages,
            'orderby' => 'date',
            'order' => 'DESC'
        ));

        $results = array();
        $issues = array();

        foreach ($posts as $post) {
            $url = get_permalink($post->ID);
            $canonical = $this->get_canonical_url($url);
            
            $result = array(
                'url' => $url,
                'canonical' => $canonical,
                'post_id' => $post->ID,
                'post_title' => $post->post_title,
                'post_type' => $post->post_type,
                'issues' => array()
            );

            // Check for issues
            if (!$canonical) {
                $result['issues'][] = 'Missing canonical URL';
                $issues['missing_canonical'] = ($issues['missing_canonical'] ?? 0) + 1;
            } elseif ($canonical !== $url) {
                $result['issues'][] = 'Canonical URL differs from actual URL';
                $issues['canonical_mismatch'] = ($issues['canonical_mismatch'] ?? 0) + 1;
            }

            $results[] = $result;
        }

        return array(
            'success' => true,
            'analyzed_pages' => count($results),
            'pages' => $results,
            'summary' => array(
                'total_pages' => count($results),
                'pages_with_canonical' => count($results) - ($issues['missing_canonical'] ?? 0),
                'canonical_issues' => $issues,
                'canonical_coverage' => round(((count($results) - ($issues['missing_canonical'] ?? 0)) / count($results)) * 100, 2)
            )
        );
    }

    /**
     * Get canonical URL from a page
     */
    private function get_canonical_url($url) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return null;
        }

        $body = wp_remote_retrieve_body($response);
        $doc = new \DOMDocument();
        @$doc->loadHTML($body);
        $xpath = new \DOMXPath($doc);

        $canonical_link = $xpath->query('//link[@rel="canonical"]')->item(0);
        return $canonical_link ? $canonical_link->getAttribute('href') : null;
    }

    /**
     * Placeholder methods for other SEO analysis functions
     * These would need full implementations based on your specific requirements
     */
    public function seo_analyze_internal_links($args) {
        // Implementation for internal linking analysis
        return array('success' => true, 'message' => 'Internal linking analysis - implementation needed');
    }

    public function seo_analyze_indexation($args) {
        // Implementation for indexation analysis
        return array('success' => true, 'message' => 'Indexation analysis - implementation needed');
    }

    public function seo_analyze_page_content($args) {
        // Implementation for page content analysis (headings, alt text, accessibility)
        return array('success' => true, 'message' => 'Page content analysis - implementation needed');
    }

    public function seo_comprehensive_audit($args) {
        $max_pages = isset($args['max_pages']) ? intval($args['max_pages']) : 25;
        
        // Initialize SEO Data Extractor
        $seo_extractor = new SEO_Data_Extractor();
        
        // Run all analyses
        $meta_results = $this->seo_analyze_meta_tags(array('analyze_all_pages' => true, 'max_pages' => $max_pages));
        $structured_results = $this->seo_analyze_structured_data(array('analyze_all_pages' => true));
        $opengraph_results = $this->seo_analyze_opengraph(array('analyze_all_pages' => true));
        $sitemap_results = $this->seo_analyze_sitemap(array());
        $canonical_results = $this->seo_analyze_canonical_urls(array('max_pages' => $max_pages));
        
        // Compile comprehensive data
        $comprehensive_data = array(
            'meta_analysis' => array(
                'total_pages' => $meta_results['analyzed_pages'],
                'pages_analyzed' => $meta_results['analyzed_pages'],
                'meta_summary' => $meta_results['summary'],
                'pages' => array_slice($meta_results['pages'], 0, 5) // Sample pages for frontend
            ),
            'structured_data' => array(
                'total_pages' => $structured_results['analyzed_pages'],
                'pages_with_schema' => count(array_filter($structured_results['pages'], function($p) { 
                    return isset($p['structured_data_count']) && $p['structured_data_count'] > 0; 
                })),
                'schema_adoption_rate' => $structured_results['analyzed_pages'] > 0 ? 
                    round((count(array_filter($structured_results['pages'], function($p) { 
                        return isset($p['structured_data_count']) && $p['structured_data_count'] > 0; 
                    })) / $structured_results['analyzed_pages']) * 100) : 0,
                'most_common_schemas' => $structured_results['summary']['schema_types'] ?? array(),
                'pages' => array_slice($structured_results['pages'], 0, 5)
            ),
            'opengraph' => array(
                'total_pages' => $opengraph_results['analyzed_pages'],
                'complete_opengraph' => $opengraph_results['summary']['complete_opengraph'] ?? 0,
                'has_twitter_cards' => $opengraph_results['summary']['has_twitter_cards'] ?? 0,
                'opengraph_completion_rate' => $opengraph_results['summary']['opengraph_completion_rate'] ?? 0,
                'twitter_adoption_rate' => $opengraph_results['summary']['twitter_adoption_rate'] ?? 0,
                'most_common_issues' => $opengraph_results['summary']['most_common_issues'] ?? array(),
                'pages' => array_slice($opengraph_results['pages'], 0, 5)
            ),
            'sitemap' => $sitemap_results,
            'canonical_urls' => $canonical_results['summary'] ?? array(),
            'summary' => array(
                'overall_score' => $this->calculate_overall_seo_score($meta_results, $structured_results, $opengraph_results, $sitemap_results, $canonical_results),
                'meta_score' => $this->calculate_meta_score($meta_results['summary']),
                'structured_data_score' => $this->calculate_structured_data_score($structured_results),
                'opengraph_score' => $this->calculate_opengraph_score($opengraph_results),
                'sitemap_score' => $sitemap_results['success'] ? 95 : 0,
                'canonical_score' => isset($canonical_results['summary']['canonical_coverage']) ? $canonical_results['summary']['canonical_coverage'] : 0,
                'recommendations' => $this->generate_comprehensive_recommendations($meta_results, $structured_results, $opengraph_results, $sitemap_results, $canonical_results)
            )
        );
        
        // Save comprehensive data to database
        $this->save_comprehensive_analysis_to_db($comprehensive_data);
        
        return array(
            'success' => true,
            'analyzed_pages' => $max_pages,
            'active_seo_plugins' => $seo_extractor->get_active_plugins(),
            'comprehensive_analysis' => $comprehensive_data
        );
    }
    
    /**
     * Save meta analysis data to database
     */
    private function save_meta_analysis_to_db($results, $summary, $seo_extractor) {
        if (!$this->ai_provider || !$this->ai_provider->get_db()) {
            return false;
        }
        
        $user_id = get_current_user_id();
        $meta_data = array(
            'meta_analysis' => array(
                'total_pages' => count($results),
                'pages_analyzed' => count($results),
                'meta_summary' => $summary,
                'pages' => array_slice($results, 0, 10), // Limit for storage
                'active_seo_plugins' => $seo_extractor->get_active_plugins(),
                'last_updated' => current_time('mysql')
            )
        );
        
        $this->ai_provider->get_db()->save_user_setting('site_analysis_data', $meta_data, $user_id);
        return true;
    }
    
    /**
     * Save comprehensive site analysis to database
     */
    private function save_comprehensive_analysis_to_db($comprehensive_data) {
        if (!$this->ai_provider || !$this->ai_provider->get_db()) {
            return false;
        }
        
        $user_id = get_current_user_id();
        $comprehensive_data['last_updated'] = current_time('mysql');
        
        $this->ai_provider->get_db()->save_user_setting('site_analysis_data', $comprehensive_data, $user_id);
        return true;
    }
    
    /**
     * Calculate overall SEO score based on all analyses
     */
    private function calculate_overall_seo_score($meta_results, $structured_results, $opengraph_results, $sitemap_results, $canonical_results) {
        $meta_score = $this->calculate_meta_score($meta_results['summary']);
        $structured_score = $this->calculate_structured_data_score($structured_results);
        $opengraph_score = $this->calculate_opengraph_score($opengraph_results);
        $sitemap_score = $sitemap_results['success'] ? 95 : 0;
        $canonical_score = isset($canonical_results['summary']['canonical_coverage']) ? $canonical_results['summary']['canonical_coverage'] : 0;
        
        // Weighted average
        return round(($meta_score * 0.3 + $structured_score * 0.2 + $opengraph_score * 0.2 + $sitemap_score * 0.15 + $canonical_score * 0.15), 0);
    }
    
    /**
     * Calculate meta tags score
     */
    private function calculate_meta_score($summary) {
        $title_score = $summary['title_completion_rate'] ?? 0;
        $desc_score = $summary['description_completion_rate'] ?? 0;
        return round(($title_score + $desc_score) / 2, 0);
    }
    
    /**
     * Calculate structured data score
     */
    private function calculate_structured_data_score($results) {
        if (!isset($results['analyzed_pages']) || $results['analyzed_pages'] == 0) {
            return 0;
        }
        
        $pages_with_schema = count(array_filter($results['pages'], function($p) {
            return isset($p['structured_data_count']) && $p['structured_data_count'] > 0;
        }));
        
        return round(($pages_with_schema / $results['analyzed_pages']) * 100, 0);
    }
    
    /**
     * Calculate OpenGraph score
     */
    private function calculate_opengraph_score($results) {
        return round($results['summary']['opengraph_completion_rate'] ?? 0, 0);
    }
    
    /**
     * Generate comprehensive recommendations with affected pages
     */
    private function generate_comprehensive_recommendations($meta_results, $structured_results, $opengraph_results, $sitemap_results, $canonical_results) {
        $recommendations = array();
        
        // Meta tag recommendations - missing descriptions
        $pages_missing_descriptions = array_filter($meta_results['pages'], function($page) {
            return isset($page['error']) ? false : empty($page['meta_description']['content']);
        });
        if (count($pages_missing_descriptions) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post'
                );
            }, array_slice($pages_missing_descriptions, 0, 10)); // Limit to 10 for display
            
            $recommendations[] = array(
                'type' => 'meta_description',
                'title' => 'Add missing meta descriptions',
                'description' => 'Add missing meta descriptions to ' . count($pages_missing_descriptions) . ' pages',
                'severity' => 'high',
                'affected_count' => count($pages_missing_descriptions),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // Meta tag recommendations - missing titles
        $pages_missing_titles = array_filter($meta_results['pages'], function($page) {
            return isset($page['error']) ? false : empty($page['title']['content']);
        });
        if (count($pages_missing_titles) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post'
                );
            }, array_slice($pages_missing_titles, 0, 10));
            
            $recommendations[] = array(
                'type' => 'meta_title',
                'title' => 'Add missing title tags',
                'description' => 'Add missing title tags to ' . count($pages_missing_titles) . ' pages',
                'severity' => 'high',
                'affected_count' => count($pages_missing_titles),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // Structured data recommendations
        $pages_without_schema = array_filter($structured_results['pages'], function($p) {
            return isset($p['error']) ? false : (!isset($p['structured_data_count']) || $p['structured_data_count'] == 0);
        });
        if (count($pages_without_schema) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post'
                );
            }, array_slice($pages_without_schema, 0, 10));
            
            $recommendations[] = array(
                'type' => 'structured_data',
                'title' => 'Implement schema markup',
                'description' => 'Implement schema markup on ' . count($pages_without_schema) . ' additional pages',
                'severity' => 'medium',
                'affected_count' => count($pages_without_schema),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // OpenGraph recommendations - missing images
        $pages_missing_og_image = array_filter($opengraph_results['pages'], function($page) {
            return isset($page['error']) ? false : in_array('Missing og:image', $page['issues'] ?? array());
        });
        if (count($pages_missing_og_image) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post'
                );
            }, array_slice($pages_missing_og_image, 0, 10));
            
            $recommendations[] = array(
                'type' => 'opengraph_image',
                'title' => 'Add OpenGraph images',
                'description' => 'Add OpenGraph images to ' . count($pages_missing_og_image) . ' pages missing og:image',
                'severity' => 'medium',
                'affected_count' => count($pages_missing_og_image),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // Canonical URL recommendations
        $pages_missing_canonical = array_filter($canonical_results['pages'] ?? array(), function($page) {
            return isset($page['error']) ? false : in_array('Missing canonical URL', $page['issues'] ?? array());
        });
        if (count($pages_missing_canonical) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post'
                );
            }, array_slice($pages_missing_canonical, 0, 10));
            
            $recommendations[] = array(
                'type' => 'canonical_url',
                'title' => 'Fix missing canonical URLs',
                'description' => 'Fix ' . count($pages_missing_canonical) . ' pages with missing canonical URLs',
                'severity' => 'medium',
                'affected_count' => count($pages_missing_canonical),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // Title length issues
        $pages_title_issues = array_filter($meta_results['pages'], function($page) {
            return isset($page['error']) ? false : !empty($page['title']['issues']);
        });
        if (count($pages_title_issues) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post',
                    'issues' => $page['title']['issues'] ?? array()
                );
            }, array_slice($pages_title_issues, 0, 10));
            
            $recommendations[] = array(
                'type' => 'title_length',
                'title' => 'Fix title length issues',
                'description' => 'Fix title length issues on ' . count($pages_title_issues) . ' pages',
                'severity' => 'low',
                'affected_count' => count($pages_title_issues),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // Description length issues
        $pages_description_issues = array_filter($meta_results['pages'], function($page) {
            return isset($page['error']) ? false : !empty($page['meta_description']['issues']);
        });
        if (count($pages_description_issues) > 0) {
            $affected_pages = array_map(function($page) {
                return array(
                    'title' => $page['post_title'] ?? 'Unknown',
                    'url' => $page['url'] ?? '',
                    'post_id' => $page['post_id'] ?? null,
                    'post_type' => $page['post_type'] ?? 'post',
                    'issues' => $page['meta_description']['issues'] ?? array()
                );
            }, array_slice($pages_description_issues, 0, 10));
            
            $recommendations[] = array(
                'type' => 'description_length',
                'title' => 'Fix description length issues',
                'description' => 'Fix meta description length issues on ' . count($pages_description_issues) . ' pages',
                'severity' => 'low',
                'affected_count' => count($pages_description_issues),
                'affected_pages' => $affected_pages,
                'showing_count' => count($affected_pages)
            );
        }
        
        // Sort by severity (high, medium, low) and limit to 5
        usort($recommendations, function($a, $b) {
            $severity_order = array('high' => 0, 'medium' => 1, 'low' => 2);
            return $severity_order[$a['severity']] - $severity_order[$b['severity']];
        });
        
        return array_slice($recommendations, 0, 5);
    }

    /**
     * Get SEO settings for targeted analysis
     */
    public function get_seo_settings($args) {
        if (!$this->db) {
            return array(
                'success' => false,
                'error' => 'Database connection not available'
            );
        }
        
        // Get current site URL for context
        $site_url = get_site_url();
        $site_name = get_bloginfo('name');
        
        // Retrieve SEO settings from plugin's settings table
        $settings = array(
            'seo_target_location' => $this->db->get_setting('seo_target_location', ''),
            'seo_target_language' => $this->db->get_setting('seo_target_language', 'en'),
            'seo_target_keywords' => $this->db->get_setting('seo_target_keywords', ''),
            'manual_competitors' => $this->db->get_setting('manual_competitors', '')
        );
        
        // Process keywords into an array
        $target_keywords = array();
        if (!empty($settings['seo_target_keywords'])) {
            $target_keywords = array_filter(
                array_map('trim', explode("\n", $settings['seo_target_keywords'])),
                function($keyword) {
                    return !empty($keyword);
                }
            );
        }
        
        // Process competitors into an array
        $competitors = array();
        if (!empty($settings['manual_competitors'])) {
            $competitors = array_filter(
                array_map('trim', explode("\n", $settings['manual_competitors'])),
                function($competitor) {
                    return !empty($competitor);
                }
            );
        }
        
        // Get location name if set
        $location_name = '';
        if (!empty($settings['seo_target_location'])) {
            // Try to get a readable location name (this is basic - could be enhanced with a country lookup)
            $location_name = $settings['seo_target_location'];
        }
        
        // Get language name
        $language_name = '';
        if (!empty($settings['seo_target_language'])) {
            $language_map = array(
                'en' => 'English',
                'es' => 'Spanish', 
                'fr' => 'French',
                'de' => 'German',
                'it' => 'Italian',
                'pt' => 'Portuguese',
                'ja' => 'Japanese',
                'ko' => 'Korean',
                'zh' => 'Chinese',
                'ru' => 'Russian',
                'ar' => 'Arabic',
                'hi' => 'Hindi'
            );
            $language_name = isset($language_map[$settings['seo_target_language']]) 
                ? $language_map[$settings['seo_target_language']] 
                : $settings['seo_target_language'];
        }
        
        return array(
            'success' => true,
            'site_info' => array(
                'domain' => parse_url($site_url, PHP_URL_HOST),
                'site_url' => $site_url,
                'site_name' => $site_name
            ),
            'seo_settings' => array(
                'target_location' => array(
                    'code' => $settings['seo_target_location'],
                    'name' => $location_name ?: 'Global'
                ),
                'target_language' => array(
                    'code' => $settings['seo_target_language'],
                    'name' => $language_name
                ),
                'target_keywords' => $target_keywords,
                'target_keywords_count' => count($target_keywords),
                'manual_competitors' => $competitors,
                'competitors_count' => count($competitors)
            ),
            'analysis_context' => array(
                'has_target_keywords' => !empty($target_keywords),
                'has_target_location' => !empty($settings['seo_target_location']),
                'has_competitors' => !empty($competitors),
                'ready_for_analysis' => !empty($target_keywords) || !empty($competitors)
            ),
            'recommendations' => $this->get_seo_settings_recommendations($target_keywords, $competitors, $settings)
        );
    }
    
    /**
     * Get recommendations based on SEO settings completeness
     */
    private function get_seo_settings_recommendations($target_keywords, $competitors, $settings) {
        $recommendations = array();
        
        if (empty($target_keywords)) {
            $recommendations[] = array(
                'type' => 'missing_keywords',
                'message' => 'No target keywords configured. Add your primary keywords in Settings > SEO Configuration to get more targeted analysis.',
                'action' => 'Configure target keywords in SEO settings'
            );
        }
        
        if (empty($competitors)) {
            $recommendations[] = array(
                'type' => 'missing_competitors',
                'message' => 'No manual competitors configured. Add competitor domains to enable competitive analysis when automatic discovery fails.',
                'action' => 'Add competitor domains in SEO settings'
            );
        }
        
        if (empty($settings['seo_target_location'])) {
            $recommendations[] = array(
                'type' => 'missing_location',
                'message' => 'No target location set. Configure your target geographic location for more accurate local SEO analysis.',
                'action' => 'Set target location in SEO settings'
            );
        }
        
        if (count($target_keywords) < 3) {
            $recommendations[] = array(
                'type' => 'few_keywords',
                'message' => 'Consider adding more target keywords (recommended: 5-10) for comprehensive keyword analysis.',
                'action' => 'Add more target keywords in SEO settings'
            );
        }
        
        return $recommendations;
    }

    /**
     * Get available tools - callback for the dynamic tool discovery
     * This method returns the complete list of tools to reduce system message token usage
     */
    public function get_available_tools($args) {
        $category = isset($args['category']) ? $args['category'] : 'all';
        
        $all_tools = array();
        
        foreach ($this->registered_tools as $name => $tool) {
            // Skip the get_available_tools tool itself to avoid infinite recursion
            if ($name === 'get_available_tools') {
                continue;
            }
            
            $tool_info = array(
                'name' => $name,
                'description' => $tool['description'],
                'inputSchema' => isset($tool['inputSchema']) ? $tool['inputSchema'] : array(
                    'type' => 'object',
                    'properties' => array(),
                    'additionalProperties' => false
                )
            );
            
            // Add category classification for filtering
            $tool_category = $this->categorize_tool($name);
            $tool_info['category'] = $tool_category;
            
            // Filter by category if requested
            if ($category === 'all' || $category === $tool_category) {
                $all_tools[] = $tool_info;
            }
        }
        
        // Sort tools by name for consistent ordering
        usort($all_tools, function($a, $b) {
            return strcmp($a['name'], $b['name']);
        });
        
        return array(
            'success' => true,
            'category_filter' => $category,
            'total_tools' => count($all_tools),
            'tools' => $all_tools,
            'categories_available' => array('all', 'media', 'posts', 'pages', 'meta_fields', 'users', 'woocommerce', 'seo', 'repository', 'rest_api', 'site_info', 'dataforseo', 'pagespeed', 'database', 'security'),
            'message' => 'Complete list of available tools loaded. You can now use any of these tools to help the user with their WordPress site.'
        );
    }
    
    /**
     * Categorize a tool based on its name for filtering
     */
    private function categorize_tool($tool_name) {
        if (strpos($tool_name, 'wp_list_media') === 0 || strpos($tool_name, 'wp_get_media') === 0 || 
            strpos($tool_name, 'wp_upload_media') === 0 || strpos($tool_name, 'wp_update_media') === 0 || 
            strpos($tool_name, 'wp_delete_media') === 0 || strpos($tool_name, 'wp_search_media') === 0) {
            return 'media';
        }
        
        if (strpos($tool_name, 'wp_posts_') === 0 || strpos($tool_name, 'wp_list_categories') === 0 || 
            strpos($tool_name, 'wp_add_category') === 0 || strpos($tool_name, 'wp_update_category') === 0 || 
            strpos($tool_name, 'wp_delete_category') === 0 || strpos($tool_name, 'wp_list_tags') === 0 || 
            strpos($tool_name, 'wp_add_tag') === 0 || strpos($tool_name, 'wp_update_tag') === 0 || 
            strpos($tool_name, 'wp_delete_tag') === 0) {
            return 'posts';
        }
        
        if (strpos($tool_name, 'wp_pages_') === 0 || strpos($tool_name, 'wp_get_page') === 0 || 
            strpos($tool_name, 'wp_add_page') === 0 || strpos($tool_name, 'wp_update_page') === 0 || 
            strpos($tool_name, 'wp_delete_page') === 0) {
            return 'pages';
        }
        
        if (strpos($tool_name, 'wp_get_meta_field') === 0 || strpos($tool_name, 'wp_update_meta_field') === 0 || 
            strpos($tool_name, 'wp_delete_meta_field') === 0 || strpos($tool_name, 'wp_list_meta_fields') === 0 || 
            strpos($tool_name, 'wp_bulk_update_meta') === 0 || strpos($tool_name, 'wp_search_by_meta') === 0 || 
            strpos($tool_name, 'wp_get_meta_keys') === 0) {
            return 'meta_fields';
        }
        
        if (strpos($tool_name, 'wp_users_') === 0 || strpos($tool_name, 'wp_get_user') === 0 || 
            strpos($tool_name, 'wp_add_user') === 0 || strpos($tool_name, 'wp_update_user') === 0 || 
            strpos($tool_name, 'wp_delete_user') === 0 || strpos($tool_name, 'wp_get_current_user') === 0 || 
            strpos($tool_name, 'wp_update_current_user') === 0) {
            return 'users';
        }
        
        if (strpos($tool_name, 'wc_') === 0) {
            return 'woocommerce';
        }
        
        if (strpos($tool_name, 'seo_') === 0 || strpos($tool_name, 'get_seo_settings') === 0) {
            return 'seo';
        }
        
        if (strpos($tool_name, 'wp_search_repo_') === 0 || strpos($tool_name, 'wp_get_repo_') === 0 || 
            strpos($tool_name, 'wp_install_repo_') === 0 || strpos($tool_name, 'wp_check_') === 0 || 
            strpos($tool_name, 'wp_update_plugin') === 0 || strpos($tool_name, 'wp_update_theme') === 0 || 
            strpos($tool_name, 'wp_update_all_') === 0) {
            return 'repository';
        }
        
        if (strpos($tool_name, 'list_api_functions') === 0 || strpos($tool_name, 'get_function_details') === 0 || 
            strpos($tool_name, 'run_api_function') === 0) {
            return 'rest_api';
        }
        
        if (strpos($tool_name, 'get_site_info') === 0 || strpos($tool_name, 'wp_list_plugins') === 0 || 
            strpos($tool_name, 'wp_get_theme_info') === 0 || strpos($tool_name, 'wp_list_themes') === 0 || 
            strpos($tool_name, 'wp_get_site_settings') === 0 || strpos($tool_name, 'wp_get_general_site_info') === 0 || 
            strpos($tool_name, 'wp_get_detailed_') === 0) {
            return 'site_info';
        }
        
        if (strpos($tool_name, 'dataforseo_') === 0) {
            return 'dataforseo';
        }
        
        if (strpos($tool_name, 'pagespeed_') === 0) {
            return 'pagespeed';
        }
        
        if (strpos($tool_name, 'db_') === 0) {
            return 'database';
        }

        if (strpos($tool_name, 'security_') === 0) {
            return 'security';
        }

        if (strpos($tool_name, 'unsplash_') === 0) {
            return 'unsplash';
        }
        
        return 'other';
    }

    /**
     * Wrapper method for unsplash_search_images
     */
    private function unsplash_search_images($params) {
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/Unsplash_Service.php';
        $unsplash_service = new Unsplash_Service($this->ai_provider);
        
        return $unsplash_service->search_images($params);
    }

    /**
     * Wrapper method for unsplash_random_images
     */
    private function unsplash_random_images($params) {
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/Unsplash_Service.php';
        $unsplash_service = new Unsplash_Service($this->ai_provider);
        
        return $unsplash_service->get_random_images($params);
    }

    // Meta Field Tool implementations
    public function wp_get_meta_field($args) {
        $post_id = intval($args['post_id']);
        $meta_key = sanitize_text_field($args['meta_key']);
        $single = isset($args['single']) ? (bool) $args['single'] : true;
        
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception('Post not found: ' . $post_id);
        }
        
        $meta_value = get_post_meta($post_id, $meta_key, $single);
        
        return array(
            'post_id' => $post_id,
            'meta_key' => $meta_key,
            'meta_value' => $meta_value,
            'single' => $single,
            'post_type' => $post->post_type,
            'post_title' => $post->post_title
        );
    }
    
    public function wp_update_meta_field($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to update meta fields');
        }
        
        $post_id = intval($args['post_id']);
        $meta_key = sanitize_text_field($args['meta_key']);
        $meta_value = $args['meta_value'];
        
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception('Post not found: ' . $post_id);
        }
        
        // Sanitize meta value based on its type
        if (is_array($meta_value)) {
            $meta_value = array_map('sanitize_text_field', $meta_value);
        } elseif (is_string($meta_value)) {
            $meta_value = sanitize_text_field($meta_value);
        }
        
        $result = update_post_meta($post_id, $meta_key, $meta_value);
        
        if ($result === false) {
            throw new Exception('Failed to update meta field');
        }
        
        return array(
            'success' => true,
            'post_id' => $post_id,
            'meta_key' => $meta_key,
            'meta_value' => $meta_value,
            'post_type' => $post->post_type,
            'post_title' => $post->post_title
        );
    }
    
    public function wp_delete_meta_field($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to delete meta fields');
        }
        
        $post_id = intval($args['post_id']);
        $meta_key = sanitize_text_field($args['meta_key']);
        $meta_value = isset($args['meta_value']) ? $args['meta_value'] : '';
        
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception('Post not found: ' . $post_id);
        }
        
        $result = delete_post_meta($post_id, $meta_key, $meta_value);
        
        if ($result === false) {
            throw new Exception('Failed to delete meta field');
        }
        
        return array(
            'success' => true,
            'post_id' => $post_id,
            'meta_key' => $meta_key,
            'deleted' => true,
            'post_type' => $post->post_type,
            'post_title' => $post->post_title
        );
    }
    
    public function wp_list_meta_fields($args) {
        global $wpdb;
        
        $post_id = intval($args['post_id']);
        $include_private = isset($args['include_private']) ? (bool) $args['include_private'] : false;
        
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception('Post not found: ' . $post_id);
        }
        
        // Get ALL meta fields directly from the database to ensure we don't miss any
        $query = $wpdb->prepare(
            "SELECT meta_key, meta_value FROM {$wpdb->postmeta} WHERE post_id = %d ORDER BY meta_key",
            $post_id
        );
        
        $raw_meta = $wpdb->get_results($query);
        
        // Group meta fields by key (handle multiple values for the same key)
        $meta_fields = array();
        foreach ($raw_meta as $meta) {
            if (!isset($meta_fields[$meta->meta_key])) {
                $meta_fields[$meta->meta_key] = array();
            }
            $meta_fields[$meta->meta_key][] = maybe_unserialize($meta->meta_value);
        }
        
        // Add ACF fields using their API to get formatted values
        if (function_exists('get_fields')) {
            $acf_fields = get_fields($post_id);
            if ($acf_fields) {
                foreach ($acf_fields as $key => $value) {
                    // ACF fields might not be in postmeta if they use different storage
                    // or if they have complex formatting, so we add them here
                    if (!isset($meta_fields[$key])) {
                        $meta_fields[$key] = array($value);
                    } else {
                        // Replace with ACF formatted value if it exists
                        $meta_fields[$key] = array($value);
                    }
                }
            }
        }
        
        // Add Meta Box fields using their API
        if (function_exists('rwmb_get_value')) {
            // Get all registered meta boxes for this post type
            $meta_boxes = apply_filters('rwmb_meta_boxes', array());
            foreach ($meta_boxes as $meta_box) {
                if (isset($meta_box['post_types']) && in_array($post->post_type, $meta_box['post_types'])) {
                    if (isset($meta_box['fields'])) {
                        foreach ($meta_box['fields'] as $field) {
                            $field_id = $field['id'];
                            $value = rwmb_get_value($field_id, array(), $post_id);
                            if ($value !== '' && $value !== null) {
                                $meta_fields[$field_id] = array($value);
                            }
                        }
                    }
                }
            }
        }
        
        // Add CMB2 fields
        if (class_exists('CMB2_Boxes')) {
            $cmb2_boxes = CMB2_Boxes::get_all();
            foreach ($cmb2_boxes as $cmb_id => $cmb) {
                $object_types = $cmb->prop('object_types');
                if ($object_types && in_array($post->post_type, $object_types)) {
                    $fields = $cmb->prop('fields');
                    foreach ($fields as $field_id => $field_args) {
                        $value = get_post_meta($post_id, $field_id, true);
                        if ($value !== '' && $value !== null) {
                            if (!isset($meta_fields[$field_id])) {
                                $meta_fields[$field_id] = array($value);
                            }
                        }
                    }
                }
            }
        }
        
        // Add Pods fields if Pods is active
        if (function_exists('pods')) {
            try {
                $pod = pods($post->post_type, $post_id);
                if ($pod && $pod->exists()) {
                    $pod_fields = $pod->fields();
                    foreach ($pod_fields as $field_name => $field_data) {
                        $value = $pod->field($field_name);
                        if ($value !== '' && $value !== null && !isset($meta_fields[$field_name])) {
                            $meta_fields[$field_name] = array($value);
                        }
                    }
                }
            } catch (Exception $e) {
                // Ignore Pods errors
            }
        }
        
        // Filter out private meta fields if requested
        if (!$include_private) {
            $meta_fields = array_filter($meta_fields, function($key) {
                return strpos($key, '_') !== 0;
            }, ARRAY_FILTER_USE_KEY);
        }
        
        // Format meta fields for better readability and expand special field types
        $formatted_meta = array();
        foreach ($meta_fields as $key => $values) {
            $formatted_value = count($values) === 1 ? $values[0] : $values;
            $field_type = 'text'; // Default type
            $expanded_data = null;
            
            // Check if this is an image/attachment field
            if (count($values) === 1 && is_numeric($values[0]) && $values[0] > 0) {
                $attachment_id = intval($values[0]);
                $post_type = get_post_type($attachment_id);
                
                if ($post_type === 'attachment') {
                    $field_type = 'attachment';
                    $attachment_data = array(
                        'id' => $attachment_id,
                        'url' => wp_get_attachment_url($attachment_id),
                        'title' => get_the_title($attachment_id),
                        'alt' => get_post_meta($attachment_id, '_wp_attachment_image_alt', true),
                        'mime_type' => get_post_mime_type($attachment_id),
                        'file_size' => size_format(filesize(get_attached_file($attachment_id))),
                    );
                    
                    // Get image metadata if it's an image
                    $mime_type = get_post_mime_type($attachment_id);
                    if (strpos($mime_type, 'image/') === 0) {
                        $field_type = 'image';
                        $image_meta = wp_get_attachment_metadata($attachment_id);
                        if ($image_meta) {
                            $attachment_data['width'] = $image_meta['width'] ?? null;
                            $attachment_data['height'] = $image_meta['height'] ?? null;
                            $attachment_data['sizes'] = array();
                            
                            // Get different image sizes
                            $image_sizes = get_intermediate_image_sizes();
                            foreach ($image_sizes as $size) {
                                $image_src = wp_get_attachment_image_src($attachment_id, $size);
                                if ($image_src) {
                                    $attachment_data['sizes'][$size] = array(
                                        'url' => $image_src[0],
                                        'width' => $image_src[1],
                                        'height' => $image_src[2]
                                    );
                                }
                            }
                        }
                    }
                    
                    $expanded_data = $attachment_data;
                }
            }
            
            // Check if this might be a serialized array (like ACF repeater fields)
            if (is_array($formatted_value) && count($formatted_value) > 1) {
                $field_type = 'array';
            } elseif (is_string($formatted_value) && (
                strpos($formatted_value, 'a:') === 0 || 
                strpos($formatted_value, 's:') === 0 || 
                strpos($formatted_value, 'O:') === 0
            )) {
                $field_type = 'serialized';
                // Try to unserialize for better display
                $unserialized = maybe_unserialize($formatted_value);
                if ($unserialized !== $formatted_value) {
                    $expanded_data = $unserialized;
                }
            }
            
            // Check for URLs
            if (is_string($formatted_value) && filter_var($formatted_value, FILTER_VALIDATE_URL)) {
                $field_type = 'url';
            }
            
            // Check for email addresses
            if (is_string($formatted_value) && filter_var($formatted_value, FILTER_VALIDATE_EMAIL)) {
                $field_type = 'email';
            }
            
            // Check for dates (basic check for common date formats)
            if (is_string($formatted_value) && preg_match('/^\d{4}-\d{2}-\d{2}/', $formatted_value)) {
                $field_type = 'date';
            }
            
            $field_data = array(
                'meta_key' => $key,
                'meta_value' => $formatted_value,
                'field_type' => $field_type,
                'is_private' => strpos($key, '_') === 0,
                'count' => count($values)
            );
            
            // Add expanded data if available
            if ($expanded_data !== null) {
                $field_data['expanded_data'] = $expanded_data;
            }
            
            $formatted_meta[] = $field_data;
        }
        
        return array(
            'post_id' => $post_id,
            'post_type' => $post->post_type,
            'post_title' => $post->post_title,
            'meta_fields' => $formatted_meta,
            'total_fields' => count($formatted_meta),
            'include_private' => $include_private
        );
    }
    
    public function wp_bulk_update_meta($args) {
        if (!current_user_can('edit_posts')) {
            throw new Exception('Insufficient permissions to update meta fields');
        }
        
        $post_id = intval($args['post_id']);
        $meta_updates = $args['meta_updates'];
        
        if (!is_array($meta_updates)) {
            throw new Exception('meta_updates must be an array');
        }
        
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception('Post not found: ' . $post_id);
        }
        
        $results = array();
        $errors = array();
        
        foreach ($meta_updates as $update) {
            if (!isset($update['meta_key']) || !isset($update['meta_value'])) {
                $errors[] = 'Missing meta_key or meta_value in update';
                continue;
            }
            
            $meta_key = sanitize_text_field($update['meta_key']);
            $meta_value = $update['meta_value'];
            
            // Sanitize meta value based on its type
            if (is_array($meta_value)) {
                $meta_value = array_map('sanitize_text_field', $meta_value);
            } elseif (is_string($meta_value)) {
                $meta_value = sanitize_text_field($meta_value);
            }
            
            $result = update_post_meta($post_id, $meta_key, $meta_value);
            
            if ($result === false) {
                $errors[] = 'Failed to update meta field: ' . $meta_key;
            } else {
                $results[] = array(
                    'meta_key' => $meta_key,
                    'meta_value' => $meta_value,
                    'success' => true
                );
            }
        }
        
        return array(
            'post_id' => $post_id,
            'post_type' => $post->post_type,
            'post_title' => $post->post_title,
            'results' => $results,
            'errors' => $errors,
            'total_updates' => count($meta_updates),
            'successful_updates' => count($results),
            'failed_updates' => count($errors)
        );
    }
    
    public function wp_search_by_meta($args) {
        $meta_key = sanitize_text_field($args['meta_key']);
        $meta_value = isset($args['meta_value']) ? $args['meta_value'] : '';
        $meta_compare = isset($args['meta_compare']) ? sanitize_text_field($args['meta_compare']) : '=';
        $post_type = isset($args['post_type']) ? sanitize_text_field($args['post_type']) : 'any';
        $per_page = isset($args['per_page']) ? intval($args['per_page']) : 10;
        $page = isset($args['page']) ? intval($args['page']) : 1;
        
        $query_args = array(
            'post_type' => $post_type,
            'posts_per_page' => $per_page,
            'paged' => $page,
            'meta_query' => array(
                array(
                    'key' => $meta_key,
                    'value' => $meta_value,
                    'compare' => $meta_compare
                )
            )
        );
        
        // Remove meta value from query if searching for existence only
        if ($meta_compare === 'EXISTS' || $meta_compare === 'NOT EXISTS') {
            unset($query_args['meta_query'][0]['value']);
        }
        
        $query = new WP_Query($query_args);
        $posts = array();
        
        foreach ($query->posts as $post) {
            $posts[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'post_type' => $post->post_type,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'permalink' => get_permalink($post->ID),
                'meta_value' => get_post_meta($post->ID, $meta_key, true)
            );
        }
        
        return array(
            'posts' => $posts,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'current_page' => $page,
            'per_page' => $per_page,
            'meta_key' => $meta_key,
            'meta_value' => $meta_value,
            'meta_compare' => $meta_compare,
            'post_type' => $post_type
        );
    }
    
    public function wp_get_meta_keys($args) {
        $post_type = isset($args['post_type']) ? sanitize_text_field($args['post_type']) : 'any';
        $include_private = isset($args['include_private']) ? (bool) $args['include_private'] : false;
        
        global $wpdb;
        
        $where_clause = '';
        if ($post_type !== 'any') {
            $where_clause = $wpdb->prepare(' AND p.post_type = %s', $post_type);
        }
        
        $query = "
            SELECT DISTINCT pm.meta_key, COUNT(*) as count
            FROM {$wpdb->postmeta} pm
            JOIN {$wpdb->posts} p ON pm.post_id = p.ID
            WHERE p.post_status = 'publish'
            {$where_clause}
            GROUP BY pm.meta_key
            ORDER BY count DESC, pm.meta_key ASC
        ";
        
        $meta_keys = $wpdb->get_results($query);
        
        // Filter out private meta keys if requested
        if (!$include_private) {
            $meta_keys = array_filter($meta_keys, function($meta) {
                return strpos($meta->meta_key, '_') !== 0;
            });
        }
        
        $formatted_keys = array();
        foreach ($meta_keys as $meta) {
            $formatted_keys[] = array(
                'meta_key' => $meta->meta_key,
                'usage_count' => intval($meta->count),
                'is_private' => strpos($meta->meta_key, '_') === 0
            );
        }
        
        return array(
            'meta_keys' => $formatted_keys,
            'total_keys' => count($formatted_keys),
            'post_type' => $post_type,
            'include_private' => $include_private
        );
    }
    
    private function register_meta_field_tools() {
        // wp_get_meta_field - Get a specific meta field value
        $this->register_tool(array(
            'name' => 'wp_get_meta_field',
            'description' => 'Get a specific meta field value for a post, page, or custom post type by post ID and meta key',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The ID of the post/page/custom post type'),
                    'meta_key' => array('type' => 'string', 'description' => 'The meta field key to retrieve'),
                    'single' => array('type' => 'boolean', 'description' => 'Whether to return a single value or array. Defaults to true.')
                ),
                'required' => array('post_id', 'meta_key')
            ),
            'callback' => array($this, 'wp_get_meta_field')
        ));
        
        // wp_update_meta_field - Update or create a meta field
        $this->register_tool(array(
            'name' => 'wp_update_meta_field',
            'description' => 'Update or create a meta field value for a post, page, or custom post type',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The ID of the post/page/custom post type'),
                    'meta_key' => array('type' => 'string', 'description' => 'The meta field key to update'),
                    'meta_value' => array('type' => 'string', 'description' => 'The meta field value to set (can be string, number, array, or object)')
                ),
                'required' => array('post_id', 'meta_key', 'meta_value')
            ),
            'callback' => array($this, 'wp_update_meta_field')
        ));
        
        // wp_delete_meta_field - Delete a meta field
        $this->register_tool(array(
            'name' => 'wp_delete_meta_field',
            'description' => 'Delete a meta field from a post, page, or custom post type',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The ID of the post/page/custom post type'),
                    'meta_key' => array('type' => 'string', 'description' => 'The meta field key to delete'),
                    'meta_value' => array('type' => 'string', 'description' => 'Optional. The specific meta value to delete. If not provided, all values for the key will be deleted.')
                ),
                'required' => array('post_id', 'meta_key')
            ),
            'callback' => array($this, 'wp_delete_meta_field')
        ));
        
        // wp_list_meta_fields - List all meta fields for a post
        $this->register_tool(array(
            'name' => 'wp_list_meta_fields',
            'description' => 'List all meta fields for a specific post, page, or custom post type',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The ID of the post/page/custom post type'),
                    'include_private' => array('type' => 'boolean', 'description' => 'Whether to include private meta fields (starting with _). Defaults to false.')
                ),
                'required' => array('post_id')
            ),
            'callback' => array($this, 'wp_list_meta_fields')
        ));
        
        // wp_bulk_update_meta - Update multiple meta fields in one operation
        $this->register_tool(array(
            'name' => 'wp_bulk_update_meta',
            'description' => 'Update multiple meta fields for a post, page, or custom post type in one operation',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The ID of the post/page/custom post type'),
                    'meta_updates' => array(
                        'type' => 'array',
                        'description' => 'Array of meta field updates',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'meta_key' => array('type' => 'string', 'description' => 'The meta field key'),
                                'meta_value' => array('type' => 'string', 'description' => 'The meta field value')
                            ),
                            'required' => array('meta_key', 'meta_value')
                        )
                    )
                ),
                'required' => array('post_id', 'meta_updates')
            ),
            'callback' => array($this, 'wp_bulk_update_meta')
        ));
        
        // wp_search_by_meta - Search posts by meta field values
        $this->register_tool(array(
            'name' => 'wp_search_by_meta',
            'description' => 'Search posts, pages, or custom post types by meta field values',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'meta_key' => array('type' => 'string', 'description' => 'The meta field key to search by'),
                    'meta_value' => array('type' => 'string', 'description' => 'The meta field value to search for'),
                    'meta_compare' => array('type' => 'string', 'description' => 'Comparison operator: =, !=, >, >=, <, <=, LIKE, NOT LIKE, IN, NOT IN, BETWEEN, NOT BETWEEN, EXISTS, NOT EXISTS. Defaults to =.'),
                    'post_type' => array('type' => 'string', 'description' => 'Post type to search in. Defaults to any.'),
                    'per_page' => array('type' => 'integer', 'description' => 'Number of results per page. Defaults to 10.'),
                    'page' => array('type' => 'integer', 'description' => 'Page number. Defaults to 1.')
                ),
                'required' => array('meta_key')
            ),
            'callback' => array($this, 'wp_search_by_meta')
        ));
        
        // wp_get_meta_keys - Get all available meta keys for a post type
        $this->register_tool(array(
            'name' => 'wp_get_meta_keys',
            'description' => 'Get all available meta keys for a specific post type or all post types',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_type' => array('type' => 'string', 'description' => 'Post type to get meta keys for. Use "any" for all post types. Defaults to any.'),
                    'include_private' => array('type' => 'boolean', 'description' => 'Whether to include private meta keys (starting with _). Defaults to false.')
                )
            ),
            'callback' => array($this, 'wp_get_meta_keys')
        ));
    }
}

