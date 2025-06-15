<?php
/**
 * MagicAssistant Uninstall
 *
 * Uninstalling MagicAssistant deletes user data and plugin options.
 *
 * @package MagicAssistant
 * @since 0.1.0
 */

// Exit if accessed directly
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

global $wpdb;

// Delete WordPress options created by the plugin
delete_option('mat_db_version');

// Delete any legacy options that might exist in wp_options (from migration)
$legacy_options = array(
    'mat_ai_provider',
    'mat_openai_api_key',
    'mat_anthropic_api_key',
    'mat_openai_model',
    'mat_anthropic_model',
    'mat_mcp_enabled',
    'mat_enable_create_tools',
    'mat_enable_update_tools',
    'mat_enable_delete_tools'
);

foreach ($legacy_options as $option) {
    delete_option($option);
}

// Delete user meta data that might exist from migrations
delete_metadata('user', 0, 'mat_theme', '', true);
delete_metadata('user', 0, 'magic_assistant_preferences', '', true);

// Remove custom database tables created by the DB class
$table_prefix = $wpdb->prefix . 'mat_';

// Main plugin tables
$tables_to_drop = array(
    $table_prefix . 'settings',      // Custom settings table
    $table_prefix . 'chat_history',  // Chat conversations and messages
    $table_prefix . 'api_logs'       // API request/response logs
);

foreach ($tables_to_drop as $table_name) {
    $wpdb->query($wpdb->prepare("DROP TABLE IF EXISTS %1s", $table_name));
}

// Clear any cached data
wp_cache_flush();

// Log cleanup completion for debugging (will be cleaned up with cache)
error_log('MagicAssistant: Plugin data cleanup completed during uninstall'); 