<?php
/**
 * MagicAssistant Debug API - Fallback API for when WordPress is not loaded
 * 
 * This file provides basic debug functionality when WordPress has fatal errors
 * and cannot load normally. It handles log parsing and basic operations.
 * 
 * @package MagicAssistant
 */

// Start session for authentication
if (!session_id()) {
    session_start();
}

// Check authentication
if (!isset($_SESSION['mat_debug_authenticated']) || $_SESSION['mat_debug_authenticated'] !== true) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(array('success' => false, 'message' => 'Authentication required'));
    exit;
}

// Set content type
header('Content-Type: application/json');

// Get action
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'get_logs':
        handle_get_logs();
        break;
    case 'get_file_content':
        handle_get_file_content();
        break;
    case 'ai_chat':
        handle_ai_chat();
        break;
    case 'debug_license':
        handle_debug_license();
        break;
    case 'save_file_content':
        handle_save_file_content();
        break;
    default:
        http_response_code(400);
        echo json_encode(array('success' => false, 'message' => 'Invalid action'));
        break;
}

function handle_get_logs() {
    $search = sanitize_text($_GET['search'] ?? '');
    $level = sanitize_text($_GET['level'] ?? '');
    $page = max(1, intval($_GET['page'] ?? 1));
    $per_page = max(1, intval($_GET['per_page'] ?? 100));
    
    try {
        $all_logs = parse_all_log_files(0, $search, $level);
        $total_count = count($all_logs);
        $offset = ($page - 1) * $per_page;
        $logs = array_slice($all_logs, $offset, $per_page);
        $has_more = ($offset + $per_page) < $total_count;
        
        echo json_encode(array(
            'success' => true,
            'data' => array(
                'logs' => $logs,
                'total_count' => $total_count,
                'has_more' => $has_more,
                'page' => $page,
                'per_page' => $per_page
            )
        ));
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(array(
            'success' => false,
            'message' => 'Failed to parse logs: ' . $e->getMessage()
        ));
    }
}

function handle_get_file_content() {
    $file_path = sanitize_text($_GET['file_path'] ?? '');
    // Decode URL-encoded spaces and other characters
    $file_path = rawurldecode($file_path);
    $line_number = intval($_GET['line_number'] ?? 1);
    $context_lines = intval($_GET['context_lines'] ?? 20);
    
    if (empty($file_path)) {
        http_response_code(400);
        echo json_encode(array('success' => false, 'message' => 'File path is required'));
        return;
    }
    
    // Security check - only allow files within likely WordPress installation
    $real_file_path = realpath($file_path);
    $wp_root = realpath(get_wp_root());
    
    if (!$real_file_path || strpos($real_file_path, $wp_root) !== 0) {
        http_response_code(403);
        echo json_encode(array('success' => false, 'message' => 'Invalid file path'));
        return;
    }
    
    if (!file_exists($real_file_path)) {
        http_response_code(404);
        echo json_encode(array('success' => false, 'message' => 'File not found'));
        return;
    }
    
    try {
        $file_content = file($real_file_path);
        $total_lines = count($file_content);
        
        $start_line = max(1, $line_number - $context_lines);
        $end_line = min($total_lines, $line_number + $context_lines);
        
        $context_content = array();
        for ($i = $start_line; $i <= $end_line; $i++) {
            $context_content[] = array(
                'line_number' => $i,
                'content' => rtrim($file_content[$i - 1]),
                'is_error_line' => $i === $line_number
            );
        }
        
        echo json_encode(array(
            'success' => true,
            'data' => array(
                'file_path' => $file_path,
                'error_line' => $line_number,
                'context_content' => $context_content,
                'total_lines' => $total_lines
            )
        ));
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(array(
            'success' => false,
            'message' => 'Failed to read file: ' . $e->getMessage()
        ));
    }
}

