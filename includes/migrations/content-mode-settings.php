<?php
/**
 * Content Mode Settings Migration
 * 
 * Adds database support for Content Mode specific settings and templates
 */

namespace MagicAssistant\Migrations;

class ContentModeSettings {
    
    public static function up($db) {
        global $wpdb;
        
        // Add content mode settings to the settings table
        $default_settings = array(
            'content_mode_enabled' => true,
            'content_mode_default_type' => 'blog_post',
            'content_mode_auto_seo' => true,
            'content_mode_default_length' => 'medium',
            'content_mode_link_strategy' => 'moderate',
            'content_mode_auto_featured_image' => true,
            'content_mode_include_site_context' => true,
            'content_mode_templates' => json_encode(array()),
            'content_mode_saved_prompts' => json_encode(array()),
            'content_mode_bulk_limit' => 10
        );
        
        foreach ($default_settings as $key => $value) {
            if (!$db->setting_exists($key)) {
                $db->save_setting($key, $value);
            }
        }
        
        // Create content templates table if it doesn't exist
        $table_name = $wpdb->prefix . 'mat_content_templates';
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            template_name varchar(255) NOT NULL,
            template_type varchar(100) NOT NULL,
            system_message longtext,
            template_structure longtext,
            seo_settings longtext,
            is_default tinyint(1) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_template_type (template_type)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        
        // Create content generation history table
        $history_table = $wpdb->prefix . 'mat_content_history';
        
        $sql = "CREATE TABLE IF NOT EXISTS {$history_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            session_id varchar(100),
            content_type varchar(100),
            prompt longtext,
            generated_content longtext,
            target_keywords text,
            seo_score int(11) DEFAULT 0,
            word_count int(11) DEFAULT 0,
            status varchar(50) DEFAULT 'draft',
            post_id bigint(20) unsigned DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_session (user_id, session_id),
            KEY idx_created_at (created_at),
            KEY idx_post_id (post_id)
        ) $charset_collate;";
        
        dbDelta($sql);
        
        return true;
    }
    
    public static function down($db) {
        global $wpdb;
        
        // Remove content mode settings
        $settings_to_remove = array(
            'content_mode_enabled',
            'content_mode_default_type',
            'content_mode_auto_seo',
            'content_mode_default_length',
            'content_mode_link_strategy',
            'content_mode_auto_featured_image',
            'content_mode_include_site_context',
            'content_mode_templates',
            'content_mode_saved_prompts',
            'content_mode_bulk_limit'
        );
        
        foreach ($settings_to_remove as $key) {
            $db->delete_setting($key);
        }
        
        // Optionally drop tables (commented out for safety)
        // $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}mat_content_templates");
        // $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}mat_content_history");
        
        return true;
    }
}