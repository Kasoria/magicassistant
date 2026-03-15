<?php
/**
 * MagicAssistant
 *
 * @package           MagicAssistant
 * @author            Christian Wenterodt
 * @copyright         2024 Christian Wenterodt
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       MagicAssistant
 * Plugin URI:        https://magicplugins.io
 * Description:       Your personal AI assistant for WordPress websites.
 * Version:           2.0
 * Requires PHP:      7.4
 * Author:            Christian Wenterodt
 * Author URI:        https://chrispump.me
 * Text Domain:       magic-assistant
 * Domain Path:       /languages
 * License:           GPL v2 or later
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 */

if (!defined('ABSPATH')) exit;

// Load Composer autoloader (PSR-4 for MagicAssistant namespace)
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

// Define plugin constants
define('MAGIC_ASSISTANT_VERSION', '2.0');
define('MAGIC_ASSISTANT_PLUGIN_FILE', __FILE__);
define('MAGIC_ASSISTANT_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('MAGIC_ASSISTANT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('MAGIC_ASSISTANT_PLUGIN_BASENAME', plugin_basename(__FILE__));

class MagicAssistant {

  private $react_dev;
  private $admin;
  private $mcp_server;
  private $ai_provider;
  private $db;
  private $public_share;
  private $dataforseo;
  private $pagespeed_service;

  public function __construct() {
    add_action('plugins_loaded', array($this, 'init'));
  }

  public function init() {
    // Initialize database
    $this->db = new MagicAssistant\DB();

    // Initialize React development environment
    $this->react_dev = new MagicAssistant\React_Dev();

    // Initialize MCP server with database instance
    $this->mcp_server = new MagicAssistant\MCP_Server($this->db);

    // Initialize AI provider
    $this->ai_provider = new MagicAssistant\AI_Provider();
    $this->ai_provider->set_mcp_server($this->mcp_server);
    $this->ai_provider->set_db($this->db);

    // Set AI provider in MCP server for database access
    $this->mcp_server->set_ai_provider($this->ai_provider);

    // Initialize public sharing
    $this->public_share = new MagicAssistant\Public_Share();
    $this->public_share->set_db($this->db);

    // Initialize DataForSEO integration
    $this->dataforseo = new MagicAssistant\DataForSEO();
    $this->dataforseo->set_mcp_server($this->mcp_server);
    $this->dataforseo->set_ai_provider($this->ai_provider);

    // Initialize PageSpeed service
    $this->pagespeed_service = new MagicAssistant\PageSpeed_Service($this->ai_provider);

    // Initialize admin functionality
    if (is_admin()) {
      $this->admin = new MagicAssistant\Admin();
    }

    // Hook into WordPress
    add_action('init', array($this, 'setup'));
  }

  public function setup() {
    load_plugin_textdomain('magic-assistant', false, dirname(plugin_basename(__FILE__)) . '/languages');
  }

  /**
   * Get the MCP server instance
   */
  public function get_mcp_server() {
    return $this->mcp_server;
  }

  /**
   * Get the database instance
   */
  public function get_db() {
    return $this->db;
  }

  /**
   * Get the DataForSEO instance
   */
  public function get_dataforseo() {
    return $this->dataforseo;
  }

  /**
   * Get the PageSpeed service instance
   */
  public function get_pagespeed_service() {
    return $this->pagespeed_service;
  }


  /**
   * Static instance getter
   */
  public static function instance() {
    static $instance = null;
    if (null === $instance) {
      $instance = new self();
    }
    return $instance;
  }
}

// Initialize the plugin
$GLOBALS['magic_assistant'] = new MagicAssistant();

/**
 * Global function to access MagicAssistant instance
 */
function magic_assistant() {
  return $GLOBALS['magic_assistant'];
}

/**
 * Global function to access MagicAssistant MCP server
 */
function MATMCP() {
  return $GLOBALS['magic_assistant']->get_mcp_server();
}

/**
 * Global function to access MagicAssistant database
 */
function MATDB() {
  return $GLOBALS['magic_assistant']->get_db();
}

/**
 * Global function to access MagicAssistant DataForSEO
 */
function MATDFS() {
  return $GLOBALS['magic_assistant']->get_dataforseo();
}

/**
 * Global function to access MagicAssistant PageSpeed service
 */
function MATPS() {
  return $GLOBALS['magic_assistant']->get_pagespeed_service();
}

// Register login event tracker
\MagicAssistant\Login_Tracker::register();