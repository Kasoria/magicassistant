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

// Delete plugin options
delete_option('magic_assistant_settings');
delete_option('magic_assistant_api_key');
delete_option('magic_assistant_mcp_settings');

// Delete user meta data
delete_metadata('user', 0, 'magic_assistant_preferences', '', true);

// Delete any custom database tables if they exist
global $wpdb;

// Remove any custom tables created by the plugin
$table_name = $wpdb->prefix . 'magic_assistant_conversations';
$wpdb->query("DROP TABLE IF EXISTS {$table_name}");

$table_name = $wpdb->prefix . 'magic_assistant_messages';
$wpdb->query("DROP TABLE IF EXISTS {$table_name}");

// Clear any cached data
wp_cache_flush(); 