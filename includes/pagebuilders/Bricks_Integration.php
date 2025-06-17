<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * Bricks Page Builder Integration
 * 
 * This class provides integration with Bricks pagebuilder, allowing the AI
 * to create native Bricks elements instead of raw HTML content.
 */
class Bricks_Integration {
    
    private $mcp_server;
    
    public function __construct() {
        // Constructor - basic setup
    }
    
    public function init() {
        // Register Bricks-specific MCP tools
        $this->register_bricks_tools();
        
        // Add hooks for Bricks integration
        add_action('wp_enqueue_scripts', array($this, 'enqueue_integration_scripts'));
        add_action('wp_footer', array($this, 'add_integration_scripts'));
    }
    
    public function set_mcp_server($mcp_server) {
        $this->mcp_server = $mcp_server;
        
        // Register tools now that we have the MCP server
        if ($mcp_server) {
            $this->register_bricks_tools();
        }
    }
    
    /**
     * Register Bricks-specific MCP tools
     */
    private function register_bricks_tools() {
        if (!$this->mcp_server) {
            return;
        }
        
        // Heading Element Tool
        $this->mcp_server->register_tool(array(
            'name' => 'bricks_add_heading',
            'description' => 'Add a native Bricks heading element to the page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'text' => array(
                        'type' => 'string',
                        'description' => 'The heading text content'
                    ),
                    'tag' => array(
                        'type' => 'string',
                        'enum' => array('h1', 'h2', 'h3', 'h4', 'h5', 'h6'),
                        'description' => 'HTML heading tag (h1-h6)',
                        'default' => 'h2'
                    ),
                    'parent_id' => array(
                        'type' => 'string',
                        'description' => 'Parent element ID to add this element to (optional)',
                        'default' => ''
                    ),
                    'position' => array(
                        'type' => 'integer',
                        'description' => 'Position within parent (0 = first, -1 = last)',
                        'default' => -1
                    )
                ),
                'required' => array('text')
            ),
            'callback' => array($this, 'add_heading_element')
        ));
        
        // Text Element Tool
        $this->mcp_server->register_tool(array(
            'name' => 'bricks_add_text',
            'description' => 'Add a native Bricks text/paragraph element to the page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'content' => array(
                        'type' => 'string',
                        'description' => 'The text content (can include basic HTML)'
                    ),
                    'parent_id' => array(
                        'type' => 'string',
                        'description' => 'Parent element ID to add this element to (optional)',
                        'default' => ''
                    ),
                    'position' => array(
                        'type' => 'integer',
                        'description' => 'Position within parent (0 = first, -1 = last)',
                        'default' => -1
                    )
                ),
                'required' => array('content')
            ),
            'callback' => array($this, 'add_text_element')
        ));
        
        // Image Element Tool
        $this->mcp_server->register_tool(array(
            'name' => 'bricks_add_image',
            'description' => 'Add a native Bricks image element to the page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'image_id' => array(
                        'type' => 'integer',
                        'description' => 'WordPress media library image ID'
                    ),
                    'image_url' => array(
                        'type' => 'string',
                        'description' => 'Image URL (alternative to image_id)'
                    ),
                    'alt_text' => array(
                        'type' => 'string',
                        'description' => 'Image alt text for accessibility',
                        'default' => ''
                    ),
                    'size' => array(
                        'type' => 'string',
                        'description' => 'WordPress image size (thumbnail, medium, large, full)',
                        'default' => 'large'
                    ),
                    'parent_id' => array(
                        'type' => 'string',
                        'description' => 'Parent element ID to add this element to (optional)',
                        'default' => ''
                    ),
                    'position' => array(
                        'type' => 'integer',
                        'description' => 'Position within parent (0 = first, -1 = last)',
                        'default' => -1
                    )
                ),
                'required' => array()
            ),
            'callback' => array($this, 'add_image_element')
        ));
        
        // Button Element Tool
        $this->mcp_server->register_tool(array(
            'name' => 'bricks_add_button',
            'description' => 'Add a native Bricks button element to the page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'text' => array(
                        'type' => 'string',
                        'description' => 'Button text'
                    ),
                    'link' => array(
                        'type' => 'string',
                        'description' => 'Button link URL',
                        'default' => '#'
                    ),
                    'style' => array(
                        'type' => 'string',
                        'enum' => array('primary', 'secondary', 'outline', 'text'),
                        'description' => 'Button style',
                        'default' => 'primary'
                    ),
                    'size' => array(
                        'type' => 'string',
                        'enum' => array('small', 'medium', 'large'),
                        'description' => 'Button size',
                        'default' => 'medium'
                    ),
                    'parent_id' => array(
                        'type' => 'string',
                        'description' => 'Parent element ID to add this element to (optional)',
                        'default' => ''
                    ),
                    'position' => array(
                        'type' => 'integer',
                        'description' => 'Position within parent (0 = first, -1 = last)',
                        'default' => -1
                    )
                ),
                'required' => array('text')
            ),
            'callback' => array($this, 'add_button_element')
        ));
        
        // Container/Section Element Tool
        $this->mcp_server->register_tool(array(
            'name' => 'bricks_add_container',
            'description' => 'Add a native Bricks container/section element to the page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'tag' => array(
                        'type' => 'string',
                        'enum' => array('div', 'section', 'article', 'aside', 'header', 'footer', 'main'),
                        'description' => 'HTML container tag',
                        'default' => 'div'
                    ),
                    'background_color' => array(
                        'type' => 'string',
                        'description' => 'Background color (hex, rgb, or CSS color name)',
                        'default' => ''
                    ),
                    'padding' => array(
                        'type' => 'string',
                        'description' => 'Padding (CSS format like "20px" or "20px 40px")',
                        'default' => ''
                    ),
                    'margin' => array(
                        'type' => 'string',
                        'description' => 'Margin (CSS format like "20px" or "20px 40px")',
                        'default' => ''
                    ),
                    'parent_id' => array(
                        'type' => 'string',
                        'description' => 'Parent element ID to add this element to (optional)',
                        'default' => ''
                    ),
                    'position' => array(
                        'type' => 'integer',
                        'description' => 'Position within parent (0 = first, -1 = last)',
                        'default' => -1
                    )
                ),
                'required' => array()
            ),
            'callback' => array($this, 'add_container_element')
        ));
        
        // List Element Tool
        $this->mcp_server->register_tool(array(
            'name' => 'bricks_add_list',
            'description' => 'Add a native Bricks list element to the page',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'items' => array(
                        'type' => 'array',
                        'description' => 'List items',
                        'items' => array(
                            'type' => 'string'
                        )
                    ),
                    'list_type' => array(
                        'type' => 'string',
                        'enum' => array('ul', 'ol'),
                        'description' => 'List type (ul for unordered, ol for ordered)',
                        'default' => 'ul'
                    ),
                    'parent_id' => array(
                        'type' => 'string',
                        'description' => 'Parent element ID to add this element to (optional)',
                        'default' => ''
                    ),
                    'position' => array(
                        'type' => 'integer',
                        'description' => 'Position within parent (0 = first, -1 = last)',
                        'default' => -1
                    )
                ),
                'required' => array('items')
            ),
            'callback' => array($this, 'add_list_element')
        ));
    }
    
    /**
     * Tool implementation methods
     */
    
    public function add_heading_element($args) {
        $text = $args['text'] ?? '';
        $tag = $args['tag'] ?? 'h2';
        $parent_id = $args['parent_id'] ?? '';
        $position = $args['position'] ?? -1;
        
        if (empty($text)) {
            throw new \Exception('Heading text is required');
        }
        
        $element_data = array(
            'id' => $this->generate_element_id(),
            'name' => 'heading',
            'settings' => array(
                'text' => $text,
                'tag' => $tag
            ),
            'parent' => $parent_id ?: '0', // Root if no parent
            'children' => array()
        );
        
        return $this->add_element_to_page($element_data, $position);
    }
    
    public function add_text_element($args) {
        $content = $args['content'] ?? '';
        $parent_id = $args['parent_id'] ?? '';
        $position = $args['position'] ?? -1;
        
        if (empty($content)) {
            throw new \Exception('Text content is required');
        }
        
        $element_data = array(
            'id' => $this->generate_element_id(),
            'name' => 'text-basic',
            'settings' => array(
                'text' => $content
            ),
            'parent' => $parent_id ?: '0',
            'children' => array()
        );
        
        return $this->add_element_to_page($element_data, $position);
    }
    
    public function add_image_element($args) {
        $image_id = $args['image_id'] ?? 0;
        $image_url = $args['image_url'] ?? '';
        $alt_text = $args['alt_text'] ?? '';
        $size = $args['size'] ?? 'large';
        $parent_id = $args['parent_id'] ?? '';
        $position = $args['position'] ?? -1;
        
        if (empty($image_id) && empty($image_url)) {
            throw new \Exception('Either image_id or image_url is required');
        }
        
        $image_settings = array();
        
        if ($image_id) {
            $image_settings['image'] = array(
                'id' => $image_id,
                'size' => $size
            );
            
            if ($alt_text) {
                $image_settings['altText'] = $alt_text;
            }
        } elseif ($image_url) {
            $image_settings['image'] = array(
                'url' => $image_url,
                'size' => $size
            );
            
            if ($alt_text) {
                $image_settings['altText'] = $alt_text;
            }
        }
        
        $element_data = array(
            'id' => $this->generate_element_id(),
            'name' => 'image',
            'settings' => $image_settings,
            'parent' => $parent_id ?: '0',
            'children' => array()
        );
        
        return $this->add_element_to_page($element_data, $position);
    }
    
    public function add_button_element($args) {
        $text = $args['text'] ?? '';
        $link = $args['link'] ?? '#';
        $style = $args['style'] ?? 'primary';
        $size = $args['size'] ?? 'medium';
        $parent_id = $args['parent_id'] ?? '';
        $position = $args['position'] ?? -1;
        
        if (empty($text)) {
            throw new \Exception('Button text is required');
        }
        
        $element_data = array(
            'id' => $this->generate_element_id(),
            'name' => 'button',
            'settings' => array(
                'text' => $text,
                'link' => array(
                    'type' => 'external',
                    'url' => $link
                ),
                'style' => $style,
                'size' => $size
            ),
            'parent' => $parent_id ?: '0',
            'children' => array()
        );
        
        return $this->add_element_to_page($element_data, $position);
    }
    
    public function add_container_element($args) {
        $tag = $args['tag'] ?? 'div';
        $background_color = $args['background_color'] ?? '';
        $padding = $args['padding'] ?? '';
        $margin = $args['margin'] ?? '';
        $parent_id = $args['parent_id'] ?? '';
        $position = $args['position'] ?? -1;
        
        $settings = array(
            'tag' => $tag
        );
        
        // Add styling if provided
        if ($background_color || $padding || $margin) {
            $css_settings = array();
            
            if ($background_color) {
                $css_settings['background-color'] = $background_color;
            }
            
            if ($padding) {
                $css_settings['padding'] = $padding;
            }
            
            if ($margin) {
                $css_settings['margin'] = $margin;
            }
            
            $settings['_cssGlobalClasses'] = array();
            $settings['_cssClasses'] = array();
            $settings['_css'] = $css_settings;
        }
        
        $element_data = array(
            'id' => $this->generate_element_id(),
            'name' => 'container',
            'settings' => $settings,
            'parent' => $parent_id ?: '0',
            'children' => array()
        );
        
        return $this->add_element_to_page($element_data, $position);
    }
    
    public function add_list_element($args) {
        $items = $args['items'] ?? array();
        $list_type = $args['list_type'] ?? 'ul';
        $parent_id = $args['parent_id'] ?? '';
        $position = $args['position'] ?? -1;
        
        if (empty($items)) {
            throw new \Exception('List items are required');
        }
        
        // Convert items array to Bricks list format
        $list_items = array();
        foreach ($items as $item) {
            $list_items[] = array(
                'text' => $item
            );
        }
        
        $element_data = array(
            'id' => $this->generate_element_id(),
            'name' => 'list',
            'settings' => array(
                'items' => $list_items,
                'tag' => $list_type
            ),
            'parent' => $parent_id ?: '0',
            'children' => array()
        );
        
        return $this->add_element_to_page($element_data, $position);
    }
    
    /**
     * Helper methods
     */
    
    /**
     * Generate a unique element ID
     */
    private function generate_element_id() {
        return 'magicai_' . uniqid();
    }
    
    /**
     * Add element to the current page/post
     */
    private function add_element_to_page($element_data, $position = -1) {
        $post_id = $this->get_current_post_id();
        
        if (!$post_id) {
            throw new \Exception('No post ID found. Unable to add element to page.');
        }
        
        // Get current Bricks data
        $bricks_data = $this->get_bricks_data($post_id);
        
        // Add the new element
        if ($position === -1) {
            // Add to end
            $bricks_data[] = $element_data;
        } else {
            // Insert at specific position
            array_splice($bricks_data, $position, 0, array($element_data));
        }
        
        // Save updated Bricks data
        $this->save_bricks_data($post_id, $bricks_data);
        
        return array(
            'success' => true,
            'element_id' => $element_data['id'],
            'element_name' => $element_data['name'],
            'message' => 'Bricks ' . $element_data['name'] . ' element added successfully',
            'post_id' => $post_id,
            'total_elements' => count($bricks_data)
        );
    }
    
    /**
     * Get current post ID from various contexts
     */
    private function get_current_post_id() {
        // Try to get from MagicAssistant context first
        global $magic_assistant;
        if ($magic_assistant && method_exists($magic_assistant, 'get_mcp_server')) {
            $mcp_server = $magic_assistant->get_mcp_server();
            if ($mcp_server && method_exists($mcp_server, 'get_current_context')) {
                $context = $mcp_server->get_current_context();
                if (isset($context['post_id']) && $context['post_id']) {
                    return intval($context['post_id']);
                }
            }
        }
        
        // Try to get from URL parameters (admin edit screen)
        if (isset($_GET['post'])) {
            return intval($_GET['post']);
        }
        
        // Try to get from Bricks builder context
        if (isset($_GET['bricks']) && isset($_GET['preview_id'])) {
            return intval($_GET['preview_id']);
        }
        
        if (isset($_GET['bricks']) && isset($_GET['post_id'])) {
            return intval($_GET['post_id']);
        }
        
        // Try to get from POST data (AJAX calls)
        if (isset($_POST['post_id'])) {
            return intval($_POST['post_id']);
        }
        
        if (isset($_POST['postId'])) {
            return intval($_POST['postId']);
        }
        
        // Try Bricks-specific methods
        if (function_exists('bricks_is_builder') && bricks_is_builder()) {
            // Try to get from Bricks query vars
            global $wp_query;
            if (isset($wp_query->query_vars['post_id'])) {
                return intval($wp_query->query_vars['post_id']);
            }
            
            // Try to get from Bricks globals
            if (defined('BRICKS_DB_PAGE_CONTENT')) {
                global $post;
                if ($post && $post->ID) {
                    return intval($post->ID);
                }
            }
        }
        
        // Try global post ID
        $post_id = get_the_ID();
        if ($post_id) {
            return intval($post_id);
        }
        
        // Last resort: try to get from HTTP_REFERER if it's a Bricks context
        if (isset($_SERVER['HTTP_REFERER'])) {
            $referer = $_SERVER['HTTP_REFERER'];
            if (strpos($referer, 'bricks=run') !== false) {
                // Parse the referer URL to get post ID
                $url_parts = parse_url($referer);
                if (isset($url_parts['query'])) {
                    parse_str($url_parts['query'], $query_params);
                    if (isset($query_params['post_id'])) {
                        return intval($query_params['post_id']);
                    }
                    if (isset($query_params['preview_id'])) {
                        return intval($query_params['preview_id']);
                    }
                }
                
                // Try to get from URL path
                if (isset($url_parts['path'])) {
                    $path_parts = explode('/', trim($url_parts['path'], '/'));
                    // Look for numeric values that could be post IDs
                    foreach ($path_parts as $part) {
                        if (is_numeric($part) && intval($part) > 0) {
                            return intval($part);
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Get Bricks data for a post
     */
    private function get_bricks_data($post_id) {
        // Check if Bricks constants are defined
        if (!defined('BRICKS_DB_PAGE_CONTENT')) {
            return array();
        }
        
        $bricks_data = get_post_meta($post_id, BRICKS_DB_PAGE_CONTENT, true);
        
        if (!is_array($bricks_data)) {
            return array();
        }
        
        return $bricks_data;
    }
    
    /**
     * Save Bricks data for a post
     */
    private function save_bricks_data($post_id, $bricks_data) {
        // Check if Bricks constants are defined
        if (!defined('BRICKS_DB_PAGE_CONTENT')) {
            throw new \Exception('Bricks constants not found. Make sure Bricks theme is active.');
        }
        
        // Set editor mode to Bricks if not already set
        $editor_mode = get_post_meta($post_id, BRICKS_DB_EDITOR_MODE, true);
        if ($editor_mode !== 'bricks') {
            update_post_meta($post_id, BRICKS_DB_EDITOR_MODE, 'bricks');
        }
        
        // Save the Bricks data
        return update_post_meta($post_id, BRICKS_DB_PAGE_CONTENT, $bricks_data);
    }
    
    /**
     * Enqueue integration scripts
     */
    public function enqueue_integration_scripts() {
        // Only load in Bricks builder
        if (!function_exists('bricks_is_builder') || !bricks_is_builder()) {
            return;
        }
        
        // Enqueue scripts that help with Bricks integration
        wp_enqueue_script(
            'magicassistant-bricks-integration',
            plugins_url('assets/js/bricks-integration.js', dirname(dirname(__FILE__))),
            array('jquery'),
            '1.0.0',
            true
        );
        
        // Pass data to JavaScript
        wp_localize_script('magicassistant-bricks-integration', 'magicAssistantBricks', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('magicassistant_bricks'),
            'isBuilder' => function_exists('bricks_is_builder') && bricks_is_builder(),
            'postId' => get_the_ID()
        ));
    }
    
    /**
     * Add integration scripts to footer
     */
    public function add_integration_scripts() {
        // Only load in Bricks builder
        if (!function_exists('bricks_is_builder') || !bricks_is_builder()) {
            return;
        }
        
        ?>
        <script>
        // Additional integration scripts can be added here
        // This ensures the AI chat knows it's in Bricks mode
        if (typeof window.matAdminData !== 'undefined') {
            window.matAdminData.pagebuilder = 'bricks';
            window.matAdminData.pagebuilderName = 'Bricks';
        }
        </script>
        <?php
    }
} 