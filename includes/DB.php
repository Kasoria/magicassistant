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
    private $ai_agents_table;
    private $knowledge_base_table;
    private $chatbots_table;
    
    public function __construct() {
        global $wpdb;
        $this->table_prefix = $wpdb->prefix . 'mat_';
        $this->settings_table = $this->table_prefix . 'settings';
        $this->chat_history_table = $this->table_prefix . 'chat_history';
        $this->api_logs_table = $this->table_prefix . 'api_logs';
        $this->shared_conversations_table = $this->table_prefix . 'shared_conversations';
        $this->ai_agents_table = $this->table_prefix . 'ai_agents';
        $this->knowledge_base_table = $this->table_prefix . 'knowledge_base';
        $this->chatbots_table = $this->table_prefix . 'chatbots';
        
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
            agent_id bigint(20) unsigned DEFAULT NULL,
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
        
        // AI Agents table
        $ai_agents_sql = "CREATE TABLE {$this->ai_agents_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            name varchar(255) NOT NULL,
            description text DEFAULT NULL,
            system_message longtext DEFAULT NULL,
            tonality varchar(100) DEFAULT 'professional',
            response_length varchar(50) DEFAULT 'medium',
            temperature decimal(3,2) DEFAULT 0.70,
            max_tokens int(11) DEFAULT 2000,
            knowledge_base_ids text DEFAULT NULL,
            is_active tinyint(1) DEFAULT 1,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_is_active (is_active),
            KEY idx_created_at (created_at)
        ) $charset_collate;";
        
        // Knowledge Base table
        $knowledge_base_sql = "CREATE TABLE {$this->knowledge_base_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            name varchar(255) NOT NULL,
            description text DEFAULT NULL,
            content longtext NOT NULL,
            tags text DEFAULT NULL,
            category varchar(100) DEFAULT NULL,
            attached_files text DEFAULT NULL,
            is_active tinyint(1) DEFAULT 1,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_category (category),
            KEY idx_is_active (is_active),
            KEY idx_created_at (created_at)
        ) $charset_collate;";
        
        // Chatbots table
        $chatbots_sql = "CREATE TABLE {$this->chatbots_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            name varchar(255) NOT NULL,
            description text DEFAULT NULL,
            agent_id bigint(20) unsigned NOT NULL,
            custom_header_name varchar(255) DEFAULT NULL,
            custom_header_logo text DEFAULT NULL,
            trigger_button_settings longtext DEFAULT NULL,
            chatbot_styling longtext DEFAULT NULL,
            behavior_settings longtext DEFAULT NULL,
            quick_messages longtext DEFAULT NULL,
            display_conditions longtext DEFAULT NULL,
            rate_limit_settings longtext DEFAULT NULL,
            is_active tinyint(1) DEFAULT 1,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_agent_id (agent_id),
            KEY idx_is_active (is_active),
            KEY idx_created_at (created_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        
        dbDelta($settings_sql);
        dbDelta($chat_sessions_sql);
        dbDelta($api_logs_sql);
        dbDelta($shared_conversations_sql);
        dbDelta($ai_agents_sql);
        dbDelta($knowledge_base_sql);
        dbDelta($chatbots_sql);
        
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
        
        // Run content mode migration if needed
        $this->run_content_mode_migration();

        // Run chatbot header customization migration if needed
        $this->run_chatbot_header_migration();

        // Run provider override migration if needed
        $this->run_provider_override_migration();
    }

    private function run_content_mode_migration() {
        // Check if migration has already been run
        $migration_version = $this->get_setting('content_mode_migration_version', 0);
        
        if ($migration_version < 1) {
            // Run the migration
            require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/migrations/content-mode-settings.php';
            
            if (\MagicAssistant\Migrations\ContentModeSettings::up($this)) {
                $this->save_setting('content_mode_migration_version', 1);
            }
        }
    }

    private function run_chatbot_header_migration() {
        // Check if migration has already been run
        $migration_version = $this->get_setting('chatbot_header_migration_version', 0);

        if ($migration_version < 1) {
            global $wpdb;

            // Check if columns already exist
            $columns = $wpdb->get_results("SHOW COLUMNS FROM {$this->chatbots_table}");
            $column_names = array_column($columns, 'Field');

            $columns_to_add = [];
            if (!in_array('custom_header_name', $column_names)) {
                $columns_to_add[] = "ADD COLUMN custom_header_name varchar(255) DEFAULT NULL";
            }
            if (!in_array('custom_header_logo', $column_names)) {
                $columns_to_add[] = "ADD COLUMN custom_header_logo text DEFAULT NULL";
            }

            if (!empty($columns_to_add)) {
                $sql = "ALTER TABLE {$this->chatbots_table} " . implode(', ', $columns_to_add);
                $result = $wpdb->query($sql); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Static DDL migration, no user input

                if ($result !== false) {
                    $this->save_setting('chatbot_header_migration_version', 1);
                }
            } else {
                // Columns already exist, mark migration as complete
                $this->save_setting('chatbot_header_migration_version', 1);
            }
        }
    }

    private function run_provider_override_migration() {
        // Check if migration has already been run
        $migration_version = $this->get_setting('provider_override_migration_version', 0);

        if ($migration_version < 1) {
            global $wpdb;

            // Check if columns already exist
            $columns = $wpdb->get_results("SHOW COLUMNS FROM {$this->chat_history_table}");
            $column_names = array_column($columns, 'Field');

            $columns_to_add = [];
            if (!in_array('override_provider', $column_names)) {
                $columns_to_add[] = "ADD COLUMN override_provider varchar(50) DEFAULT NULL";
            }
            if (!in_array('override_model', $column_names)) {
                $columns_to_add[] = "ADD COLUMN override_model varchar(100) DEFAULT NULL";
            }

            if (!empty($columns_to_add)) {
                $sql = "ALTER TABLE {$this->chat_history_table} " . implode(', ', $columns_to_add);
                $result = $wpdb->query($sql); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Static DDL migration, no user input

                if ($result !== false) {
                    $this->save_setting('provider_override_migration_version', 1);
                }
            } else {
                // Columns already exist, mark migration as complete
                $this->save_setting('provider_override_migration_version', 1);
            }
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
                // Special handling for OpenRouter API key migration
                if ($key === 'openrouter_api_key' && !$this->is_encrypted_value($unserialized)) {
                    // This is a plain text key from before encryption was added
                    // Re-save it encrypted
                    $this->save_setting($key, $unserialized);
                    return $unserialized;
                }
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
                    // Special handling for OpenRouter API key migration
                    if ($setting['setting_key'] === 'openrouter_api_key' && !$this->is_encrypted_value($value)) {
                        // This is a plain text key from before encryption was added
                        // Re-save it encrypted
                        $this->save_setting($setting['setting_key'], $value);
                        // Return the plain text value for this request
                        $settings[$setting['setting_key']] = $value;
                    } else {
                        $value = $this->decrypt_api_key($value);
                        $settings[$setting['setting_key']] = $value;
                    }
                } else {
                    $settings[$setting['setting_key']] = $value;
                }
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
    public function save_chat_message($user_id, $session_id, $role, $content, $provider = null, $model = null, $tokens_used = null, $response_time = null, $cost = null, $debug_tool_data = null, $agent_mode = null, $reasoning = null, $tool_calls_count = null, $processing_steps = null) {
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
        
        if ($processing_steps !== null) {
            $new_message['processing_steps'] = $processing_steps;
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
                        providers_used, models_used, agent_mode, agent_id,
                        override_provider, override_model, created_at, updated_at
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
        
        $date_from = wp_date('Y-m-d H:i:s', strtotime("-{$days} days"));
        
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
        
        $date_threshold = wp_date('Y-m-d H:i:s', strtotime("-{$days} days"));
        
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
        
        $tables = array($this->settings_table, $this->chat_history_table, $this->api_logs_table, $this->shared_conversations_table, $this->ai_agents_table, $this->knowledge_base_table, $this->chatbots_table);
        
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
            'google_api_key',
            'openrouter_api_key',
            'surecart_license_key', // SureCart license key for debug view access
            'api_key' // Generic fallback
        );
        
        return in_array($key, $api_key_settings);
    }
    
    /**
     * Check if a value appears to be encrypted
     */
    private function is_encrypted_value($value) {
        if (empty($value) || !is_string($value)) {
            return false;
        }
        
        // Check if it's base64 encoded and has minimum length for encrypted data
        $decoded = base64_decode($value, true);
        if ($decoded === false || strlen($decoded) < 16) {
            return false;
        }
        
        // Additional check: encrypted values should have high entropy
        // Plain text API keys typically start with specific patterns
        if (preg_match('/^(sk-|pk-|key-|api-)/i', $value)) {
            return false;
        }
        
        return true;
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
                    providers_used, models_used, agent_id, created_at, updated_at
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
     * Set agent ID for a chat session
     */
    public function set_chat_session_agent($user_id, $session_id, $agent_id) {
        global $wpdb;

        return $wpdb->update(
            $this->chat_history_table,
            array('agent_id' => $agent_id),
            array('user_id' => $user_id, 'session_id' => $session_id),
            array('%d'),
            array('%d', '%s')
        );
    }

    /**
     * Set AI provider/model override for a chat session
     */
    public function set_chat_session_provider_override($user_id, $session_id, $provider, $model) {
        global $wpdb;

        return $wpdb->update(
            $this->chat_history_table,
            array(
                'override_provider' => $provider,
                'override_model' => $model
            ),
            array('user_id' => $user_id, 'session_id' => $session_id),
            array('%s', '%s'),
            array('%d', '%s')
        );
    }

    /**
     * Get AI provider/model override for a chat session
     */
    public function get_chat_session_provider_override($user_id, $session_id) {
        global $wpdb;

        return $wpdb->get_row($wpdb->prepare(
            "SELECT override_provider, override_model FROM {$this->chat_history_table}
             WHERE user_id = %d AND session_id = %s",
            $user_id,
            $session_id
        ), ARRAY_A);
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
            'google_api_key',
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
    
    /**
     * AI Agents Methods
     */
    
    /**
     * Create or update an AI agent
     */
    public function save_ai_agent($user_id, $agent_data, $agent_id = null) {
        global $wpdb;
        
        $data = array(
            'user_id' => $user_id,
            'name' => sanitize_text_field($agent_data['name']),
            'description' => sanitize_textarea_field($agent_data['description']),
            'system_message' => wp_kses_post($agent_data['system_message']),
            'tonality' => sanitize_text_field($agent_data['tonality']),
            'response_length' => sanitize_text_field($agent_data['response_length']),
            'temperature' => floatval($agent_data['temperature']),
            'max_tokens' => intval($agent_data['max_tokens']),
            'knowledge_base_ids' => is_array($agent_data['knowledge_base_ids']) ? implode(',', array_map('intval', $agent_data['knowledge_base_ids'])) : '',
            'is_active' => isset($agent_data['is_active']) ? intval($agent_data['is_active']) : 1
        );
        
        if ($agent_id) {
            // Update existing agent
            return $wpdb->update(
                $this->ai_agents_table,
                $data,
                array('id' => $agent_id, 'user_id' => $user_id),
                array('%d', '%s', '%s', '%s', '%s', '%s', '%f', '%d', '%s', '%d'),
                array('%d', '%d')
            );
        } else {
            // Create new agent
            return $wpdb->insert($this->ai_agents_table, $data, array('%d', '%s', '%s', '%s', '%s', '%s', '%f', '%d', '%s', '%d'));
        }
    }
    
    /**
     * Get AI agents for a user
     */
    public function get_ai_agents($user_id, $agent_id = null, $active_only = false) {
        global $wpdb;
        
        if ($agent_id) {
            // Get specific agent
            return $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$this->ai_agents_table} WHERE id = %d AND user_id = %d",
                $agent_id,
                $user_id
            ), ARRAY_A);
        } else {
            // Get all agents for user
            $where_clause = "WHERE user_id = %d";
            $params = array($user_id);
            
            if ($active_only) {
                $where_clause .= " AND is_active = 1";
            }
            
            return $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$this->ai_agents_table} {$where_clause} ORDER BY created_at DESC",
                ...$params
            ), ARRAY_A);
        }
    }
    
    /**
     * Delete an AI agent
     */
    public function delete_ai_agent($user_id, $agent_id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->ai_agents_table,
            array('id' => $agent_id, 'user_id' => $user_id),
            array('%d', '%d')
        );
    }
    
    /**
     * Knowledge Base Methods
     */
    
    /**
     * Create or update a knowledge base entry
     */
    public function save_knowledge_base_entry($user_id, $kb_data, $kb_id = null) {
        global $wpdb;
        
        $data = array(
            'user_id' => $user_id,
            'name' => sanitize_text_field($kb_data['name']),
            'description' => sanitize_textarea_field($kb_data['description']),
            'content' => wp_kses_post($kb_data['content']),
            'tags' => sanitize_text_field($kb_data['tags']),
            'category' => sanitize_text_field($kb_data['category']),
            'is_active' => isset($kb_data['is_active']) ? intval($kb_data['is_active']) : 1
        );
        
        // Add attached files if present
        if (isset($kb_data['attached_files'])) {
            $data['attached_files'] = sanitize_text_field($kb_data['attached_files']);
        }
        
        if ($kb_id) {
            // Update existing entry
            return $wpdb->update(
                $this->knowledge_base_table,
                $data,
                array('id' => $kb_id, 'user_id' => $user_id),
                array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d'),
                array('%d', '%d')
            );
        } else {
            // Create new entry
            return $wpdb->insert($this->knowledge_base_table, $data, array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d'));
        }
    }
    
    /**
     * Get knowledge base entries for a user
     */
    public function get_knowledge_base_entries($user_id, $kb_id = null, $active_only = false) {
        global $wpdb;
        
        if ($kb_id) {
            // Get specific entry
            return $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$this->knowledge_base_table} WHERE id = %d AND user_id = %d",
                $kb_id,
                $user_id
            ), ARRAY_A);
        } else {
            // Get all entries for user
            $where_clause = "WHERE user_id = %d";
            $params = array($user_id);
            
            if ($active_only) {
                $where_clause .= " AND is_active = 1";
            }
            
            return $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$this->knowledge_base_table} {$where_clause} ORDER BY created_at DESC",
                ...$params
            ), ARRAY_A);
        }
    }
    
    /**
     * Delete a knowledge base entry
     */
    public function delete_knowledge_base_entry($user_id, $kb_id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->knowledge_base_table,
            array('id' => $kb_id, 'user_id' => $user_id),
            array('%d', '%d')
        );
    }
    
    /**
     * Get knowledge base entries by IDs (for agent context)
     */
    public function get_knowledge_base_entries_by_ids($user_id, $kb_ids) {
        global $wpdb;
        
        if (empty($kb_ids) || !is_array($kb_ids)) {
            return array();
        }
        
        $placeholders = implode(',', array_fill(0, count($kb_ids), '%d'));
        $params = array_merge(array($user_id), $kb_ids);
        
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$this->knowledge_base_table} WHERE user_id = %d AND id IN ({$placeholders}) AND is_active = 1",
            ...$params
        ), ARRAY_A);
    }
    
    /**
     * Chatbots Methods
     */
    
    /**
     * Create or update a chatbot
     */
    public function save_chatbot($user_id, $chatbot_data, $chatbot_id = null) {
        global $wpdb;
        
        $data = array(
            'user_id' => $user_id,
            'name' => sanitize_text_field($chatbot_data['name']),
            'description' => sanitize_textarea_field($chatbot_data['description']),
            'agent_id' => intval($chatbot_data['agent_id']),
            'custom_header_name' => isset($chatbot_data['custom_header_name']) ? sanitize_text_field($chatbot_data['custom_header_name']) : null,
            'custom_header_logo' => isset($chatbot_data['custom_header_logo']) ? esc_url_raw($chatbot_data['custom_header_logo']) : null,
            'trigger_button_settings' => maybe_serialize($chatbot_data['trigger_button_settings']),
            'chatbot_styling' => maybe_serialize($chatbot_data['chatbot_styling']),
            'behavior_settings' => maybe_serialize($chatbot_data['behavior_settings']),
            'quick_messages' => maybe_serialize($chatbot_data['quick_messages']),
            'display_conditions' => maybe_serialize($chatbot_data['display_conditions']),
            'rate_limit_settings' => maybe_serialize($chatbot_data['rate_limit_settings']),
            'is_active' => isset($chatbot_data['is_active']) ? intval($chatbot_data['is_active']) : 1
        );
        
        if ($chatbot_id) {
            // Update existing chatbot
            return $wpdb->update(
                $this->chatbots_table,
                $data,
                array('id' => $chatbot_id, 'user_id' => $user_id),
                array('%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d'),
                array('%d', '%d')
            );
        } else {
            // Create new chatbot
            return $wpdb->insert($this->chatbots_table, $data, array('%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d'));
        }
    }
    
    /**
     * Get chatbots for a user
     */
    public function get_chatbots($user_id, $chatbot_id = null, $active_only = false) {
        global $wpdb;
        
        if ($chatbot_id) {
            // Get specific chatbot
            $result = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$this->chatbots_table} WHERE id = %d AND user_id = %d",
                $chatbot_id,
                $user_id
            ), ARRAY_A);
            
            if ($result) {
                // Unserialize JSON fields
                $result['trigger_button_settings'] = maybe_unserialize($result['trigger_button_settings']);
                $result['chatbot_styling'] = maybe_unserialize($result['chatbot_styling']);
                $result['behavior_settings'] = maybe_unserialize($result['behavior_settings']);
                $result['quick_messages'] = maybe_unserialize($result['quick_messages']);
                $result['display_conditions'] = maybe_unserialize($result['display_conditions']);
                $result['rate_limit_settings'] = maybe_unserialize($result['rate_limit_settings']);
            }
            
            return $result;
        } else {
            // Get all chatbots for user
            $where_clause = "WHERE user_id = %d";
            $params = array($user_id);
            
            if ($active_only) {
                $where_clause .= " AND is_active = 1";
            }
            
            $results = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$this->chatbots_table} {$where_clause} ORDER BY created_at DESC",
                ...$params
            ), ARRAY_A);
            
            // Unserialize JSON fields for all results
            foreach ($results as &$result) {
                $result['trigger_button_settings'] = maybe_unserialize($result['trigger_button_settings']);
                $result['chatbot_styling'] = maybe_unserialize($result['chatbot_styling']);
                $result['behavior_settings'] = maybe_unserialize($result['behavior_settings']);
                $result['quick_messages'] = maybe_unserialize($result['quick_messages']);
                $result['display_conditions'] = maybe_unserialize($result['display_conditions']);
                $result['rate_limit_settings'] = maybe_unserialize($result['rate_limit_settings']);
            }
            
            return $results;
        }
    }
    
    /**
     * Delete a chatbot
     */
    public function delete_chatbot($user_id, $chatbot_id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->chatbots_table,
            array('id' => $chatbot_id, 'user_id' => $user_id),
            array('%d', '%d')
        );
    }
    
    /**
     * Get active chatbots for public display (no user_id filter)
     */
    public function get_active_chatbots_for_display() {
        global $wpdb;
        
        $results = $wpdb->get_results(
            "SELECT c.*, a.name as agent_name, a.system_message as agent_system_message 
            FROM {$this->chatbots_table} c 
            LEFT JOIN {$this->ai_agents_table} a ON c.agent_id = a.id 
            WHERE c.is_active = 1 AND a.is_active = 1",
            ARRAY_A
        );
        
        // Unserialize JSON fields for all results
        foreach ($results as &$result) {
            $result['trigger_button_settings'] = maybe_unserialize($result['trigger_button_settings']);
            $result['chatbot_styling'] = maybe_unserialize($result['chatbot_styling']);
            $result['behavior_settings'] = maybe_unserialize($result['behavior_settings']);
            $result['quick_messages'] = maybe_unserialize($result['quick_messages']);
            $result['display_conditions'] = maybe_unserialize($result['display_conditions']);
            $result['rate_limit_settings'] = maybe_unserialize($result['rate_limit_settings']);
        }
        
        return $results;
    }
}
