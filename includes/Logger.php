<?php
/**
 * Custom Logger for MagicAssistant
 *
 * @package MagicAssistant
 */

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

class Logger {
    
    private static $instance = null;
    private $log_file_path;
    private $max_file_size = 10485760; // 10MB
    private $max_backup_files = 5;
    
    private function __construct() {
        $this->init_log_file();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Initialize the log file path and create directories if needed
     */
    private function init_log_file() {
        // Create logs directory in wp-content/uploads/magicassistant/
        $upload_dir = wp_upload_dir();
        $log_dir = $upload_dir['basedir'] . '/magicassistant/logs';
        
        // Create directory if it doesn't exist
        if (!file_exists($log_dir)) {
            wp_mkdir_p($log_dir);
        }
        
        // Set log file path
        $this->log_file_path = $log_dir . '/debug.log';
        
        // Create .htaccess to protect log files
        $this->create_htaccess_protection($log_dir);
        
        // Create index.php to prevent directory listing
        $this->create_index_protection($log_dir);
    }
    
    /**
     * Create .htaccess file to protect log directory
     */
    private function create_htaccess_protection($log_dir) {
        $htaccess_file = $log_dir . '/.htaccess';
        
        if (!file_exists($htaccess_file)) {
            $htaccess_content = "# MagicAssistant Log Protection\n";
            $htaccess_content .= "Order deny,allow\n";
            $htaccess_content .= "Deny from all\n";
            $htaccess_content .= "<Files *.log>\n";
            $htaccess_content .= "    Order deny,allow\n";
            $htaccess_content .= "    Deny from all\n";
            $htaccess_content .= "</Files>\n";
            
            file_put_contents($htaccess_file, $htaccess_content);
        }
    }
    
    /**
     * Create index.php to prevent directory listing
     */
    private function create_index_protection($log_dir) {
        $index_file = $log_dir . '/index.php';
        
        if (!file_exists($index_file)) {
            $index_content = "<?php\n// Silence is golden.\n";
            file_put_contents($index_file, $index_content);
        }
    }
    
    /**
     * Log a debug message
     */
    public function debug($message, $context = array()) {
        $this->log('DEBUG', $message, $context);
    }
    
    /**
     * Log an info message
     */
    public function info($message, $context = array()) {
        $this->log('INFO', $message, $context);
    }
    
    /**
     * Log a warning message
     */
    public function warning($message, $context = array()) {
        $this->log('WARNING', $message, $context);
    }
    
    /**
     * Log an error message
     */
    public function error($message, $context = array()) {
        $this->log('ERROR', $message, $context);
    }
    
    /**
     * Main logging method
     */
    private function log($level, $message, $context = array()) {
        // Check if file needs rotation
        $this->rotate_log_if_needed();
        
        // Format the log entry
        $timestamp = current_time('Y-m-d H:i:s');
        $user_id = get_current_user_id();
        $memory_usage = round(memory_get_usage() / 1024 / 1024, 2);
        
        $log_entry = sprintf(
            "[%s] [%s] [User:%d] [Memory:%sMB] %s",
            $timestamp,
            $level,
            $user_id,
            $memory_usage,
            $message
        );
        
        // Add context if provided
        if (!empty($context)) {
            $log_entry .= "\nContext: " . $this->format_context($context);
        }
        
        $log_entry .= "\n" . str_repeat('-', 100) . "\n";
        
        // Write to log file
        $this->write_to_file($log_entry);
    }
    
    /**
     * Format context data for logging
     */
    private function format_context($context) {
        if (is_array($context) || is_object($context)) {
            return json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        return (string) $context;
    }
    
    /**
     * Write log entry to file
     */
    private function write_to_file($log_entry) {
        // Use file locking to prevent corruption in high-traffic scenarios
        $result = file_put_contents(
            $this->log_file_path, 
            $log_entry, 
            FILE_APPEND | LOCK_EX
        );
        
        if ($result === false) {
            // Fallback to WordPress error log if our custom logging fails
            error_log('[MagicAssistant Logger] Failed to write to custom log file: ' . $this->log_file_path);
        }
    }
    
    /**
     * Rotate log file if it exceeds maximum size
     */
    private function rotate_log_if_needed() {
        if (!file_exists($this->log_file_path)) {
            return;
        }
        
        $file_size = filesize($this->log_file_path);
        
        if ($file_size >= $this->max_file_size) {
            $this->rotate_log_files();
        }
    }
    
    /**
     * Rotate log files (keep backups)
     */
    private function rotate_log_files() {
        $log_dir = dirname($this->log_file_path);
        $base_name = 'debug';
        
        // Remove oldest backup if we have too many
        $oldest_backup = $log_dir . '/' . $base_name . '.' . $this->max_backup_files . '.log';
        if (file_exists($oldest_backup)) {
            unlink($oldest_backup);
        }
        
        // Rotate existing backups
        for ($i = $this->max_backup_files - 1; $i >= 1; $i--) {
            $old_file = $log_dir . '/' . $base_name . '.' . $i . '.log';
            $new_file = $log_dir . '/' . $base_name . '.' . ($i + 1) . '.log';
            
            if (file_exists($old_file)) {
                rename($old_file, $new_file);
            }
        }
        
        // Move current log to .1 backup
        $first_backup = $log_dir . '/' . $base_name . '.1.log';
        if (file_exists($this->log_file_path)) {
            rename($this->log_file_path, $first_backup);
        }
    }
    
    /**
     * Clear all log files
     */
    public function clear_logs() {
        $log_dir = dirname($this->log_file_path);
        $base_name = 'debug';
        
        // Remove main log file
        if (file_exists($this->log_file_path)) {
            unlink($this->log_file_path);
        }
        
        // Remove backup files
        for ($i = 1; $i <= $this->max_backup_files; $i++) {
            $backup_file = $log_dir . '/' . $base_name . '.' . $i . '.log';
            if (file_exists($backup_file)) {
                unlink($backup_file);
            }
        }
    }
    
    /**
     * Get log file path
     */
    public function get_log_file_path() {
        return $this->log_file_path;
    }
    
    /**
     * Get log files info (main + backups)
     */
    public function get_log_files_info() {
        $files = array();
        $log_dir = dirname($this->log_file_path);
        $base_name = 'debug';
        
        // Main log file
        if (file_exists($this->log_file_path)) {
            $files[] = array(
                'file' => 'debug.log',
                'path' => $this->log_file_path,
                'size' => filesize($this->log_file_path),
                'modified' => filemtime($this->log_file_path),
                'is_main' => true
            );
        }
        
        // Backup files
        for ($i = 1; $i <= $this->max_backup_files; $i++) {
            $backup_file = $log_dir . '/' . $base_name . '.' . $i . '.log';
            if (file_exists($backup_file)) {
                $files[] = array(
                    'file' => $base_name . '.' . $i . '.log',
                    'path' => $backup_file,
                    'size' => filesize($backup_file),
                    'modified' => filemtime($backup_file),
                    'is_main' => false
                );
            }
        }
        
        return $files;
    }
    
    /**
     * Get recent log entries
     */
    public function get_recent_entries($limit = 100) {
        if (!file_exists($this->log_file_path)) {
            return array();
        }
        
        $lines = file($this->log_file_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        if ($lines === false) {
            return array();
        }
        
        // Get last N lines
        $recent_lines = array_slice($lines, -$limit);
        
        return array_reverse($recent_lines);
    }
    
    /**
     * Check if logging is enabled
     */
    public function is_logging_enabled() {
        // Check if database is available and get setting
        if (function_exists('MATDB') && MATDB()) {
            $settings = MATDB()->get_all_settings();
            return !empty($settings['debug_log_raw_responses']);
        }
        
        return false;
    }
    
    /**
     * Log API request details
     */
    public function log_api_request($provider, $payload, $response = null, $error = null) {
        if (!$this->is_logging_enabled()) {
            return;
        }
        
        $context = array(
            'provider' => $provider,
            'request_payload' => $payload,
        );
        
        if ($response !== null) {
            $context['response'] = $response;
        }
        
        if ($error !== null) {
            $context['error'] = $error;
            $this->error("API request failed for {$provider}", $context);
        } else {
            $this->debug("API request to {$provider}", $context);
        }
    }
    
    /**
     * Log user request details
     */
    public function log_user_request($request_data) {
        if (!$this->is_logging_enabled()) {
            return;
        }
        
        $this->debug('User chat request', $request_data);
    }
} 