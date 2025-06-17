<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * Pagebuilder Integration Manager
 * 
 * Handles detection and coordination of different pagebuilder integrations
 */
class Pagebuilder_Integration {
    
    private $active_integrations = [];
    private $db;
    
    public function __construct() {
        add_action('init', array($this, 'init'), 11);
        add_action('wp_enqueue_scripts', array($this, 'enqueue_integration_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_integration_scripts'));
    }
    
    public function set_db($db) {
        $this->db = $db;
    }
    
    public function init() {
        // Initialize available pagebuilder integrations
        $this->load_integrations();
        
        // Register MCP tools for pagebuilder content generation
        add_filter('magicassistant_register_mcp_tools', array($this, 'register_pagebuilder_tools'));
    }
    
    private function load_integrations() {
        // Bricks Integration
        if ($this->is_bricks_active()) {
            require_once MAGICASSISTANT_PATH . 'includes/pagebuilders/Bricks_Integration.php';
            $bricks_integration = new Pagebuilders\Bricks_Integration();
            $bricks_integration->set_db($this->db);
            $this->active_integrations['bricks'] = $bricks_integration;
        }
        
        // Future integrations can be added here
        // Elementor, Gutenberg, etc.
    }
    
    public function enqueue_integration_scripts() {
        // Only enqueue on pages where pagebuilders are active
        if (!empty($this->active_integrations)) {
            wp_enqueue_script(
                'magicassistant-pagebuilder-integration',
                MAGICASSISTANT_URL . 'assets/js/pagebuilder-integration.js',
                array('jquery'),
                MAGICASSISTANT_VERSION,
                true
            );
            
            // Pass integration data to JavaScript
            wp_localize_script(
                'magicassistant-pagebuilder-integration',
                'matPagebuilderData',
                array(
                    'active_integrations' => array_keys($this->active_integrations),
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('mat_pagebuilder_nonce'),
                    'rest_url' => rest_url('magicassistant/v1/'),
                    'rest_nonce' => wp_create_nonce('wp_rest')
                )
            );
        }
    }
    
    /**
     * Register pagebuilder-specific MCP tools
     */
    public function register_pagebuilder_tools($mcp_server) {
        // Register pagebuilder content generation tool
        $mcp_server->register_tool(array(
            'name' => 'pagebuilder_generate_content',
            'description' => 'Generate structured content for pagebuilders using HTML with Tailwind CSS classes',
            'inputSchema' => array(
                'type' => 'object',
                'properties' => array(
                    'content_type' => array(
                        'type' => 'string',
                        'enum' => array('hero', 'section', 'card', 'list', 'form', 'custom'),
                        'description' => 'Type of content to generate'
                    ),
                    'html_content' => array(
                        'type' => 'string',
                        'description' => 'Clean semantic HTML structure with Tailwind CSS classes'
                    ),
                    'pagebuilder' => array(
                        'type' => 'string',
                        'enum' => array('bricks', 'elementor', 'gutenberg'),
                        'description' => 'Target pagebuilder for content generation'
                    ),
                    'insert_method' => array(
                        'type' => 'string',
                        'enum' => array('append', 'prepend', 'replace'),
                        'default' => 'append',
                        'description' => 'How to insert the content into the page'
                    )
                ),
                'required' => array('html_content', 'pagebuilder')
            ),
            'callback' => array($this, 'generate_pagebuilder_content')
        ));
        
        return $mcp_server;
    }
    
    /**
     * Generate and insert pagebuilder content
     */
    public function generate_pagebuilder_content($args) {
        $html_content = $args['html_content'] ?? '';
        $pagebuilder = $args['pagebuilder'] ?? '';
        $content_type = $args['content_type'] ?? 'custom';
        $insert_method = $args['insert_method'] ?? 'append';
        
        if (empty($html_content) || empty($pagebuilder)) {
            throw new \Exception('HTML content and pagebuilder are required');
        }
        
        // Check if requested pagebuilder integration is active
        if (!isset($this->active_integrations[$pagebuilder])) {
            throw new \Exception("Pagebuilder integration '{$pagebuilder}' is not active or available");
        }
        
        $integration = $this->active_integrations[$pagebuilder];
        
        // Process the HTML content through the specific pagebuilder integration
        $result = $integration->process_html_content($html_content, $content_type, $insert_method);
        
        return array(
            'success' => true,
            'pagebuilder' => $pagebuilder,
            'content_type' => $content_type,
            'elements_created' => $result['elements_created'] ?? 0,
            'insert_script' => $result['insert_script'] ?? '',
            'message' => $result['message'] ?? 'Content generated successfully'
        );
    }
    
    /**
     * Detect if Bricks is active and available
     */
    private function is_bricks_active() {
        return defined('BRICKS_VERSION') || class_exists('Bricks\Element');
    }
    
    /**
     * Detect if Elementor is active and available
     */
    private function is_elementor_active() {
        return defined('ELEMENTOR_VERSION') || class_exists('\Elementor\Plugin');
    }
    
    /**
     * Get active integrations
     */
    public function get_active_integrations() {
        return $this->active_integrations;
    }
    
    /**
     * Check if we're currently in a pagebuilder context
     */
    public function is_pagebuilder_context() {
        foreach ($this->active_integrations as $integration) {
            if (method_exists($integration, 'is_builder_context') && $integration->is_builder_context()) {
                return true;
            }
        }
        return false;
    }
} 