function handle_ai_chat() {
    // Accept POST only
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(array('success' => false, 'message' => 'Method not allowed'));
        exit;
    }
    
    // First, test connectivity to the proxy
    $connectivity_test = test_proxy_connectivity();

    $input = json_decode(file_get_contents('php://input'), true);
    $message = $input['message'] ?? '';
    $provider = $input['provider'] ?? 'openai';
    // Prefer user-provided API key from DB, fallback to env var
    $api_key = get_stored_api_key($provider);
    if (!$api_key) {
        $api_key = getenv('MAGICASSISTANT_AI_KEY');
    }
    if (!$api_key) {
        // Fallback: hardcoded key (replace with your real key or leave blank for proxy to use site quota)
        $api_key = '';
    }
    
    // Check if we should try direct API call as fallback (if user has provided their own API key)
    $use_direct_api = !empty($api_key) && (getenv('MAGICASSISTANT_USE_DIRECT_API') === 'true');
    if (empty($message)) {
        http_response_code(400);
        echo json_encode(array('success' => false, 'message' => 'Message is required'));
        exit;
    }
    // Prepare request for proxy
    $proxy_url = $provider === 'anthropic'
        ? 'https://proxy.magicplugins.io/api/proxy/anthropic'
        : 'https://proxy.magicplugins.io/api/proxy/openai';
    $request_data = array(
        'action' => $provider,
        'data' => array(
            'model' => $provider === 'anthropic' ? 'claude-sonnet-4-20240229' : 'gpt-4.1-mini',
            'messages' => array(
                array('role' => 'user', 'content' => $message)
            ),
            'temperature' => 0.7,
            'max_tokens' => 800
        ),
        'site_url' => (isset($_SERVER['HTTP_HOST']) ? 'https://' . $_SERVER['HTTP_HOST'] : ''),
        'timestamp' => time(),
    );
    $headers = array('Content-Type: application/json');
    if (!empty($api_key)) {
        $headers[] = 'X-User-Api-Key: ' . $api_key;
    }
    
    // Add debug API identifier header
    $headers[] = 'X-Debug-Api: true';
    
    // Try to get license headers from database for authentication with proxy
    try {
        $license_headers = get_license_headers_for_debug();
        if (!empty($license_headers)) {
            foreach ($license_headers as $key => $value) {
                $headers[] = $key . ': ' . $value;
            }
        } else {
            // Fallback: Try to use a hardcoded license key for debugging
            $fallback_license_key = getenv('MAGICASSISTANT_LICENSE_KEY');
            if (!empty($fallback_license_key)) {
                $headers[] = 'X-License-Key: ' . $fallback_license_key;
                $headers[] = 'X-License-Status: active';
            }
        }
    } catch (Exception $e) {
        // Continue without license headers if database access fails
        // Fallback: Try to use a hardcoded license key for debugging
        $fallback_license_key = getenv('MAGICASSISTANT_LICENSE_KEY');
        if (!empty($fallback_license_key)) {
            $headers[] = 'X-License-Key: ' . $fallback_license_key;
            $headers[] = 'X-License-Status: active';
        }
    }
    // Use cURL for the request with extended timeout and detailed logging
    $ch = curl_init($proxy_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($request_data));
    curl_setopt($ch, CURLOPT_TIMEOUT, 120); // Increased timeout to 2 minutes
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 60); // Connection timeout
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For debugging - remove in production
    curl_setopt($ch, CURLOPT_VERBOSE, true); // Enable verbose output for debugging
    
    // Log the request details
    $start_time = microtime(true);
    $response = curl_exec($ch);
    $end_time = microtime(true);
    $request_duration = round($end_time - $start_time, 2);
    
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_info = curl_getinfo($ch);
    curl_close($ch);
    
    
    if ($response === false) {
        // Check if it was a timeout
        if (strpos($curl_error, 'timeout') !== false || strpos($curl_error, 'timed out') !== false) {
            http_response_code(504);
            echo json_encode(array(
                'success' => false, 
                'message' => 'Request timed out after ' . $request_duration . ' seconds. The AI service may be temporarily overloaded. Please try again.',
                'error_type' => 'timeout',
                'duration' => $request_duration
            ));
        } else {
            http_response_code(500);
            echo json_encode(array(
                'success' => false, 
                'message' => 'AI proxy request failed: ' . $curl_error,
                'error_type' => 'network',
                'duration' => $request_duration
            ));
        }
        exit;
    }
    $data = json_decode($response, true);
    
    if ($http_code !== 200 || empty($data['success'])) {
        // Extract more detailed error information
        $error_message = 'Unknown error';
        $error_details = array();
        
        if ($data) {
            $error_message = $data['error'] ?? ($data['message'] ?? 'Unknown error');
            
            // Include additional error context if available
            if (isset($data['creditLimitInfo'])) {
                $error_details['credit_limit'] = $data['creditLimitInfo'];
            }
            if (isset($data['rateLimitInfo'])) {
                $error_details['rate_limit'] = $data['rateLimitInfo'];
            }
            if (isset($data['reason'])) {
                $error_details['reason'] = $data['reason'];
            }
        } else {
            // If JSON decode failed, show raw response
            $error_message = 'Invalid response from proxy: ' . substr($response, 0, 200);
        }
        
        // Provide specific guidance based on error type
        if ($http_code === 504) {
            $error_message = 'Gateway timeout: The proxy server timed out while contacting OpenAI. This usually means OpenAI is experiencing high load. ' . $error_message;
        } elseif ($http_code === 502) {
            $error_message = 'Bad gateway: The proxy server cannot reach OpenAI. ' . $error_message;
        } elseif ($http_code === 503) {
            $error_message = 'Service unavailable: The proxy server is temporarily overloaded. ' . $error_message;
        }
        
        http_response_code($http_code === 200 ? 500 : $http_code);
        echo json_encode(array(
            'success' => false, 
            'message' => 'AI proxy error: ' . $error_message,
            'http_code' => $http_code,
            'response_length' => strlen($response),
            'duration' => $request_duration,
            'error_details' => $error_details
        ));
        exit;
    }
    // Extract response content
    $result = $data['data'] ?? array();
    $content = '';
    if ($provider === 'openai') {
        $content = $result['choices'][0]['message']['content'] ?? '';
    } elseif ($provider === 'anthropic') {
        $content = $result['content'] ?? '';
    }
    echo json_encode(array('success' => true, 'response' => $content));
    exit;
}

