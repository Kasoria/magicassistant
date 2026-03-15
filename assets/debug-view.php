<?php // phpcs:ignore WordPress.Files.FileName -- Standalone debug file, works without WordPress
/**
 * MagicAssistant Debug View - Standalone Debug Interface
 * 
 * This file provides a standalone debug interface that works even when WordPress
 * has fatal errors. It loads minimal WordPress functionality and provides a React-based
 * interface for viewing and analyzing logs.
 * 
 * @package MagicAssistant
 */

// Security check - handle access based on context
if (defined('ABSPATH') && !defined('MAT_DEBUG_VIEW_FRONTEND')) {
    // WordPress is loaded but not via frontend URL, redirect to admin page instead
    wp_redirect(admin_url('admin.php?page=magicassistant&tab=debug'));
    exit;
}

// Try to load WordPress minimally for database access
$wp_load_attempts = array(
    '../../../wp-load.php',
    '../../wp-load.php', 
    '../wp-load.php',
    'wp-load.php'
);

$wp_loaded = false;
foreach ($wp_load_attempts as $wp_load_path) {
    if (file_exists($wp_load_path)) {
        try {
            // Suppress errors during WordPress loading
            error_reporting(E_ERROR | E_PARSE);
            include_once $wp_load_path;
            $wp_loaded = defined('ABSPATH');
            break;
        } catch (Throwable $e) {
            // WordPress failed to load, continue with standalone mode
        }
    }
}

// Start session for authentication
if (!session_id()) {
    session_start();
}

/**
 * Database access functions for when WordPress fails to load
 * These are copied exactly from debug-api.php to ensure compatibility
 */

