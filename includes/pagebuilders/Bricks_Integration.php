<?php
namespace MagicAssistant\Pagebuilders;

use MagicAssistant\MCP_Server;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Bricks Page Builder Integration
 * 
 * Handles conversion of AI-generated HTML with Tailwind CSS classes
 * to native Bricks elements with proper styling
 */
class Bricks_Integration {
    
    private $tailwind_parser;
    private $element_mapper;
    
    public function __construct() {
        // Initialize dependencies when needed
        add_action('init', array($this, 'init'));
    }
    
    public function init() {
        // Only initialize if Bricks is active
        if (!$this->is_bricks_active()) {
            return;
        }
        
        // Initialize dependencies
        $this->tailwind_parser = new \MagicAssistant\Utils\TailwindParser();
        $this->element_mapper = new \MagicAssistant\PageBuilders\BricksElementMapper();
        
        // Register MCP tools for Bricks integration
        add_action('magic_assistant_mcp_init', array($this, 'register_mcp_tools'));
    }
    
    /**
     * Check if Bricks theme is active
     */
    public function is_bricks_active() {
        return defined('BRICKS_VERSION') || class_exists('Bricks\Database');
    }
    
    /**
     * Check if we're currently in Bricks builder
     */
    public function is_bricks_builder() {
        return function_exists('bricks_is_builder') && bricks_is_builder();
    }
    