function handle_debug_license() {
    try {
        $debug_info = array();
        
        // Check if wp-config.php can be found
        try {
            $wp_root = get_wp_root();
            $debug_info['wp_root'] = $wp_root;
            $debug_info['wp_config_exists'] = file_exists($wp_root . '/wp-config.php');
        } catch (Exception $e) {
            $debug_info['wp_root_error'] = $e->getMessage();
        }
        
        // Check database configuration
        try {
            $db_config = get_wp_db_config();
            $debug_info['db_config'] = array(
                'host' => $db_config['host'],
                'name' => $db_config['name'],
                'user' => $db_config['user'],
                'prefix' => $db_config['prefix'],
                'has_salts' => !empty($db_config['salts'])
            );
        } catch (Exception $e) {
            $debug_info['db_config_error'] = $e->getMessage();
        }
        
        // Check database connection
        try {
            $db = get_debug_db_connection();
            $debug_info['db_connection'] = 'success';
            
            // Check if settings table exists
            $config = get_wp_db_config();
            $table_name = $config['prefix'] . 'mat_settings';
            $stmt = $db->prepare("SHOW TABLES LIKE ?");
            $stmt->execute(array($table_name));
            $debug_info['settings_table_exists'] = (bool)$stmt->fetch();
            
            if ($debug_info['settings_table_exists']) {
                // Check if license key exists
                $stmt = $db->prepare("SELECT setting_key, LENGTH(setting_value) as value_length FROM {$table_name} WHERE setting_key LIKE '%license%'");
                $stmt->execute();
                $license_settings = $stmt->fetchAll();
                $debug_info['license_settings'] = $license_settings;
            }
            
        } catch (Exception $e) {
            $debug_info['db_connection_error'] = $e->getMessage();
        }
        
        // Check license key retrieval
        try {
            $license_key = get_stored_license_key();
            $debug_info['license_key_retrieved'] = !empty($license_key);
            $debug_info['license_key_length'] = strlen($license_key);
        } catch (Exception $e) {
            $debug_info['license_key_error'] = $e->getMessage();
        }
        
        // Check environment variables
        $debug_info['env_license_key'] = !empty(getenv('MAGICASSISTANT_LICENSE_KEY'));
        $debug_info['env_ai_key'] = !empty(getenv('MAGICASSISTANT_AI_KEY'));
        $debug_info['env_use_direct_api'] = getenv('MAGICASSISTANT_USE_DIRECT_API') === 'true';
        
        // Test proxy connectivity
        $debug_info['proxy_connectivity'] = test_proxy_connectivity();
        
        // Check final headers that would be sent
        try {
            $headers = get_license_headers_for_debug();
            $debug_info['final_headers'] = array_keys($headers);
            $debug_info['has_license_header'] = isset($headers['X-License-Key']);
        } catch (Exception $e) {
            $debug_info['headers_error'] = $e->getMessage();
        }
        
        echo json_encode(array(
            'success' => true,
            'debug_info' => $debug_info
        ));
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(array(
            'success' => false,
            'message' => 'Debug license failed: ' . $e->getMessage()
        ));
    }
}