function get_wp_root_debug_view() {
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

function get_wp_db_config_debug_view() {
    // Try to find wp-config.php
    $wp_root = get_wp_root_debug_view();
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

function get_debug_db_connection_debug_view() {
    static $connection = null;
    
    if ($connection !== null) {
        return $connection;
    }
    
    $config = get_wp_db_config_debug_view();
    
    if (empty($config['name']) || empty($config['user']) || empty($config['host'])) {
        throw new Exception('Invalid database configuration');
    }
    
    try {
        $connection = new PDO( // phpcs:ignore WordPress.DB.RestrictedClasses.mysql__PDO -- Standalone debug file, PDO required
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
 * Decrypt using the same method as debug-api.php
 */
function decrypt_debug_password($encrypted_password, $salts) {
    if (empty($encrypted_password)) {
        return '';
    }
    
    // Use WordPress salts for encryption key (same as main plugin)
    $auth_salt = isset($salts['AUTH_SALT']) ? $salts['AUTH_SALT'] : 'mat_default_salt';
    $secure_auth_salt = isset($salts['SECURE_AUTH_SALT']) ? $salts['SECURE_AUTH_SALT'] : 'mat_secure_salt';
    $key = hash('sha256', $auth_salt . $secure_auth_salt);
    
    // Decode the base64 data
    $data = base64_decode($encrypted_password);
    
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

function get_stored_debug_password() {
    try {
        $db = get_debug_db_connection_debug_view();
        $config = get_wp_db_config_debug_view();
        
        $table_name = $config['prefix'] . 'mat_settings';
        
        // Check if the table exists
        $stmt = $db->prepare("SHOW TABLES LIKE ?");
        $stmt->execute(array($table_name));
        if (!$stmt->fetch()) {
            return '';
        }
        
        // Get the debug password
        $stmt = $db->prepare("SELECT setting_value FROM {$table_name} WHERE setting_key = ? AND user_id IS NULL");
        $stmt->execute(array('debug_view_password'));
        $result = $stmt->fetch();
        
        if (!$result || empty($result['setting_value'])) {
            return '';
        }
        
        $stored_password = $result['setting_value'];
        
        // Handle WordPress serialization
        if (strpos($stored_password, ':') !== false && preg_match('/^s:\d+:".*";$/', $stored_password)) {
            $stored_password = unserialize($stored_password);
        }
        
        if (empty($stored_password)) {
            return '';
        }
        
        // Check if this looks like an encrypted password (base64 encoded, longer than 32 chars)
        if (strlen($stored_password) > 32 && base64_decode($stored_password, true) !== false) {
            
            // Try to decrypt the password
            $decrypted_password = decrypt_debug_password($stored_password, $config['salts']);
            
            if (!empty($decrypted_password)) {
                return $decrypted_password;
            } else {
                // Add more detailed debugging
                
                // Fall through to try as plain text
            }
        }
        
        // If decryption failed or password doesn't look encrypted, try as plain text
        return $stored_password;
        
    } catch (Exception $e) {
        return '';
    }
}

/**
 * Test database connectivity and debug password retrieval
 */
function test_debug_database_connection() {
    try {
        
        $config = get_wp_db_config_debug_view();
        
        $db = get_debug_db_connection_debug_view();
        
        $table_name = $config['prefix'] . 'mat_settings';
        
        // Check if table exists
        $stmt = $db->prepare("SHOW TABLES LIKE ?");
        $stmt->execute(array($table_name));
        $table_exists = (bool)$stmt->fetch();
        
        if ($table_exists) {
            // Get all debug-related settings
            $stmt = $db->prepare("SELECT setting_key, setting_value, LENGTH(setting_value) as value_length FROM {$table_name} WHERE setting_key LIKE '%debug%' OR setting_key LIKE '%password%'");
            $stmt->execute();
            $settings = $stmt->fetchAll();
            
            foreach ($settings as $setting) {
            }
        }
        
        return true;
    } catch (Exception $e) {
        return false;
    }
}

/**
 * Get debug view file editing setting from database
 */
function get_debug_view_file_editing_setting() {
    try {
        $db = get_debug_db_connection_debug_view();
        $config = get_wp_db_config_debug_view();
        
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

// Check if debug view is enabled and authenticated
$is_authenticated = false;
$settings = array();
$file_editing_enabled = false;

if ($wp_loaded && function_exists('MATDB') && MATDB()) {
    $db = MATDB();
    $settings = $db->get_all_settings();
    
    $debug_enabled = isset($settings['debug_view_enabled']) ? (bool) $settings['debug_view_enabled'] : false;
    if (!$debug_enabled) {
        http_response_code(403);
        die('Debug view is disabled. Please enable it in MagicAssistant settings.');
    }
    
    // Get file editing setting
    $file_editing_enabled = isset($settings['debug_view_file_editing']) ? (bool) $settings['debug_view_file_editing'] : false;
    
    $is_authenticated = isset($_SESSION['mat_debug_authenticated']) && $_SESSION['mat_debug_authenticated'] === true;
} else {
    // Fallback mode - assume enabled but require authentication
    $debug_enabled = true;
    
    // Try to get file editing setting from database
    try {
        $file_editing_enabled = get_debug_view_file_editing_setting();
    } catch (Exception $e) {
        $file_editing_enabled = false; // Default to disabled for security
    }
    
    $is_authenticated = isset($_SESSION['mat_debug_authenticated']) && $_SESSION['mat_debug_authenticated'] === true;
}

// Handle authentication
if (isset($_POST['debug_password'])) {
    $password = $_POST['debug_password'];
    $password_matched = false;
    
    if ($wp_loaded && function_exists('MATDB') && MATDB()) {
        // WordPress is loaded - use normal method
        $db = MATDB();
        $stored_password = $settings['debug_view_password'] ?? '';
        $decrypted_password = '';
        if (method_exists($db, 'decrypt_api_key')) {
            $decrypted_password = $db->decrypt_api_key($stored_password);
        }
        
        // Accept either plain or decrypted password
        if ($password === $stored_password || $password === $decrypted_password) {
            $password_matched = true;
        }
    } else {
        // WordPress failed to load - try direct database access
        
        // First test database connectivity
        test_debug_database_connection();
        
        try {
            $stored_password = get_stored_debug_password();
            if (!empty($stored_password) && $password === $stored_password) {
                $password_matched = true;
            } else {
                if (!empty($stored_password)) {
                }
            }
        } catch (Exception $e) {
        }
        
        // Fallback to environment variable
        if (!$password_matched) {
            $env_password = getenv('MAGICASSISTANT_DEBUG_PASSWORD');
            if (!empty($env_password) && $password === $env_password) {
                $password_matched = true;
            }
        }
        
        // Final fallback to hardcoded password (for backwards compatibility)
        if (!$password_matched && $password === 'magicassistant_debug_2024') {
            $password_matched = true;
        }
    }
    
    if ($password_matched) {
        $_SESSION['mat_debug_authenticated'] = true;
        $is_authenticated = true;
    }
}

// If not authenticated, show login form
if (!$is_authenticated) {
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MagicAssistant Debug View - Authentication</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .auth-container {
                background: white;
                border-radius: 8px;
                padding: 2rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
                width: 100%;
                margin: 1rem;
            }
            .logo {
                text-align: center;
                margin-bottom: 2rem;
            }
            .logo h1 {
                color: #333;
                margin: 0;
                font-size: 1.5rem;
            }
            .logo p {
                color: #666;
                margin: 0.5rem 0 0 0;
                font-size: 0.9rem;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            label {
                display: block;
                margin-bottom: 0.5rem;
                color: #333;
                font-weight: 500;
            }
            input[type="password"] {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
                box-sizing: border-box;
            }
            input[type="password"]:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            button {
                width: 100%;
                padding: 0.75rem;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 1rem;
                cursor: pointer;
                transition: background 0.2s;
            }
            button:hover {
                background: #5a67d8;
            }
            .error {
                color: #e53e3e;
                margin-top: 0.5rem;
                font-size: 0.9rem;
            }
            .warning {
                background: #fefcbf;
                border: 1px solid #f6e05e;
                border-radius: 4px;
                padding: 1rem;
                margin-bottom: 1rem;
                color: #744210;
            }
            .info {
                background: #e6f7ff;
                border: 1px solid #91d5ff;
                border-radius: 4px;
                padding: 1rem;
                margin-bottom: 1rem;
                color: #0958d9;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <div class="auth-container">
            <div class="logo">
                <h1>🔧 MagicAssistant</h1>
                <p>Debug View Authentication</p>
            </div>
            
            <?php if (!$wp_loaded): ?>
                <div class="warning">
                    ⚠️ WordPress failed to load. Running in emergency mode.
                </div>
                <div class="info">
                    💡 Use the debug password you set in MagicAssistant settings. If you haven't set one, you can set the environment variable <code>MAGICASSISTANT_DEBUG_PASSWORD</code>.
                </div>
            <?php endif; ?>
            
            <form method="POST">
                <div class="form-group">
                    <label for="debug_password">Debug View Password:</label>
                    <input type="password" id="debug_password" name="debug_password" required>
                    <?php if (isset($_POST['debug_password'])): ?>
                        <div class="error">Invalid password. Please try again.</div>
                    <?php endif; ?>
                </div>
                <button type="submit">Access Debug View</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// User is authenticated, show the debug interface
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MagicAssistant Debug View</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            overflow-x: hidden;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            flex-direction: column;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .loading p {
            margin-top: 1rem;
            color: #666;
        }
        #mat-admin-root {
            min-height: 100vh;
        }
    </style>
</head>
<body>
    <div id="mat-admin-root"></div>

    <script>
        // Global configuration for the debug view
        window.matDebugConfig = {
            wpLoaded: <?php echo esc_js($wp_loaded ? 'true' : 'false'); ?>,
            restUrl: '',
            pluginUrl: '/wp-content/plugins/magicassistant/',
            apiUrl: '/debug-api.php',
            debugMode: true,
            authenticated: true,
            isStandalone: true,
            fileEditingEnabled: <?php echo esc_js($file_editing_enabled ? 'true' : 'false'); ?>
        };
    </script>

    <?php
    // Load React scripts for debug view
    $plugin_url = '/wp-content/plugins/magicassistant/';
    $dist_path = $_SERVER['DOCUMENT_ROOT'] . '/wp-content/plugins/magicassistant/dist/';
    
    // Check if we're in development mode
    // Use the same logic as the main plugin (React_Dev.php)
    $is_dev_mode = false;
    if (defined('MAT_DEV_MODE')) {
        $is_dev_mode = (bool) MAT_DEV_MODE;
    } else {
        // For debug view, always use production mode to avoid CORS issues
        // since it runs standalone and can't properly handle cross-origin dev assets
        $is_dev_mode = false;
    }
    
    if ($is_dev_mode): ?>
        <!-- Development mode - load from Vite dev server -->
        <script type="module">
            import RefreshRuntime from "http://localhost:3000/@react-refresh";
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {};
            window.$RefreshSig$ = () => type => type;
        </script>
        <script type="module" src="http://localhost:3000/@vite/client"></script>
        <script type="module" src="http://localhost:3000/src/debug.jsx"></script>
    <?php else: ?>
        <!-- Production mode - load built files -->
        <?php
        // Load CSS - use same logic as React_Dev.php
        $css_files = glob($dist_path . 'assets/styles-*.css');
        if (!empty($css_files)) {
            // Sort files to ensure consistent loading order
            sort($css_files);
            
            // Load all CSS files
            foreach ($css_files as $css_file_path) {
                $css_file = str_replace($dist_path, '', $css_file_path);
                echo '<link rel="stylesheet" href="' . esc_url($plugin_url . 'dist/' . $css_file) . '">' . "\n        ";
            }
        }
        
        // Load vendor chunks
        $vendor_files = glob($dist_path . 'vendor-*.js');
        if (!empty($vendor_files)) {
            $vendor_file = str_replace($dist_path, '', $vendor_files[0]);
            echo '<script type="module" src="' . esc_url($plugin_url . 'dist/' . $vendor_file) . '"></script>';
        }
        
        // Load main debug script
        if (file_exists($dist_path . 'debug.js')) {
            echo '<script type="module" src="' . esc_url($plugin_url . 'dist/debug.js') . '"></script>';
        }
        ?>
    <?php endif; ?>
</body>
</html> 