    /**
     * Register MCP tools for Bricks integration
     */
    public function register_mcp_tools($mcp_server) {
        // Tool to insert HTML structure into Bricks
        $mcp_server->register_tool(array(
            'name' => 'bricks_insert_structure',
            'description' => 'Insert HTML structure with Tailwind CSS classes into Bricks page builder. Converts HTML elements to native Bricks elements and Tailwind classes to Bricks styling.',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The post ID to insert content into'),
                    'html' => array('type' => 'string', 'description' => 'Clean HTML structure with Tailwind CSS classes'),
                    'insert_position' => array('type' => 'string', 'description' => 'Where to insert (append, prepend, replace)', 'default' => 'append'),
                    'target_area' => array('type' => 'string', 'description' => 'Which area to insert into (content, header, footer)', 'default' => 'content'),
                    'parent_element_id' => array('type' => 'string', 'description' => 'Optional parent element ID to insert into')
                ),
                'required' => array('post_id', 'html')
            ),
            'callback' => array($this, 'tool_bricks_insert_structure')
        ));
        
        // Tool to get current page structure from Bricks
        $mcp_server->register_tool(array(
            'name' => 'bricks_get_structure',
            'description' => 'Get the current Bricks page structure and elements for analysis',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'post_id' => array('type' => 'integer', 'description' => 'The post ID to get structure from'),
                    'area' => array('type' => 'string', 'description' => 'Which area to get (content, header, footer)', 'default' => 'content')
                ),
                'required' => array('post_id')
            ),
            'callback' => array($this, 'tool_bricks_get_structure')
        ));
        
        // Tool to detect current builder context
        $mcp_server->register_tool(array(
            'name' => 'detect_builder_context',
            'description' => 'Detect if we are currently in a page builder (Bricks, Elementor, etc.) and return context information',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'url' => array('type' => 'string', 'description' => 'Current page URL to check context from')
                ),
                'required' => array()
            ),
            'callback' => array($this, 'tool_detect_builder_context')
        ));
    }
    
    /**
     * MCP Tool: Insert HTML structure into Bricks
     */
    public function tool_bricks_insert_structure($args) {
        $post_id = intval($args['post_id'] ?? 0);
        $html = trim($args['html'] ?? '');
        $insert_position = sanitize_text_field($args['insert_position'] ?? 'append');
        $target_area = sanitize_text_field($args['target_area'] ?? 'content');
        $parent_element_id = sanitize_text_field($args['parent_element_id'] ?? '');
        
        if (!$post_id || empty($html)) {
            throw new \Exception('post_id and html are required.');
        }
        
        if (!$this->is_bricks_active()) {
            throw new \Exception('Bricks theme is not active.');
        }
        
        $post = get_post($post_id);
        if (!$post) {
            throw new \Exception('Post not found.');
        }
        
        // Check if post uses Bricks
        if (!$this->post_uses_bricks($post_id)) {
            throw new \Exception('Post does not use Bricks builder.');
        }
        
        try {
            // Parse HTML and convert to Bricks elements
            $bricks_elements = $this->html_to_bricks_elements($html);
            
            // Insert elements into Bricks structure
            $result = $this->insert_elements_into_structure($post_id, $bricks_elements, $target_area, $insert_position, $parent_element_id);
            
            return array(
                'success' => true,
                'message' => 'HTML structure successfully converted and inserted into Bricks',
                'elements_created' => count($bricks_elements),
                'inserted_element_ids' => array_column($bricks_elements, 'id'),
                'result' => $result
            );
            
        } catch (\Exception $e) {
            throw new \Exception('Failed to insert structure: ' . $e->getMessage());
        }
    }
    
    /**
     * MCP Tool: Get current Bricks structure
     */
    public function tool_bricks_get_structure($args) {
        $post_id = intval($args['post_id'] ?? 0);
        $area = sanitize_text_field($args['area'] ?? 'content');
        
        if (!$post_id) {
            throw new \Exception('post_id is required.');
        }
        
        if (!$this->is_bricks_active()) {
            throw new \Exception('Bricks theme is not active.');
        }
        
        try {
            $structure = $this->get_bricks_structure($post_id, $area);
            
            return array(
                'success' => true,
                'post_id' => $post_id,
                'area' => $area,
                'structure' => $structure,
                'element_count' => count($structure)
            );
            
        } catch (\Exception $e) {
            throw new \Exception('Failed to get structure: ' . $e->getMessage());
        }
    }
    
    /**
     * MCP Tool: Detect builder context
     */
    public function tool_detect_builder_context($args) {
        $url = $args['url'] ?? '';
        
        $context = array(
            'is_builder' => false,
            'builder_type' => null,
            'post_id' => null,
            'can_edit' => false,
            'context_info' => array()
        );
        
        // Check if we're in Bricks builder
        if ($this->is_bricks_active()) {
            $context['builder_type'] = 'bricks';
            $context['is_builder'] = $this->is_bricks_builder();
            
            if ($context['is_builder']) {
                // Extract post ID from URL if available
                if (!empty($url) && preg_match('/[?&]post=(\d+)/', $url, $matches)) {
                    $context['post_id'] = intval($matches[1]);
                } elseif (!empty($url) && preg_match('/[?&]bricks=run/', $url)) {
                    // In Bricks builder mode
                    global $post;
                    if ($post) {
                        $context['post_id'] = $post->ID;
                    }
                }
                
                $context['can_edit'] = current_user_can('edit_posts');
                $context['context_info'] = array(
                    'bricks_version' => defined('BRICKS_VERSION') ? BRICKS_VERSION : 'unknown',
                    'builder_mode' => 'active'
                );
            }
        }
        
        return $context;
    }
    
    /**
     * Convert HTML with Tailwind classes to Bricks elements
     */
    private function html_to_bricks_elements($html) {
        // Parse HTML structure
        $dom = $this->parse_html($html);
        $elements = array();
        
        // Convert each DOM element to Bricks element
        foreach ($dom->childNodes as $node) {
            if ($node->nodeType === XML_ELEMENT_NODE) {
                $bricks_element = $this->convert_dom_node_to_bricks_element($node);
                if ($bricks_element) {
                    $elements[] = $bricks_element;
                }
            }
        }
        
        return $elements;
    }
    
    /**
     * Parse HTML string into DOM
     */
    private function parse_html($html) {
        $dom = new \DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = false;
        
        // Wrap HTML in a container to handle multiple root elements
        $wrapped_html = '<div>' . $html . '</div>';
        
        // Load HTML with error suppression
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">' . $wrapped_html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        
        // Get the wrapper div's children
        $body = $dom->getElementsByTagName('div')->item(0);
        
        return $body ?: $dom;
    }
    
    /**
     * Convert DOM node to Bricks element
     */
    private function convert_dom_node_to_bricks_element($node) {
        if ($node->nodeType !== XML_ELEMENT_NODE) {
            return null;
        }
        
        $tag_name = strtolower($node->nodeName);
        $classes = $node->getAttribute('class');
        $text_content = $this->get_text_content($node);
        
        // Map HTML element to Bricks element type
        $bricks_element_type = $this->element_mapper->map_html_to_bricks_element($tag_name, $classes, $text_content);
        
        // Generate unique element ID
        $element_id = $this->generate_element_id();
        
        // Parse Tailwind classes to CSS
        $parsed_styles = $this->tailwind_parser->parse_classes($classes);
        
        // Convert parsed CSS to Bricks settings
        $bricks_settings = $this->element_mapper->map_css_to_bricks_settings($parsed_styles, $bricks_element_type);
        
        // Add content based on element type
        if (!empty($text_content)) {
            $bricks_settings = $this->add_content_to_settings($bricks_settings, $text_content, $bricks_element_type);
        }
        
        // Handle other attributes
        $this->process_html_attributes($node, $bricks_settings, $bricks_element_type);
        
        // Create Bricks element structure
        $bricks_element = array(
            'id' => $element_id,
            'name' => $bricks_element_type,
            'settings' => $bricks_settings,
            'children' => array()
        );
        
        // Process child elements
        if ($node->hasChildNodes()) {
            foreach ($node->childNodes as $child) {
                if ($child->nodeType === XML_ELEMENT_NODE) {
                    $child_element = $this->convert_dom_node_to_bricks_element($child);
                    if ($child_element) {
                        $child_element['parent'] = $element_id;
                        $bricks_element['children'][] = $child_element;
                    }
                }
            }
        }
        
        return $bricks_element;
    }
    
    /**
     * Get text content from DOM node, excluding child element content
     */
    private function get_text_content($node) {
        $text = '';
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $text .= trim($child->textContent);
            }
        }
        return $text;
    }
    
    /**
     * Add content to Bricks element settings based on element type
     */
    private function add_content_to_settings($settings, $content, $element_type) {
        switch ($element_type) {
            case 'heading':
                $settings['text'] = $content;
                break;
            case 'text-basic':
                $settings['text'] = $content;
                break;
            case 'button':
                $settings['text'] = $content;
                break;
            case 'html':
                $settings['html'] = $content;
                break;
            default:
                $settings['text'] = $content;
                break;
        }
        
        return $settings;
    }
    
    /**
     * Process HTML attributes and add to Bricks settings
     */
    private function process_html_attributes($node, &$settings, $element_type) {
        // Handle href for links/buttons
        if ($node->hasAttribute('href')) {
            $href = $node->getAttribute('href');
            if ($element_type === 'button') {
                $settings['link'] = array('url' => $href);
            }
        }
        
        // Handle src for images
        if ($node->hasAttribute('src') && $element_type === 'image') {
            $settings['image'] = array('url' => $node->getAttribute('src'));
            if ($node->hasAttribute('alt')) {
                $settings['image']['alt'] = $node->getAttribute('alt');
            }
        }
        
        // Handle id attribute
        if ($node->hasAttribute('id')) {
            $settings['_attributes'] = array(
                array(
                    'name' => 'id',
                    'value' => $node->getAttribute('id')
                )
            );
        }
    }
    
    /**
     * Insert elements into Bricks structure
     */
    private function insert_elements_into_structure($post_id, $elements, $area, $position, $parent_id = '') {
        $meta_key = $this->get_bricks_meta_key($area);
        $current_structure = get_post_meta($post_id, $meta_key, true);
        
        if (empty($current_structure)) {
            $current_structure = array();
        } else {
            $current_structure = json_decode($current_structure, true);
            if (!is_array($current_structure)) {
                $current_structure = array();
            }
        }
        
        // Flatten elements array (include children as separate elements)
        $flat_elements = $this->flatten_elements_array($elements);
        
        // Insert elements based on position
        switch ($position) {
            case 'prepend':
                $current_structure = array_merge($flat_elements, $current_structure);
                break;
            case 'replace':
                $current_structure = $flat_elements;
                break;
            case 'append':
            default:
                $current_structure = array_merge($current_structure, $flat_elements);
                break;
        }
        
        // Save updated structure
        $json_structure = wp_json_encode($current_structure);
        update_post_meta($post_id, $meta_key, wp_slash($json_structure));
        
        return array(
            'meta_key' => $meta_key,
            'elements_inserted' => count($flat_elements),
            'total_elements' => count($current_structure)
        );
    }
    
    /**
     * Flatten nested elements array for Bricks storage format
     */
    private function flatten_elements_array($elements) {
        $flat = array();
        
        foreach ($elements as $element) {
            // Add the main element without children
            $flat_element = $element;
            unset($flat_element['children']);
            $flat[] = $flat_element;
            
            // Recursively add children
            if (!empty($element['children'])) {
                $child_elements = $this->flatten_elements_array($element['children']);
                $flat = array_merge($flat, $child_elements);
            }
        }
        
        return $flat;
    }
    
    /**
     * Get Bricks structure from post
     */
    private function get_bricks_structure($post_id, $area) {
        $meta_key = $this->get_bricks_meta_key($area);
        $structure = get_post_meta($post_id, $meta_key, true);
        
        if (empty($structure)) {
            return array();
        }
        
        $decoded = json_decode($structure, true);
        return is_array($decoded) ? $decoded : array();
    }
    
    /**
     * Get appropriate meta key for Bricks area
     */
    private function get_bricks_meta_key($area) {
        switch ($area) {
            case 'header':
                return defined('BRICKS_DB_PAGE_HEADER') ? BRICKS_DB_PAGE_HEADER : '_bricks_page_header';
            case 'footer':
                return defined('BRICKS_DB_PAGE_FOOTER') ? BRICKS_DB_PAGE_FOOTER : '_bricks_page_footer';
            case 'content':
            default:
                return defined('BRICKS_DB_PAGE_CONTENT') ? BRICKS_DB_PAGE_CONTENT : '_bricks_page_content_2';
        }
    }
    
    /**
     * Check if post uses Bricks
     */
    private function post_uses_bricks($post_id) {
        $content_key = $this->get_bricks_meta_key('content');
        return metadata_exists('post', $post_id, $content_key);
    }
    
    /**
     * Generate unique Bricks element ID
     */
    private function generate_element_id() {
        return 'el_' . wp_generate_password(6, false, false);
    }
} 