function parse_all_log_files($limit = 0, $search = '', $level = '') {
    $logs = array();
    
    // Try to find WordPress content directory
    $wp_content_dir = get_wp_content_dir();
    
    // Parse WordPress debug.log
    $wp_debug_log = $wp_content_dir . '/debug.log';
    if (file_exists($wp_debug_log)) {
        $wp_logs = parse_log_file($wp_debug_log, 'WordPress Debug', $search, $level);
        $logs = array_merge($logs, $wp_logs);
    }

    // Parse PHP error log
    $php_error_log = ini_get('error_log');
    if ($php_error_log && file_exists($php_error_log) && $php_error_log !== $wp_debug_log) {
        $php_logs = parse_log_file($php_error_log, 'PHP Error Log', $search, $level);
        $logs = array_merge($logs, $php_logs);
    }

    // Parse MagicAssistant custom plugin log
    $custom_log = $wp_content_dir . '/uploads/magicassistant/logs/debug.log';
    if (file_exists($custom_log)) {
        $custom_logs = parse_log_file($custom_log, 'MagicAssistant Plugin Log', $search, $level);
        $logs = array_merge($logs, $custom_logs);
    }

    // Sort by timestamp descending (newest first)
    usort($logs, function($a, $b) {
        return $b['timestamp'] <=> $a['timestamp'];
    });

    // Remove limit: return all logs
    return $logs;
}

function parse_log_file($file_path, $source, $search = '', $level = '') {
    $logs = array();
    
    if (!file_exists($file_path)) {
        return $logs;
    }
    
    $file_content = file_get_contents($file_path);
    if ($file_content === false) {
        return $logs;
    }
    
    $lines = explode("\n", $file_content);
    $current_entry = null;
    
    foreach ($lines as $line_number => $line) {
        $line = trim($line);
        if (empty($line)) continue;
        
        // Check if this line starts a new log entry
        if (preg_match('/^\[(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2})\s+([A-Za-z]+)\](.*)/', $line, $matches)) {
            // Save previous entry if exists
            if ($current_entry) {
                if (matches_filters($current_entry, $search, $level)) {
                    $logs[] = $current_entry;
                }
            }
            
            $timestamp = strtotime($matches[1]);
            $raw_level = trim($matches[2]);
            $log_level = normalize_log_level($raw_level, $line);
            $message = trim($matches[3]);
            
            $current_entry = array(
                'id' => uniqid(),
                'timestamp' => $timestamp,
                'formatted_time' => date('Y-m-d H:i:s', $timestamp),
                'level' => $log_level,
                'message' => $message,
                'full_message' => $line,
                'source' => $source,
                'file_path' => extract_file_path($message),
                'line_number' => extract_line_number($message),
                'stack_trace' => array()
            );
        } elseif ($current_entry && !empty($line)) {
            // This is a continuation of the previous entry (stack trace, etc.)
            $current_entry['full_message'] .= "\n" . $line;
            if (strpos($line, 'Stack trace:') !== false || preg_match('/^#\d+/', $line)) {
                $current_entry['stack_trace'][] = $line;
            }
        }
    }
    
    // Don't forget the last entry
    if ($current_entry) {
        populate_file_info_from_stack($current_entry);
        if (matches_filters($current_entry, $search, $level)) {
            $logs[] = $current_entry;
        }
    }
    
    return $logs;
}

