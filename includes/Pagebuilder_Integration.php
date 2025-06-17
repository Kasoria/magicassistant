<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * Pagebuilder Integration Manager
 * 
 * This class manages pagebuilder integrations and detects which pagebuilder
 * is currently active, then loads the appropriate integration class.
 */
class Pagebuilder_Integration {
    
    private $active_integration = null;
    private $integrations = array();
    private $mcp_server;
    
    public function __construct() {
        add_action('init', array($this, 'init'), 15); // Load after other plugins
    }
    
    public function init() {
        // Register available pagebuilder integrations
        $this->register_integrations();
        
        // Detect and load active pagebuilder
        $this->detect_and_load_active_pagebuilder();
    }
    
    public function set_mcp_server($mcp_server) {
        $this->mcp_server = $mcp_server;
        
        // Pass MCP server to active integration
        if ($this->active_integration) {
            $this->active_integration->set_mcp_server($mcp_server);
        }
    }
    
    /**
     * Register all available pagebuilder integrations
     */
    private function register_integrations() {
        // Bricks integration
        $this->integrations['bricks'] = array(
            'name' => 'Bricks',
            'class' => 'MagicAssistant\\Bricks_Integration',
            'detect_callback' => array($this, 'detect_bricks'),
            'file' => plugin_dir_path(__FILE__) . 'pagebuilders/Bricks_Integration.php'
        );
        
        // Future integrations can be added here
        // $this->integrations['elementor'] = array(...);
        // $this->integrations['gutenberg'] = array(...);
    }
    
    /**
     * Detect which pagebuilder is currently active and load its integration
     */
    private function detect_and_load_active_pagebuilder() {
        foreach ($this->integrations as $key => $integration) {
            if (call_user_func($integration['detect_callback'])) {
                $this->load_integration($key, $integration);
                break;
            }
        }
    }
    
    /**
     * Load a specific pagebuilder integration
     */
    private function load_integration($key, $integration) {
        if (file_exists($integration['file'])) {
            require_once $integration['file'];
            
            if (class_exists($integration['class'])) {
                $this->active_integration = new $integration['class']();
                
                if ($this->mcp_server) {
                    $this->active_integration->set_mcp_server($this->mcp_server);
                }
                
                // Initialize the integration
                $this->active_integration->init();
            }
        }
    }
    
    /**
     * Detection methods for each pagebuilder
     */
    
    /**
     * Detect if Bricks is active and user is in builder mode
     */
    public function detect_bricks() {
        // Check if Bricks theme is active
        if (!function_exists('bricks_is_builder')) {
            return false;
        }
        
        // Check if user is in Bricks builder or this is a builder call
        if (function_exists('bricks_is_builder') && bricks_is_builder()) {
            return true;
        }
        
        if (function_exists('bricks_is_builder_call') && bricks_is_builder_call()) {
            return true;
        }
        
        // Check if this is a context where Bricks elements should be created
        // (e.g., when AI is creating content for a Bricks-enabled page)
        if ($this->is_bricks_context()) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if we're in a Bricks context (editing a Bricks page/template)
     */
    private function is_bricks_context() {
        // Check if current post is set to use Bricks
        $post_id = $this->get_current_post_id();
        
        if (!$post_id) {
            return false;
        }
        
        // Check if this post/page uses Bricks
        if (function_exists('\\Bricks\\Helpers::get_editor_mode')) {
            $editor_mode = \Bricks\Helpers::get_editor_mode($post_id);
            return $editor_mode === 'bricks';
        }
        
        return false;
    }
    
    /**
     * Get current post ID from various contexts
     */
    private function get_current_post_id() {
        // Try to get from URL parameters (admin edit screen)
        if (isset($_GET['post'])) {
            return intval($_GET['post']);
        }
        
        // Try to get from POST data (AJAX calls)
        if (isset($_POST['post_id'])) {
            return intval($_POST['post_id']);
        }
        
        if (isset($_POST['postId'])) {
            return intval($_POST['postId']);
        }
        
        // Try global post ID
        return get_the_ID();
    }
    
    /**
     * Get the active integration instance
     */
    public function get_active_integration() {
        return $this->active_integration;
    }
    
    /**
     * Check if any pagebuilder integration is active
     */
    public function has_active_integration() {
        return $this->active_integration !== null;
    }
    
    /**
     * Get the name of the active pagebuilder
     */
    public function get_active_pagebuilder_name() {
        if (!$this->active_integration) {
            return null;
        }
        
        foreach ($this->integrations as $key => $integration) {
            if ($this->active_integration instanceof $integration['class']) {
                return $integration['name'];
            }
        }
        
        return null;
    }
} 