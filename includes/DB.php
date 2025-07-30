<?php
/**
 * Database functionality for MagicAssistant
 *
 * @package MagicAssistant
 */

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

class DB {
    
    private $table_prefix;
    private $settings_table;
    private $chat_history_table;
    private $api_logs_table;
    private $shared_conversations_table;
    
    public function __construct() {
        global $wpdb;
        $this->table_prefix = $wpdb->prefix . 'mat_';
        $this->settings_table = $this->table_prefix . 'settings';
        $this->chat_history_table = $this->table_prefix . 'chat_history';
        $this->api_logs_table = $this->table_prefix . 'api_logs';
        $this->shared_conversations_table = $this->table_prefix . 'shared_conversations';
        
        // Hook into WordPress activation/deactivation
        register_activation_hook(MAGIC_ASSISTANT_PLUGIN_FILE, array($this, 'create_tables'));
        register_deactivation_hook(MAGIC_ASSISTANT_PLUGIN_FILE, array($this, 'cleanup_on_deactivation'));
        
        // Check if tables exist and create them if they don't
        add_action('init', array($this, 'ensure_tables_exist'), 1);
    }
    
    /**
     * Create custom tables for MagicAssistant
     */
    public function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Settings table
        $settings_sql = "CREATE TABLE {$this->settings_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            setting_key varchar(100) NOT NULL,
            setting_value longtext,
            user_id bigint(20) unsigned DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_setting_user (setting_key, user_id),
            KEY idx_setting_key (setting_key),
            KEY idx_user_id (user_id)
        ) $charset_collate;";
        
        // Chat sessions table (optimized for conversation storage)
        $chat_sessions_sql = "CREATE TABLE {$this->chat_history_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            session_id varchar(100) NOT NULL UNIQUE,
            title varchar(255) DEFAULT NULL,
            messages longtext NOT NULL,
            message_count int(11) DEFAULT 0,
            total_tokens int(11) DEFAULT 0,
            total_cost decimal(10,6) DEFAULT 0.00,
            providers_used text DEFAULT NULL,
            models_used text DEFAULT NULL,
            agent_mode tinyint(1) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_session (session_id),
            KEY idx_user_id (user_id),
            KEY idx_updated_at (updated_at),
            KEY idx_user_updated (user_id, updated_at)
        ) $charset_collate;";
        
        // API logs table
        $api_logs_sql = "CREATE TABLE {$this->api_logs_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            provider varchar(50) NOT NULL,
            model varchar(100) DEFAULT NULL,
            endpoint varchar(200) NOT NULL,
            request_data longtext,
            response_data longtext,
            status_code int(11) DEFAULT NULL,
            tokens_used int(11) DEFAULT NULL,
            cost decimal(10,6) DEFAULT NULL,
            response_time float DEFAULT NULL,
            error_message text DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_provider (user_id, provider),
            KEY idx_created_at (created_at),
            KEY idx_status_code (status_code)
        ) $charset_collate;";
        
        // Shared conversations table
        $shared_conversations_sql = "CREATE TABLE {$this->shared_conversations_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            session_id varchar(100) DEFAULT NULL,
            share_id varchar(32) NOT NULL UNIQUE,
            title varchar(255) NOT NULL,
            formatted_content longtext NOT NULL,
            html_content longtext NOT NULL,
            view_count bigint(20) unsigned DEFAULT 0,
            is_public tinyint(1) DEFAULT 1,
            password varchar(255) DEFAULT NULL,
            expires_at datetime DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_share_id (share_id),
            KEY idx_user_id (user_id),
            KEY idx_session_id (session_id),
            KEY idx_is_public (is_public),
            KEY idx_expires_at (expires_at),
            KEY idx_created_at (created_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        
        dbDelta($settings_sql);
        dbDelta($chat_sessions_sql);
        dbDelta($api_logs_sql);
        dbDelta($shared_conversations_sql);
        
        // Set database version
        update_option('mat_db_version', '1.0.0');
        
        // Migrate existing settings from wp_options if they exist
        $this->migrate_existing_settings();
        
        // Fix any double-encrypted API keys
        $this->fix_double_encrypted_keys();
    }
    
    /**
     * Ensure tables exist - called on init
     */
    public function ensure_tables_exist() {
        if (!$this->tables_exist()) {
            $this->create_tables();
        }
    }
    
    /**
     * Check if database needs to be updated
     */
    public function check_database_version() {
        $current_version = get_option('mat_db_version', '0.0.0');
        $plugin_version = MAGIC_ASSISTANT_VERSION;
        
        if (version_compare($current_version, $plugin_version, '<')) {
            $this->create_tables();
        }
        
        // Also run the fix for double-encrypted keys on version updates
        $this->fix_double_encrypted_keys();
    }
    
    /**
     * Migrate existing settings from wp_options to custom table
     */
    private function migrate_existing_settings() {
        // List of settings keys that might exist in wp_options
        $settings_keys = array(
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
        
        foreach ($settings_keys as $key) {
            $value = get_option($key);
            if ($value !== false) {
                // Save to custom table
                $this->save_setting(str_replace('mat_', '', $key), $value);
                // Remove from wp_options
                delete_option($key);
            }
        }
        
        // Migrate theme settings from custom table back to WordPress user meta
        $this->migrate_theme_settings_to_usermeta();
    }
    
    /**
     * Migrate theme settings from custom table to WordPress user meta
     */
    private function migrate_theme_settings_to_usermeta() {
        global $wpdb;
        
        // Check if tables exist first
        if (!$this->tables_exist()) {
            return;
        }
        
        // Get all theme settings from custom table
        $theme_settings = $wpdb->get_results(
            "SELECT user_id, setting_value FROM {$this->settings_table} WHERE setting_key = 'theme' AND user_id IS NOT NULL",
            ARRAY_A
        );
        
        if ($theme_settings) {
            foreach ($theme_settings as $setting) {
                $user_id = intval($setting['user_id']);
                $theme_value = maybe_unserialize($setting['setting_value']);
                
                // Only migrate if user doesn't already have a theme in user meta
                $existing_theme = get_user_meta($user_id, 'mat_theme', true);
                if (empty($existing_theme) && !empty($theme_value)) {
                    update_user_meta($user_id, 'mat_theme', $theme_value);
                }
            }
            
            // Remove theme settings from custom table
            $wpdb->delete(
                $this->settings_table,
                array('setting_key' => 'theme'),
                array('%s')
            );
        }
    }
    
    /**
     * Save a global setting
     */
    public function save_setting($key, $value) {
        global $wpdb;
        
        // Ensure tables exist
        if (!$this->tables_exist()) {
            $this->create_tables();
        }
        
        // Encrypt API keys for security
        if ($this->is_api_key_setting($key)) {
            $value = $this->encrypt_api_key($value);
        }
        
        $data = array(
            'setting_key' => $key,
            'setting_value' => maybe_serialize($value),
            'user_id' => null
        );
        
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$this->settings_table} WHERE setting_key = %s AND user_id IS NULL",
            $key
        ));
        
        if ($existing) {
            $wpdb->update(
                $this->settings_table,
                array('setting_value' => maybe_serialize($value)),
                array('id' => $existing->id),
                array('%s'),
                array('%d')
            );
        } else {
            $wpdb->insert($this->settings_table, $data, array('%s', '%s', '%d'));
        }
        
        return true;
    }
    
    /**
     * Get a global setting
     */
    public function get_setting($key, $default = null) {
        global $wpdb;
        
        // Check if tables exist first
        if (!$this->tables_exist()) {
            return $default;
        }
        
        $value = $wpdb->get_var($wpdb->prepare(
            "SELECT setting_value FROM {$this->settings_table} WHERE setting_key = %s AND user_id IS NULL",
            $key
        ));
        
        if ($value !== null) {
            $unserialized = maybe_unserialize($value);
            
            // Decrypt API keys if needed
            if ($this->is_api_key_setting($key) && !empty($unserialized)) {
                return $this->decrypt_api_key($unserialized);
            }
            
            return $unserialized;
        }
        
        return $default;
    }
    
    /**
     * Check if a setting exists (returns true/false, not the value)
     */
    public function setting_exists($key, $user_id = null) {
        global $wpdb;
        
        if (!$this->tables_exist()) {
            return false;
        }
        
        if ($user_id === null) {
            $count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->settings_table} WHERE setting_key = %s AND user_id IS NULL",
                $key
            ));
        } else {
            $count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->settings_table} WHERE setting_key = %s AND user_id = %d",
                $key,
                $user_id
            ));
        }
        
        return intval($count) > 0;
    }
    
    /**
     * Save a user-specific setting
     */
    public function save_user_setting($key, $value, $user_id = null) {
        global $wpdb;
        
        // Ensure tables exist
        if (!$this->tables_exist()) {
            $this->create_tables();
        }
        
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }
        
        // Encrypt API keys for security
        if ($this->is_api_key_setting($key)) {
            $value = $this->encrypt_api_key($value);
        }
        
        $data = array(
            'setting_key' => $key,
            'setting_value' => maybe_serialize($value),
            'user_id' => $user_id
        );
        
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$this->settings_table} WHERE setting_key = %s AND user_id = %d",
            $key,
            $user_id
        ));
        
        if ($existing) {
            $wpdb->update(
                $this->settings_table,
                array('setting_value' => maybe_serialize($value)),
                array('id' => $existing->id),
                array('%s'),
                array('%d')
            );
        } else {
            $wpdb->insert($this->settings_table, $data, array('%s', '%s', '%d'));
        }
        
        return true;
    }
    
    /**
     * Get a user-specific setting
     */
    public function get_user_setting($key, $user_id = null, $default = null) {
        global $wpdb;
        
        // Check if tables exist first
        if (!$this->tables_exist()) {
            return $default;
        }
        
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }
        
        $value = $wpdb->get_var($wpdb->prepare(
            "SELECT setting_value FROM {$this->settings_table} WHERE setting_key = %s AND user_id = %d",
            $key,
            $user_id
        ));
        
        if ($value !== null) {
            return maybe_unserialize($value);
        }
        
        return $default;
    }
    
    /**
     * Get all settings (global and user-specific)
     */
    public function get_all_settings($user_id = null) {
        global $wpdb;
        
        // Check if tables exist first
        if (!$this->tables_exist()) {
            return array();
        }
        
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }
        
        // Get global settings
        $global_settings = $wpdb->get_results(
            "SELECT setting_key, setting_value FROM {$this->settings_table} WHERE user_id IS NULL",
            ARRAY_A
        );
        
        // Get user-specific settings
        $user_settings = $wpdb->get_results($wpdb->prepare(
            "SELECT setting_key, setting_value FROM {$this->settings_table} WHERE user_id = %d",
            $user_id
        ), ARRAY_A);
        
        $settings = array();
        
        // Process global settings
        if (is_array($global_settings)) {
            foreach ($global_settings as $setting) {
                $value = maybe_unserialize($setting['setting_value']);
                // Decrypt API keys
                if ($this->is_api_key_setting($setting['setting_key']) && !empty($value)) {
                    $value = $this->decrypt_api_key($value);
                }
                $settings[$setting['setting_key']] = $value;
            }
        }
        
        // Process user settings (these override global settings)
        if (is_array($user_settings)) {
            foreach ($user_settings as $setting) {
                $value = maybe_unserialize($setting['setting_value']);
                // Decrypt API keys
                if ($this->is_api_key_setting($setting['setting_key']) && !empty($value)) {
                    $value = $this->decrypt_api_key($value);
                }
                $settings[$setting['setting_key']] = $value;
            }
        }
        
        return $settings;
    }
    
    /**
     * Delete a setting
     */
    public function delete_setting($key, $user_id = null) {
        global $wpdb;
        
        if ($user_id === null) {
            // Delete global setting
            $wpdb->delete(
                $this->settings_table,
                array('setting_key' => $key, 'user_id' => null),
                array('%s', '%d')
            );
        } else {
            // Delete user-specific setting
            $wpdb->delete(
                $this->settings_table,
                array('setting_key' => $key, 'user_id' => $user_id),
                array('%s', '%d')
            );
        }
        
        return true;
    }
    
    /**
     * Save or update a chat session with new message
     */
    public function save_chat_message($user_id, $session_id, $role, $content, $provider = null, $model = null, $tokens_used = null, $response_time = null, $cost = null, $debug_tool_data = null, $agent_mode = null, $reasoning = null, $tool_calls_count = null) {
        global $wpdb;
        
        // Get existing session
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->chat_history_table} WHERE session_id = %s AND user_id = %d",
            $session_id,
            $user_id
        ));
        
        // Get user information for user messages
        $user_info = array();
        if ($role === 'user') {
            $user = get_userdata($user_id);
            if ($user) {
                $user_info = array(
                    'user_id' => $user_id,
                    'user_name' => $user->display_name,
                    'user_avatar' => get_avatar_url($user_id)
                );
            }
        }
        
        $new_message = array(
            'role' => $role,
            'content' => $content,
            'timestamp' => current_time('mysql'),
            'provider' => $provider,
            'model' => $model,
            'tokens_used' => $tokens_used,
            'response_time' => $response_time,
            'cost' => $cost
        );
        
        // Add additional fields if they exist
        if ($debug_tool_data !== null) {
            $new_message['debug_tool_data'] = $debug_tool_data;
        }
        
        if ($agent_mode !== null) {
            $new_message['agent_mode'] = $agent_mode;
        }
        
        if ($reasoning !== null) {
            $new_message['reasoning'] = $reasoning;
        }
        
        if ($tool_calls_count !== null) {
            $new_message['tool_calls_count'] = $tool_calls_count;
        }
        
        // Add user info for user messages
        if (!empty($user_info)) {
            $new_message = array_merge($new_message, $user_info);
        }
        
        if ($existing) {
            // Update existing session
            $messages = json_decode($existing->messages, true) ?: array();
            $messages[] = $new_message;
            
            // Update metadata
            $message_count = count($messages);
            $total_tokens = intval($existing->total_tokens) + intval($tokens_used);
            $total_cost = floatval($existing->total_cost) + floatval($cost);
            
            // Track providers and models used
            $providers_used = $existing->providers_used ? explode(',', $existing->providers_used) : array();
            $models_used = $existing->models_used ? explode(',', $existing->models_used) : array();
            
            if ($provider && !in_array($provider, $providers_used)) {
                $providers_used[] = $provider;
            }
            if ($model && !in_array($model, $models_used)) {
                $models_used[] = $model;
            }
            
            // Generate title from first user message if not set
            $title = $existing->title;
            if (!$title) {
                $first_user_message = null;
                foreach ($messages as $msg) {
                    if ($msg['role'] === 'user') {
                        $first_user_message = $msg['content'];
                        break;
                    }
                }
                if ($first_user_message) {
                    $title = strlen($first_user_message) > 50 
                        ? substr($first_user_message, 0, 50) . '...' 
                        : $first_user_message;
                }
            }
            
            return $wpdb->update(
                $this->chat_history_table,
                array(
                    'title' => $title,
                    'messages' => wp_json_encode($messages),
                    'message_count' => $message_count,
                    'total_tokens' => $total_tokens,
                    'total_cost' => $total_cost,
                    'providers_used' => implode(',', array_unique($providers_used)),
                    'models_used' => implode(',', array_unique($models_used))
                ),
                array('id' => $existing->id),
                array('%s', '%s', '%d', '%d', '%f', '%s', '%s'),
                array('%d')
            );
        } else {
            // Create new session
            $messages = array($new_message);
            
            // Generate title from first user message
            $title = null;
            if ($role === 'user') {
                $title = strlen($content) > 50 ? substr($content, 0, 50) . '...' : $content;
            }
            
            return $wpdb->insert(
                $this->chat_history_table,
                array(
                    'user_id' => $user_id,
                    'session_id' => $session_id,
                    'title' => $title,
                    'messages' => wp_json_encode($messages),
                    'message_count' => 1,
                    'total_tokens' => intval($tokens_used),
                    'total_cost' => floatval($cost),
                    'providers_used' => $provider ? $provider : '',
                    'models_used' => $model ? $model : '',
                    'agent_mode' => 0
                ),
                array('%d', '%s', '%s', '%s', '%d', '%d', '%f', '%s', '%s', '%d')
            );
        }
    }
    
    /**
     * Get chat history for a user
     */
    public function get_chat_history($user_id, $session_id = null, $limit = 50) {
        global $wpdb;
        
        if ($session_id) {
            // Get specific session
            $session = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$this->chat_history_table} 
                WHERE user_id = %d AND session_id = %s",
                $user_id,
                $session_id
            ));
            
            if ($session && $session->messages) {
                $messages = json_decode($session->messages, true);
                return is_array($messages) ? $messages : array();
            }
            
            return array();
        } else {
            // Get all sessions for user (for session list)
            $sessions = $wpdb->get_results($wpdb->prepare(
                "SELECT session_id, title, message_count, total_tokens, 
                        providers_used, models_used, agent_mode, created_at, updated_at
                FROM {$this->chat_history_table} 
                WHERE user_id = %d 
                ORDER BY updated_at DESC LIMIT %d",
                $user_id,
                $limit
            ), ARRAY_A);
            
            return $sessions;
        }
    }
    
    /**
     * Log API request/response
     */
    public function log_api_request($user_id, $provider, $model, $endpoint, $request_data, $response_data, $status_code, $tokens_used = null, $cost = null, $response_time = null, $error_message = null) {
        global $wpdb;
        
        $data = array(
            'user_id' => $user_id,
            'provider' => $provider,
            'model' => $model,
            'endpoint' => $endpoint,
            'request_data' => maybe_serialize($request_data),
            'response_data' => maybe_serialize($response_data),
            'status_code' => $status_code,
            'tokens_used' => $tokens_used,
            'cost' => $cost,
            'response_time' => $response_time,
            'error_message' => $error_message
        );
        
        return $wpdb->insert($this->api_logs_table, $data, array('%d', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%f', '%f', '%s'));
    }
    
    /**
     * Get API usage statistics
     */
    public function get_api_stats($user_id = null, $days = 30) {
        global $wpdb;
        
        $date_from = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        
        if ($user_id) {
            $stats = $wpdb->get_row($wpdb->prepare(
                "SELECT 
                    COUNT(*) as total_requests,
                    SUM(tokens_used) as total_tokens,
                    SUM(cost) as total_cost,
                    AVG(response_time) as avg_response_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
                FROM {$this->api_logs_table} 
                WHERE user_id = %d AND created_at >= %s",
                $user_id,
                $date_from
            ), ARRAY_A);
        } else {
            $stats = $wpdb->get_row($wpdb->prepare(
                "SELECT 
                    COUNT(*) as total_requests,
                    SUM(tokens_used) as total_tokens,
                    SUM(cost) as total_cost,
                    AVG(response_time) as avg_response_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
                FROM {$this->api_logs_table} 
                WHERE created_at >= %s",
                $date_from
            ), ARRAY_A);
        }
        
        return $stats;
    }
    
    /**
     * Clean up old data
     */
    public function cleanup_old_data($days = 90) {
        global $wpdb;
        
        $date_threshold = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        
        // Clean up old chat sessions (using updated_at for last activity)
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->chat_history_table} WHERE updated_at < %s",
            $date_threshold
        ));
        
        // Clean up old API logs
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->api_logs_table} WHERE created_at < %s",
            $date_threshold
        ));
        
        return true;
    }
    
    /**
     * Cleanup on plugin deactivation
     */
    public function cleanup_on_deactivation() {
        // Optionally clean up data on deactivation
        // For now, we'll keep the data in case user reactivates
        // Uncomment the following lines if you want to remove all data on deactivation
        
        // global $wpdb;
        // $wpdb->query("DROP TABLE IF EXISTS {$this->settings_table}");
        // $wpdb->query("DROP TABLE IF EXISTS {$this->chat_history_table}");
        // $wpdb->query("DROP TABLE IF EXISTS {$this->api_logs_table}");
        // delete_option('mat_db_version');
    }
    
    /**
     * Get table names (for debugging/maintenance)
     */
    public function get_table_names() {
        return array(
            'settings' => $this->settings_table,
            'chat_history' => $this->chat_history_table,
            'api_logs' => $this->api_logs_table
        );
    }
    
    /**
     * Check if tables exist
     */
    public function tables_exist() {
        global $wpdb;
        
        $tables = array($this->settings_table, $this->chat_history_table, $this->api_logs_table, $this->shared_conversations_table);
        
        foreach ($tables as $table) {
            $result = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
            if ($result !== $table) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check if a setting key is an API key that should be encrypted
     */
    private function is_api_key_setting($key) {
        $api_key_settings = array(
            'openai_api_key',
            'anthropic_api_key',
            'openrouter_api_key',
            'surecart_license_key', // SureCart license key for debug view access
            'api_key' // Generic fallback
        );
        
        return in_array($key, $api_key_settings);
    }
    
    /**
     * Encrypt an API key using AES-256-CBC
     */
    public function encrypt_api_key($api_key) {
        if (empty($api_key)) {
            return '';
        }
        
        // Use WordPress salts for encryption key
        $key = hash('sha256', (defined('AUTH_SALT') ? AUTH_SALT : 'mat_default_salt') . (defined('SECURE_AUTH_SALT') ? SECURE_AUTH_SALT : 'mat_secure_salt'));
        
        // Generate a random IV
        $iv = openssl_random_pseudo_bytes(16);
        
        // Encrypt the API key
        $encrypted = openssl_encrypt($api_key, 'AES-256-CBC', $key, 0, $iv);
        
        // Return base64 encoded IV + encrypted data
        return base64_encode($iv . $encrypted);
    }
    
    /**
     * Decrypt an API key
     */
    public function decrypt_api_key($encrypted_api_key) {
        if (empty($encrypted_api_key)) {
            return '';
        }
        
        // Use WordPress salts for encryption key
        $key = hash('sha256', (defined('AUTH_SALT') ? AUTH_SALT : 'mat_default_salt') . (defined('SECURE_AUTH_SALT') ? SECURE_AUTH_SALT : 'mat_secure_salt'));
        
        // Decode the base64 data
        $data = base64_decode($encrypted_api_key);
        
        if ($data === false || strlen($data) < 16) {
            return '';
        }
        
        // Extract IV and encrypted data
        $iv = substr($data, 0, 16);
        $encrypted = substr($data, 16);
        
        // Decrypt the API key
        $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, 0, $iv);
        
        return $decrypted !== false ? $decrypted : '';
    }
    
    /**
     * Check if an API key is configured (has encrypted data stored)
     */
    public function has_api_key($key, $user_id = null) {
        $stored_value = $user_id ? $this->get_user_setting($key, $user_id) : $this->get_setting($key);
        return !empty($stored_value);
    }
    
    /**
     * Delete an API key from the database
     */
    public function delete_api_key($key, $user_id = null) {
        return $this->delete_setting($key, $user_id);
    }
    
    /**
     * Delete a chat session
     */
    public function delete_chat_session($user_id, $session_id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->chat_history_table,
            array(
                'user_id' => $user_id,
                'session_id' => $session_id
            ),
            array('%d', '%s')
        );
    }
    
    /**
     * Delete all chat sessions for a user
     */
    public function delete_all_chat_sessions($user_id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->chat_history_table,
            array('user_id' => $user_id),
            array('%d')
        );
    }
    
    /**
     * Truncate chat session at a specific message index
     * This removes all messages from the specified index onwards
     */
    public function truncate_chat_session($user_id, $session_id, $message_index) {
        global $wpdb;
        
        // Get all messages for this session ordered by created_at
        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT id FROM {$this->chat_history_table} 
             WHERE user_id = %d AND session_id = %s 
             ORDER BY created_at ASC",
            $user_id,
            $session_id
        ));
        
        // If we don't have enough messages or invalid index, return
        if (!$messages || $message_index >= count($messages)) {
            return false;
        }
        
        // Get the ID of the message at the specified index
        $truncate_from_id = $messages[$message_index]->id;
        
        // Delete all messages from this ID onwards
        $deleted = $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->chat_history_table} 
             WHERE user_id = %d AND session_id = %s AND id >= %d",
            $user_id,
            $session_id,
            $truncate_from_id
        ));
        
        return $deleted !== false;
    }
    
    /**
     * Get chat session metadata
     */
    public function get_chat_session($user_id, $session_id) {
        global $wpdb;
        
        return $wpdb->get_row($wpdb->prepare(
            "SELECT session_id, title, message_count, total_tokens, 
                    providers_used, models_used, created_at, updated_at
            FROM {$this->chat_history_table} 
            WHERE user_id = %d AND session_id = %s",
            $user_id,
            $session_id
        ), ARRAY_A);
    }
    
    /**
     * Create a shared conversation
     */
    public function create_shared_conversation($user_id, $session_id, $title, $formatted_content, $html_content, $expires_at = null) {
        global $wpdb;
        
        // Generate unique share ID
        $share_id = $this->generate_share_id();
        
        // Ensure unique share_id
        $attempts = 0;
        while ($this->share_id_exists($share_id) && $attempts < 10) {
            $share_id = $this->generate_share_id();
            $attempts++;
        }
        
        if ($attempts >= 10) {
            return false; // Failed to generate unique ID
        }
        
        $data = array(
            'user_id' => $user_id,
            'session_id' => $session_id,
            'share_id' => $share_id,
            'title' => $title,
            'formatted_content' => $formatted_content,
            'html_content' => $html_content,
            'expires_at' => $expires_at
        );
        
        $result = $wpdb->insert($this->shared_conversations_table, $data, array('%d', '%s', '%s', '%s', '%s', '%s', '%s'));
        
        return $result ? $share_id : false;
    }
    
    /**
     * Get shared conversation by share_id
     */
    public function get_shared_conversation($share_id) {
        global $wpdb;
        
        $conversation = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->shared_conversations_table} 
            WHERE share_id = %s AND is_public = 1 
            AND (expires_at IS NULL OR expires_at > NOW())",
            $share_id
        ), ARRAY_A);
        
        // Increment view count if conversation exists
        if ($conversation) {
            $wpdb->update(
                $this->shared_conversations_table,
                array('view_count' => intval($conversation['view_count']) + 1),
                array('id' => $conversation['id']),
                array('%d'),
                array('%d')
            );
            $conversation['view_count'] = intval($conversation['view_count']) + 1;
        }
        
        return $conversation;
    }
    
    /**
     * Get user's shared conversations
     */
    public function get_user_shared_conversations($user_id, $limit = 50) {
        global $wpdb;
        
        return $wpdb->get_results($wpdb->prepare(
            "SELECT share_id, title, view_count, is_public, expires_at, created_at, updated_at
            FROM {$this->shared_conversations_table} 
            WHERE user_id = %d 
            ORDER BY created_at DESC LIMIT %d",
            $user_id,
            $limit
        ), ARRAY_A);
    }
    
    /**
     * Delete shared conversation
     */
    public function delete_shared_conversation($user_id, $share_id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->shared_conversations_table,
            array(
                'user_id' => $user_id,
                'share_id' => $share_id
            ),
            array('%d', '%s')
        );
    }
    
    /**
     * Update shared conversation
     */
    public function update_shared_conversation($user_id, $share_id, $data) {
        global $wpdb;
        
        $allowed_fields = array('title', 'is_public', 'expires_at');
        $update_data = array();
        $format = array();
        
        foreach ($allowed_fields as $field) {
            if (isset($data[$field])) {
                $update_data[$field] = $data[$field];
                $format[] = in_array($field, ['is_public']) ? '%d' : '%s';
            }
        }
        
        if (empty($update_data)) {
            return false;
        }
        
        return $wpdb->update(
            $this->shared_conversations_table,
            $update_data,
            array(
                'user_id' => $user_id,
                'share_id' => $share_id
            ),
            $format,
            array('%d', '%s')
        );
    }
    
    /**
     * Clean up expired shared conversations
     */
    public function cleanup_expired_shared_conversations() {
        global $wpdb;
        
        return $wpdb->query(
            "DELETE FROM {$this->shared_conversations_table} 
            WHERE expires_at IS NOT NULL AND expires_at <= NOW()"
        );
    }
    
    /**
     * Generate unique share ID
     */
    private function generate_share_id() {
        return wp_generate_password(16, false, false);
    }
    
    /**
     * Check if share ID exists
     */
    private function share_id_exists($share_id) {
        global $wpdb;
        
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$this->shared_conversations_table} WHERE share_id = %s",
            $share_id
        ));
        
        return intval($exists) > 0;
    }
    
    /**
     * Persist the agent mode flag for a chat session (0 = chat, 1 = agent)
     */
    public function set_chat_session_mode($user_id, $session_id, $agent_mode) {
        global $wpdb;

        return $wpdb->update(
            $this->chat_history_table,
            array('agent_mode' => $agent_mode ? 1 : 0),
            array('user_id' => $user_id, 'session_id' => $session_id),
            array('%d'),
            array('%d', '%s')
        );
    }
    
    /**
     * Fix double-encrypted API keys
     * This migrates keys that were accidentally encrypted twice
     */
    private function fix_double_encrypted_keys() {
        global $wpdb;
        
        // Check if tables exist first
        if (!$this->tables_exist()) {
            return;
        }
        
        // Get all API key settings
        $api_key_settings = array(
            'openai_api_key',
            'anthropic_api_key',
            'openrouter_api_key',
            'dataforseo_api_key',
            'dataforseo_login_id'
        );
        
        foreach ($api_key_settings as $key) {
            // Get the raw value from database
            $raw_value = $wpdb->get_var($wpdb->prepare(
                "SELECT setting_value FROM {$this->settings_table} WHERE setting_key = %s AND user_id IS NULL",
                $key
            ));
            
            if ($raw_value) {
                $unserialized = maybe_unserialize($raw_value);
                
                if (!empty($unserialized)) {
                    // Try to decrypt twice to see if it's double-encrypted
                    $first_decrypt = $this->decrypt_api_key($unserialized);
                    
                    if (!empty($first_decrypt)) {
                        // Try second decryption
                        $second_decrypt = $this->decrypt_api_key($first_decrypt);
                        
                        // If second decryption succeeds and produces a different result,
                        // it means the key was double-encrypted
                        if (!empty($second_decrypt) && $second_decrypt !== $first_decrypt) {
                            // Re-save with single encryption
                            // Note: save_setting will encrypt it once
                            $this->save_setting($key, $second_decrypt);
                        }
                    }
                }
            }
        }
    }
}