function normalize_log_level($raw_level, $line = '') {
    // Normalize common log levels
    $level = strtoupper($raw_level);
    // Remove timezone tokens (e.g., UTC, GMT, etc.)
    $level = preg_replace('/^(UTC|GMT|CET|PST|EST|EDT|CDT|MDT|PDT)$/i', '', $level);
    $level = trim($level);
    // Map to canonical levels
    $map = [
        'FATAL' => 'Fatal',
        'ERROR' => 'Error',
        'PARSE' => 'Parse',
        'WARNING' => 'Warning',
        'WARN' => 'Warning',
        'NOTICE' => 'Notice',
        'INFO' => 'Notice', // treat info as notice for debug
        'DEBUG' => 'Notice', // treat debug as notice for debug
    ];
    if (isset($map[$level])) {
        return $map[$level];
    }
    // Try to detect in message if not in level
    if ($line) {
        if (stripos($line, 'fatal') !== false) return 'Fatal';
        if (stripos($line, 'parse') !== false) return 'Parse';
        if (stripos($line, 'error') !== false) return 'Error';
        if (stripos($line, 'warning') !== false) return 'Warning';
        if (stripos($line, 'notice') !== false) return 'Notice';
    }
    return $level ?: 'Notice';
}

/**
 * Try to extract a file path from an error/stack-trace line.
 * Handles formats like:
 *   in /path/to/file.php on line 45
 *   /path/to/file.php:45
 *   /path/to/file.php(45):
 */
function extract_file_path($message) {
    // Pattern 1 – "in /path/file.php on line X" (allow spaces and %20)
    if (preg_match('/in\s+([^\n]+?\.php)/', $message, $matches)) {
        return $matches[1];
    }

    // Pattern 2 – "/path/file.php:123"  or "...php(123):" (allow spaces)
    if (preg_match('/([^\n]+?\.php)(?:[:\(])/', $message, $matches)) {
        return $matches[1];
    }

    return '';
}

function extract_line_number($message) {
    // Pattern 1 – "on line 45"
    if (preg_match('/on line (\d+)/', $message, $matches)) {
        return intval($matches[1]);
    }

    // Pattern 2 – suffix            ":123" or "(123):"
    if (preg_match('/\.php[:\(](\d+)/', $message, $matches)) {
        return intval($matches[1]);
    }

    return 0;
}

/**
 * Attempt to fill missing file info from stack trace lines.
 */
function populate_file_info_from_stack(&$entry) {
    if (!empty($entry['file_path'])) {
        return; // already have info
    }
    if (empty($entry['stack_trace'])) {
        return;
    }
    foreach ($entry['stack_trace'] as $trace_line) {
        $file = extract_file_path($trace_line);
        $line = extract_line_number($trace_line);
        if ($file) {
            $entry['file_path'] = $file;
            $entry['line_number'] = $line;
            return;
        }
    }
}

function matches_filters($entry, $search, $level) {
    // Level filter
    if (!empty($level) && strcasecmp($entry['level'], $level) !== 0) {
        return false;
    }
    
    // Search filter
    if (!empty($search)) {
        $search_lower = strtolower($search);
        if (strpos(strtolower($entry['full_message']), $search_lower) === false &&
            strpos(strtolower($entry['file_path']), $search_lower) === false) {
            return false;
        }
    }
    
    return true;
}

