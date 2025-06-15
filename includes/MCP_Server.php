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
    private $registered_tools = [];
    private $registered_resources = [];
    private $registered_prompts = [];
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    public function init() {
        // Check if MCP should be enabled
        $options = get_option('magic_assistant_settings', []);
        $this->enabled = isset($options['mcp_enabled']) && $options['mcp_enabled'];
        
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
    
    private function init_jwt_secret() {
        $this->jwt_secret = get_option('magic_assistant_mcp_jwt_secret');
        
        if (empty($this->jwt_secret)) {
            $this->jwt_secret = wp_generate_password(64, true, true);
            update_option('magic_assistant_mcp_jwt_secret', $this->jwt_secret);
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
        // Register Media Tools (from wordpress-mcp)
        $this->register_media_tools();
        
        // Register Custom Post Type Tools (from wordpress-mcp)
        $this->register_custom_post_type_tools();
        
        // Register Pages Tools (from wordpress-mcp)
        $this->register_pages_tools();
        
        // Register Posts Tools (from wordpress-mcp)
        $this->register_posts_tools();
        
        // Register Settings Tools (from wordpress-mcp)
        $this->register_settings_tools();
        
        // Register Site Info Tools (from wordpress-mcp)
        $this->register_site_info_tools();
        
        // Register Users Tools (from wordpress-mcp)
        $this->register_users_tools();
        
        // Register WooCommerce Tools (from wordpress-mcp)
        $this->register_woocommerce_tools();
        
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
                'inputSchema' => isset($tool['inputSchema']) ? $tool['inputSchema'] : array('type' => 'object')
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
                    'dimensions' => array('type' => 'object', 'description' => 'Product dimensions'),
                    'categories' => array('type' => 'array', 'description' => 'List of categories', 'items' => array('type' => 'object')),
                    'tags' => array('type' => 'array', 'description' => 'List of tags', 'items' => array('type' => 'object')),
                    'images' => array('type' => 'array', 'description' => 'List of images', 'items' => array('type' => 'object')),
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
                    'image' => array('type' => 'object', 'description' => 'Image data')
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
        
        // Check if create operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_create_tools'] ?? true)) {
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
        
        // Check if update operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_update_tools'] ?? true)) {
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
        
        // Check if delete operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_delete_tools'] ?? false)) {
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
        
        // Check if create operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_create_tools'] ?? true)) {
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
        
        // Check if update operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_update_tools'] ?? true)) {
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
        
        // Check if delete operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_delete_tools'] ?? false)) {
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
        
        // Check if create operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_create_tools'] ?? true)) {
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
        
        // Check if update operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_update_tools'] ?? true)) {
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
        
        // Check if delete operations are enabled
        $settings = get_option('magic_assistant_settings', array());
        if (!($settings['enable_delete_tools'] ?? false)) {
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
        
        // Check if the method is allowed based on settings
        $settings = get_option('magic_assistant_settings', array());
        
        switch ($method) {
            case 'DELETE':
                if (empty($settings['enable_delete_tools'])) {
                    throw new Exception('Delete operations are disabled in MCP settings.');
                }
                break;
            case 'POST':
                if (empty($settings['enable_create_tools'])) {
                    throw new Exception('Create operations are disabled in MCP settings.');
                }
                break;
            case 'PATCH':
            case 'PUT':
                if (empty($settings['enable_update_tools'])) {
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
                    'data' => array('type' => 'object', 'description' => 'Payload for POST or PATCH requests. Not required for GET or DELETE.'),
                    'params' => array('type' => 'object', 'description' => 'Query parameters for GET requests'),
                ),
                'required' => array('route', 'method'),
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
}