function get_wp_root() {
    // Try to find WordPress root directory
    $current_dir = dirname(__FILE__);
    $attempts = 0;
    $max_attempts = 5;
    
    while ($attempts < $max_attempts) {
        if (file_exists($current_dir . '/wp-config.php') || file_exists($current_dir . '/wp-load.php')) {
            return $current_dir;
        }
        $current_dir = dirname($current_dir);
        $attempts++;
    }
    
    // Fallback
    return dirname(dirname(dirname(__FILE__)));
}

function get_wp_content_dir() {
    $wp_root = get_wp_root();
    return $wp_root . '/wp-content';
}

/**
 * Test connectivity to the proxy server
 */
function test_proxy_connectivity() {
    $test_url = 'https://proxy.magicplugins.io/api/proxy/status';
    
    $ch = curl_init($test_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_NOBODY, true); // HEAD request only
    
    $start_time = microtime(true);
    curl_exec($ch);
    $end_time = microtime(true);
    
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    $response_time = round($end_time - $start_time, 2);
    
    if (!empty($curl_error)) {
        return array(
            'success' => false,
            'error' => $curl_error,
            'response_time' => $response_time
        );
    }
    
    if ($http_code >= 200 && $http_code < 400) {
        return array(
            'success' => true,
            'http_code' => $http_code,
            'response_time' => $response_time
        );
    }
    
    return array(
        'success' => false,
        'error' => 'HTTP ' . $http_code,
        'response_time' => $response_time
    );
}

function sanitize_text($text) {
    return htmlspecialchars(strip_tags(trim($text)), ENT_QUOTES, 'UTF-8');
}

/**
 * Get WordPress database configuration
 */
function get_wp_db_config() {
    // Try to find wp-config.php
    $wp_root = get_wp_root();
    $config_path = $wp_root . '/wp-config.php';
    
    if (!file_exists($config_path)) {
        // Try one level up (common WordPress installation pattern)
        $config_path = dirname($wp_root) . '/wp-config.php';
        if (!file_exists($config_path)) {
            throw new Exception('wp-config.php not found');
        }
    }
    
    // Read wp-config.php to extract database constants
    $config_content = file_get_contents($config_path);
    
    $db_config = array();
    
    // Extract database constants using regex
    if (preg_match("/define\s*\(\s*['\"]DB_NAME['\"]\s*,\s*['\"](.*?)['\"]\s*\)/", $config_content, $matches)) {
        $db_config['name'] = $matches[1];
    }
    if (preg_match("/define\s*\(\s*['\"]DB_USER['\"]\s*,\s*['\"](.*?)['\"]\s*\)/", $config_content, $matches)) {
        $db_config['user'] = $matches[1];
    }
    if (preg_match("/define\s*\(\s*['\"]DB_PASSWORD['\"]\s*,\s*['\"](.*?)['\"]\s*\)/", $config_content, $matches)) {
        $db_config['password'] = $matches[1];
    }
    if (preg_match("/define\s*\(\s*['\"]DB_HOST['\"]\s*,\s*['\"](.*?)['\"]\s*\)/", $config_content, $matches)) {
        $db_config['host'] = $matches[1];
    }
    
    // Extract table prefix
    if (preg_match('/\$table_prefix\s*=\s*[\'\"](.*?)[\'\"]\s*;/', $config_content, $matches)) {
        $db_config['prefix'] = $matches[1];
    } else {
        $db_config['prefix'] = 'wp_'; // Default prefix
    }
    
    // Extract WordPress salts for encryption
    $salts = array();
    $salt_keys = array('AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT');
    foreach ($salt_keys as $salt_key) {
        if (preg_match("/define\s*\(\s*['\"]{$salt_key}['\"]\s*,\s*['\"](.*?)['\"]\s*\)/", $config_content, $matches)) {
            $salts[$salt_key] = $matches[1];
        }
    }
    $db_config['salts'] = $salts;
    
    return $db_config;
}

/**
 * Get a database connection without WordPress
 */
function get_debug_db_connection() {
    static $connection = null;
    
    if ($connection !== null) {
        return $connection;
    }
    
    $config = get_wp_db_config();
    
    if (empty($config['name']) || empty($config['user']) || empty($config['host'])) {
        throw new Exception('Invalid database configuration');
    }
    
    try {
        $connection = new PDO(
            "mysql:host={$config['host']};dbname={$config['name']};charset=utf8mb4",
            $config['user'],
            $config['password'] ?? '',
            array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            )
        );
        
        return $connection;
    } catch (PDOException $e) {
        throw new Exception('Database connection failed: ' . $e->getMessage());
    }
}

/**
 * Decrypt an API key using the same method as the main plugin
 */
function decrypt_license_key($encrypted_key, $salts) {
    if (empty($encrypted_key)) {
        return '';
    }
    
    // Use WordPress salts for encryption key (same as main plugin)
    $auth_salt = isset($salts['AUTH_SALT']) ? $salts['AUTH_SALT'] : 'mat_default_salt';
    $secure_auth_salt = isset($salts['SECURE_AUTH_SALT']) ? $salts['SECURE_AUTH_SALT'] : 'mat_secure_salt';
    $key = hash('sha256', $auth_salt . $secure_auth_salt);
    
    // Decode the base64 data
    $data = base64_decode($encrypted_key);
    
    if ($data === false || strlen($data) < 16) {
        return '';
    }
    
    // Extract IV and encrypted data
    $iv = substr($data, 0, 16);
    $encrypted = substr($data, 16);
    
    // Decrypt the key
    $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, 0, $iv);
    
    return $decrypted !== false ? $decrypted : '';
}

/**
 * Get stored license key from database
 */
function get_stored_license_key() {
    try {
        $db = get_debug_db_connection();
        $config = get_wp_db_config();
        
        $table_name = $config['prefix'] . 'mat_settings';
        
        // Check if the table exists
        $stmt = $db->prepare("SHOW TABLES LIKE ?");
        $stmt->execute(array($table_name));
        if (!$stmt->fetch()) {
            return '';
        }
        
        // Get the encrypted license key
        $stmt = $db->prepare("SELECT setting_value FROM {$table_name} WHERE setting_key = ? AND user_id IS NULL");
        $stmt->execute(array('surecart_license_key'));
        $result = $stmt->fetch();
        
        if (!$result || empty($result['setting_value'])) {
            return '';
        }
        
        $encrypted_key = $result['setting_value'];
        
        // Handle WordPress serialization
        if (strpos($encrypted_key, ':') !== false && preg_match('/^s:\d+:".*";$/', $encrypted_key)) {
            $encrypted_key = unserialize($encrypted_key);
        }
        
        if (empty($encrypted_key)) {
            return '';
        }
        
        // Decrypt the license key
        $decrypted_key = decrypt_license_key($encrypted_key, $config['salts']);
        
        if (empty($decrypted_key)) {
            return '';
        }
        
        return $decrypted_key;
        
    } catch (Exception $e) {
        return '';
    }
}

/**
 * Get all license headers for debug requests (similar to main plugin)
 */
function get_license_headers_for_debug() {
    $headers = array();
    
    // Try to get the license key
    $license_key = get_stored_license_key();
    
    if (!empty($license_key)) {
        $headers['X-License-Key'] = $license_key;
        $headers['X-License-Status'] = 'active'; // Assume active if we have a key stored
        
        // Try to get site URL from request or construct it
        $site_url = '';
        if (isset($_SERVER['HTTP_HOST'])) {
            $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://';
            $site_url = $protocol . $_SERVER['HTTP_HOST'];
        }
        
        if (!empty($site_url)) {
            $headers['X-Site-Url'] = $site_url;
        }
        
        // We can't easily get license ID, tier, and expiry without WordPress/SureCart client
        // But the essential headers should be sufficient for basic authentication
    }
    
    return $headers;
}

/**
 * Check if file editing is enabled in debug view settings
 */
function is_file_editing_enabled() {
    try {
        $db = get_debug_db_connection();
        $config = get_wp_db_config();
        
        $table_name = $config['prefix'] . 'mat_settings';
        
        // Check if the table exists
        $stmt = $db->prepare("SHOW TABLES LIKE ?");
        $stmt->execute(array($table_name));
        if (!$stmt->fetch()) {
            return false; // Default to disabled for security
        }
        
        // Get the file editing setting
        $stmt = $db->prepare("SELECT setting_value FROM {$table_name} WHERE setting_key = ? AND user_id IS NULL");
        $stmt->execute(array('debug_view_file_editing'));
        $result = $stmt->fetch();
        
        if (!$result) {
            return false; // Default to disabled for security
        }
        
        $setting_value = $result['setting_value'];
        
        // Handle WordPress serialization
        if (strpos($setting_value, ':') !== false && preg_match('/^[sb]:\d+/', $setting_value)) {
            $setting_value = unserialize($setting_value);
        }
        
        // Convert to boolean
        $file_editing_enabled = (bool) $setting_value;
        
        return $file_editing_enabled;
        
    } catch (Exception $e) {
        return false; // Default to disabled for security
    }
}

function handle_save_file_content() {
    // Accept POST only
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(array('success' => false, 'message' => 'Method not allowed'));
        exit;
    }
    
    // Check if file editing is enabled
    if (!is_file_editing_enabled()) {
        http_response_code(403);
        echo json_encode(array('success' => false, 'message' => 'File editing is disabled in settings'));
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $file_path = sanitize_text($input['file_path'] ?? '');
    $file_path = rawurldecode($file_path);
    $content = $input['content'] ?? '';
    if (empty($file_path)) {
        http_response_code(400);
        echo json_encode(array('success' => false, 'message' => 'File path is required'));
        return;
    }
    // Security check: ensure file is within WordPress root
    $real_file_path = realpath($file_path);
    $wp_root = realpath(get_wp_root());
    if (!$real_file_path || strpos($real_file_path, $wp_root) !== 0) {
        http_response_code(403);
        echo json_encode(array('success' => false, 'message' => 'Invalid file path'));
        return;
    }
    try {
        file_put_contents($real_file_path, $content);
        echo json_encode(array('success' => true));
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(array('success' => false, 'message' => 'Failed to save file: ' . $e->getMessage()));
    }
}

/**
 * Get stored API key (OpenAI or Anthropic) from database
 */
function get_stored_api_key($provider) {
    try {
        $db = get_debug_db_connection();
        $config = get_wp_db_config();
        $table_name = $config['prefix'] . 'mat_settings';
        $setting_key = $provider === 'anthropic' ? 'anthropic_api_key' : 'openai_api_key';
        // Check if the table exists
        $stmt = $db->prepare("SHOW TABLES LIKE ?");
        $stmt->execute(array($table_name));
        if (!$stmt->fetch()) {
            return '';
        }
        // Get the encrypted API key
        $stmt = $db->prepare("SELECT setting_value FROM {$table_name} WHERE setting_key = ? AND user_id IS NULL");
        $stmt->execute(array($setting_key));
        $result = $stmt->fetch();
        if (!$result || empty($result['setting_value'])) {
            return '';
        }
        $encrypted_key = $result['setting_value'];
        // Handle WordPress serialization
        if (strpos($encrypted_key, ':') !== false && preg_match('/^s:\d+:\".*\";$/', $encrypted_key)) {
            $encrypted_key = unserialize($encrypted_key);
        }
        if (empty($encrypted_key)) {
            return '';
        }
        // Decrypt the API key (reuse decrypt_license_key)
        $decrypted_key = decrypt_license_key($encrypted_key, $config['salts']);
        if (empty($decrypted_key)) {
            return '';
        }
        return $decrypted_key;
    } catch (Exception $e) {
        return '';
    }
}
?>