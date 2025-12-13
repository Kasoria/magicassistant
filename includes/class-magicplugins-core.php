<?php
/**
 * MagicPlugins Core
 *
 * Unified licensing and site connection handler for all MagicPlugins.
 * This file is IDENTICAL across all plugins and can be copy-pasted.
 *
 * Handles:
 * - License activation/deactivation via MagicProxy
 * - Plugin update checking via MagicProxy
 * - Site connection storage (shared across all MagicPlugins)
 * - Auto-connect on license activation
 * - Auto-register plugins when connection exists
 *
 * @package MagicPlugins
 */

if (!defined('ABSPATH')) {
    exit;
}

// Use statement must be at namespace/file level
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

if (!class_exists('MagicPlugins_Core')) {

    class MagicPlugins_Core {

        // === Constants ===
        const CONNECTION_OPTION = 'magicplugins_connection';
        const DEFAULT_PROXY_URL = 'https://proxy.magicplugins.io';
        const DEFAULT_MAGICDASH_URL = 'https://app.magicplugins.io';
        const ENCRYPTION_METHOD = 'AES-256-CBC';

        // === Storage ===
        private static $configs = [];           // Per-plugin configs keyed by plugin_slug
        private static $update_checkers = [];   // Per-plugin update checkers
        private static $connection = null;      // Shared connection data (cached)
        private static $decrypted_api_key = null;
        private static $current_plugin_slug = null; // Track which plugin is currently active
        private static $hooks_registered = false;

        /**
         * Initialize a plugin with MagicPlugins Core
         *
         * @param array $config Plugin configuration:
         *   - plugin_name: Display name (e.g., 'MagicChecklists')
         *   - plugin_slug: Slug for updates (e.g., 'magicchecklists')
         *   - plugin_version: Version string
         *   - plugin_file: Main plugin file path (__FILE__)
         *   - settings_prefix: Options prefix (e.g., 'magicchecklists_license')
         *   - text_domain: For translations (e.g., 'magic-checklists')
         */
        public static function init($config) {
            $slug = $config['plugin_slug'] ?? '';
            if (empty($slug)) {
                return;
            }

            // Store config for this plugin
            self::$configs[$slug] = $config;

            // Set as current plugin
            self::$current_plugin_slug = $slug;

            // Load connection data if not already loaded
            if (self::$connection === null) {
                self::load_connection();
            }

            // Initialize Plugin Update Checker for this plugin
            self::init_update_checker($config);

            // Register shared hooks only once
            if (!self::$hooks_registered) {
                add_filter('plugin_row_meta', array(__CLASS__, 'add_license_status_to_plugin_row'), 10, 2);
                add_action('activated_plugin', array(__CLASS__, 'maybe_auto_register'), 10, 2);
                self::$hooks_registered = true;
            }
        }

        /**
         * Set which plugin is currently active (for context-sensitive operations)
         *
         * @param string $plugin_slug
         */
        public static function set_current_plugin($plugin_slug) {
            if (isset(self::$configs[$plugin_slug])) {
                self::$current_plugin_slug = $plugin_slug;
            }
        }

        /**
         * Get config for current or specified plugin
         *
         * @param string|null $plugin_slug
         * @return array|null
         */
        public static function get_config($plugin_slug = null) {
            $slug = $plugin_slug ?? self::$current_plugin_slug;
            return self::$configs[$slug] ?? null;
        }

        /**
         * Get all registered plugin configs
         *
         * @return array
         */
        public static function get_all_configs() {
            return self::$configs;
        }

        // =========================================================================
        // LICENSE METHODS (per-plugin)
        // =========================================================================

        /**
         * Activate license for the current plugin
         *
         * @param string $license_key License key to activate
         * @param bool   $auto_connect Whether to auto-connect to MagicDash
         * @return true|WP_Error
         */
        public static function activate_license($license_key, $auto_connect = false) {
            $config = self::get_config();
            if (!$config) {
                return new WP_Error('no_config', __('Plugin not initialized', 'magic-plugins'));
            }

            if (empty($license_key)) {
                return new WP_Error('empty_license', __('Please enter a license key.', $config['text_domain'] ?? 'magic-plugins'));
            }

            $prefix = $config['settings_prefix'];
            $text_domain = $config['text_domain'] ?? 'magic-plugins';

            // Build request body
            $request_body = array(
                'licenseKey' => $license_key,
                'siteUrl' => home_url(),
                'pluginName' => $config['plugin_name'],
                'siteName' => get_bloginfo('name'),
            );

            // Add auto-connect flag if enabled
            if ($auto_connect) {
                $request_body['autoConnectMagicDash'] = true;
            }

            // Call MagicProxy license activation endpoint
            $response = wp_remote_post(self::get_proxy_url() . '/api/proxy/license/activate', array(
                'body' => wp_json_encode($request_body),
                'headers' => array(
                    'Content-Type' => 'application/json',
                ),
                'timeout' => 30,
                'sslverify' => !self::is_localhost_url(self::get_proxy_url()),
            ));

            if (is_wp_error($response)) {
                return new WP_Error('api_error', $response->get_error_message());
            }

            $body = json_decode(wp_remote_retrieve_body($response), true);
            $status_code = wp_remote_retrieve_response_code($response);

            if ($status_code !== 200 || empty($body['success'])) {
                $error_message = $body['error'] ?? __('License activation failed. Please try again.', $text_domain);
                return new WP_Error('activation_failed', $error_message);
            }

            // Store license info
            update_option($prefix . '_key', $license_key);
            update_option($prefix . '_status', 'active');
            update_option($prefix . '_last_validated', current_time('mysql'));

            // Store tier if returned
            if (!empty($body['license']['tier'])) {
                update_option($prefix . '_tier', $body['license']['tier']);
            }

            // Handle MagicDash auto-connect response
            if (!empty($body['magicdash']) && !empty($body['magicdash']['connected'])) {
                self::handle_auto_connect($body['magicdash']);
            }

            // Clear update checker cache to check for updates with new license
            if (isset(self::$update_checkers[$config['plugin_slug']])) {
                self::$update_checkers[$config['plugin_slug']]->checkForUpdates();
            }

            return true;
        }

        /**
         * Deactivate license for the current plugin
         *
         * @return true|WP_Error
         */
        public static function deactivate_license() {
            $config = self::get_config();
            if (!$config) {
                return new WP_Error('no_config', __('Plugin not initialized', 'magic-plugins'));
            }

            $prefix = $config['settings_prefix'];
            $license_key = get_option($prefix . '_key', '');

            if (empty($license_key)) {
                return true;
            }

            // Call MagicProxy license deactivation endpoint
            wp_remote_post(self::get_proxy_url() . '/api/proxy/license/deactivate', array(
                'body' => wp_json_encode(array(
                    'licenseKey' => $license_key,
                    'siteUrl' => home_url(),
                )),
                'headers' => array(
                    'Content-Type' => 'application/json',
                ),
                'timeout' => 30,
                'sslverify' => !self::is_localhost_url(self::get_proxy_url()),
            ));

            // Always clear local license data, even if API call fails
            delete_option($prefix . '_key');
            delete_option($prefix . '_status');
            delete_option($prefix . '_last_validated');
            delete_option($prefix . '_tier');

            // Also disconnect from MagicDash (matches remote deactivation behavior)
            // The disconnectSiteOnDeactivation setting is checked by MagicDash when
            // it receives the deactivation request - here we just clear local data
            if (self::is_connected()) {
                self::disconnect();
            }

            return true;
        }

        /**
         * Check if license is active for the current or specified plugin
         *
         * @param string|null $plugin_slug
         * @return bool
         */
        public static function is_license_active($plugin_slug = null) {
            $config = self::get_config($plugin_slug);
            if (!$config) {
                return false;
            }

            $prefix = $config['settings_prefix'];
            $license_key = get_option($prefix . '_key', '');

            return !empty($license_key) && get_option($prefix . '_status') === 'active';
        }

        /**
         * Get license key for the current or specified plugin
         *
         * @param string|null $plugin_slug
         * @return string
         */
        public static function get_license_key($plugin_slug = null) {
            $config = self::get_config($plugin_slug);
            if (!$config) {
                return '';
            }

            return get_option($config['settings_prefix'] . '_key', '');
        }

        /**
         * Get license tier for the current or specified plugin
         *
         * @param string|null $plugin_slug
         * @return string
         */
        public static function get_license_tier($plugin_slug = null) {
            $config = self::get_config($plugin_slug);
            if (!$config) {
                return '';
            }

            return get_option($config['settings_prefix'] . '_tier', '');
        }

        /**
         * Check if MagicDash auto-connect is enabled in settings
         *
         * @param string|null $plugin_slug
         * @return bool
         */
        public static function is_auto_connect_enabled($plugin_slug = null) {
            $config = self::get_config($plugin_slug);
            if (!$config) {
                return false;
            }

            return (bool) get_option($config['settings_prefix'] . '_auto_connect_magicdash', false);
        }

        /**
         * Set MagicDash auto-connect preference
         *
         * @param bool $enabled
         * @param string|null $plugin_slug
         */
        public static function set_auto_connect_enabled($enabled, $plugin_slug = null) {
            $config = self::get_config($plugin_slug);
            if (!$config) {
                return;
            }

            update_option($config['settings_prefix'] . '_auto_connect_magicdash', (bool) $enabled);
        }

        /**
         * Force update check for the current plugin
         *
         * @param string|null $plugin_slug
         */
        public static function check_for_updates($plugin_slug = null) {
            $slug = $plugin_slug ?? self::$current_plugin_slug;
            if (isset(self::$update_checkers[$slug])) {
                self::$update_checkers[$slug]->checkForUpdates();
            }
        }

        // =========================================================================
        // CONNECTION METHODS (shared across all plugins)
        // =========================================================================

        /**
         * Check if connected to MagicDash
         *
         * @return bool
         */
        public static function is_connected() {
            return !empty(self::$connection['site_id']) && !empty(self::$connection['api_key']);
        }

        /**
         * Get the site ID
         *
         * @return string
         */
        public static function get_site_id() {
            return self::$connection['site_id'] ?? '';
        }

        /**
         * Get the API key (decrypted)
         *
         * @return string
         */
        public static function get_api_key() {
            // Return cached decrypted key if available
            if (self::$decrypted_api_key !== null) {
                return self::$decrypted_api_key;
            }

            $stored_key = self::$connection['api_key'] ?? '';
            if (empty($stored_key)) {
                return '';
            }

            // Check if the key is encrypted (base64 encoded with IV)
            // Plain text keys start with 'md_live_'
            if (strpos($stored_key, 'md_live_') === 0) {
                // Plain text key (legacy or migration needed)
                self::$decrypted_api_key = $stored_key;
            } else {
                // Encrypted key
                self::$decrypted_api_key = self::decrypt_value($stored_key);
            }

            return self::$decrypted_api_key;
        }

        /**
         * Get list of connected plugins
         *
         * @return array
         */
        public static function get_connected_plugins() {
            return self::$connection['connected_plugins'] ?? array();
        }

        /**
         * Get full connection details
         *
         * @return array
         */
        public static function get_connection_details() {
            return array(
                'is_connected' => self::is_connected(),
                'magicdash_url' => self::get_magicdash_url(),
                'site_id' => self::get_site_id(),
                'connected_at' => self::$connection['connected_at'] ?? null,
                'connected_plugins' => self::get_connected_plugins(),
            );
        }

        /**
         * Connect to MagicDash via MagicProxy
         *
         * @param string $api_key The API key from MagicDash
         * @return array Result with success status and message
         */
        public static function connect($api_key) {
            $config = self::get_config();
            $plugin_name = $config ? $config['plugin_name'] : 'MagicPlugins';
            $plugin_version = $config ? $config['plugin_version'] : '';

            // All requests go through MagicProxy
            $proxy_url = self::get_proxy_url();
            $verify_url = $proxy_url . '/api/proxy/sites/verify';

            $body = array(
                'apiKey' => $api_key,
                'siteUrl' => get_site_url(),
                'siteName' => get_bloginfo('name'),
                'installedPlugins' => array($plugin_name),
                'pluginVersion' => $plugin_version,
            );

            $response = wp_remote_post($verify_url, array(
                'body' => wp_json_encode($body),
                'headers' => array(
                    'Content-Type' => 'application/json',
                ),
                'timeout' => 30,
                'sslverify' => !self::is_localhost_url($proxy_url),
            ));

            if (is_wp_error($response)) {
                return array(
                    'success' => false,
                    'message' => $response->get_error_message(),
                );
            }

            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = json_decode(wp_remote_retrieve_body($response), true);

            if ($response_code !== 200 || empty($response_body['success'])) {
                $error_message = $response_body['error'] ?? 'Failed to verify connection';
                return array(
                    'success' => false,
                    'message' => $error_message,
                );
            }

            // Store the connection
            self::store_connection($api_key, $response_body['siteId'], $plugin_name);

            return array(
                'success' => true,
                'message' => 'Connected successfully',
                'site_id' => $response_body['siteId'],
            );
        }

        /**
         * Disconnect from MagicDash
         *
         * @return array Result with success status
         */
        public static function disconnect() {
            self::$connection = array();
            self::$decrypted_api_key = null;
            delete_option(self::CONNECTION_OPTION);

            // Also remove from mcl_integration_settings
            $integration_settings = get_option('mcl_integration_settings', array());
            unset($integration_settings['mcl_api_key']);
            update_option('mcl_integration_settings', $integration_settings);

            return array(
                'success' => true,
                'message' => 'Disconnected successfully',
            );
        }

        /**
         * Register a new plugin with the existing connection via MagicProxy
         *
         * @param string $plugin_name The plugin name to register
         * @param string $plugin_version The plugin version
         * @return array Result with success status
         */
        public static function register_plugin($plugin_name, $plugin_version = '') {
            if (!self::is_connected()) {
                return array(
                    'success' => false,
                    'message' => 'Not connected to MagicDash',
                );
            }

            // Check if already registered
            $connected_plugins = self::get_connected_plugins();
            if (in_array($plugin_name, $connected_plugins)) {
                return array(
                    'success' => true,
                    'message' => 'Plugin already registered',
                );
            }

            // Register via MagicProxy
            $proxy_url = self::get_proxy_url();
            $register_url = $proxy_url . '/api/proxy/sites/register-plugin';

            $body = array(
                'apiKey' => self::get_api_key(),
                'siteId' => self::get_site_id(),
                'plugin' => $plugin_name,
                'pluginVersion' => $plugin_version,
            );

            $response = wp_remote_post($register_url, array(
                'body' => wp_json_encode($body),
                'headers' => array(
                    'Content-Type' => 'application/json',
                ),
                'timeout' => 30,
                'sslverify' => !self::is_localhost_url($proxy_url),
            ));

            if (is_wp_error($response)) {
                return array(
                    'success' => false,
                    'message' => $response->get_error_message(),
                );
            }

            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = json_decode(wp_remote_retrieve_body($response), true);

            if ($response_code !== 200 || empty($response_body['success'])) {
                $error_message = $response_body['error'] ?? 'Failed to register plugin';
                return array(
                    'success' => false,
                    'message' => $error_message,
                );
            }

            // Add to connected plugins
            $connected_plugins[] = $plugin_name;
            self::$connection['connected_plugins'] = $connected_plugins;
            self::save_connection();

            return array(
                'success' => true,
                'message' => 'Plugin registered successfully',
            );
        }

        /**
         * Test the connection to MagicDash via MagicProxy
         *
         * @return array Result with success status
         */
        public static function test_connection() {
            if (!self::is_connected()) {
                return array(
                    'success' => false,
                    'message' => 'Not connected to MagicDash',
                );
            }

            // Test connection via MagicProxy
            $proxy_url = self::get_proxy_url();
            $verify_url = $proxy_url . '/api/proxy/sites/verify';

            $body = array(
                'apiKey' => self::get_api_key(),
                'siteUrl' => get_site_url(),
                'siteName' => get_bloginfo('name'),
                'installedPlugins' => self::get_connected_plugins(),
            );

            $response = wp_remote_post($verify_url, array(
                'body' => wp_json_encode($body),
                'headers' => array(
                    'Content-Type' => 'application/json',
                ),
                'timeout' => 30,
                'sslverify' => !self::is_localhost_url($proxy_url),
            ));

            if (is_wp_error($response)) {
                return array(
                    'success' => false,
                    'message' => $response->get_error_message(),
                );
            }

            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = json_decode(wp_remote_retrieve_body($response), true);

            if ($response_code === 200 && !empty($response_body['success'])) {
                return array(
                    'success' => true,
                    'message' => 'Connection is working',
                );
            }

            return array(
                'success' => false,
                'message' => $response_body['error'] ?? 'Connection test failed',
            );
        }

        // =========================================================================
        // INTERNAL METHODS
        // =========================================================================

        /**
         * Initialize Plugin Update Checker for a plugin
         *
         * @param array $config Plugin configuration
         */
        private static function init_update_checker($config) {
            $slug = $config['plugin_slug'];
            $update_check_url = self::get_proxy_url() . '/api/proxy/plugins/update-check?slug=' . $slug;

            $update_checker = PucFactory::buildUpdateChecker(
                $update_check_url,
                $config['plugin_file'],
                $slug
            );

            // Add license key and site URL to update check requests
            $prefix = $config['settings_prefix'];
            $update_checker->addQueryArgFilter(function($query_args) use ($prefix) {
                $query_args['license_key'] = get_option($prefix . '_key', '');
                $query_args['site_url'] = home_url();
                return $query_args;
            });

            self::$update_checkers[$slug] = $update_checker;
        }

        /**
         * Handle MagicDash auto-connect response from license activation
         *
         * @param array $magicdash_data The magicdash response data
         */
        private static function handle_auto_connect($magicdash_data) {
            if (empty($magicdash_data['apiKey']) || empty($magicdash_data['siteId'])) {
                return;
            }

            $config = self::get_config();
            $plugin_name = $config ? $config['plugin_name'] : 'MagicPlugins';

            self::store_connection(
                $magicdash_data['apiKey'],
                $magicdash_data['siteId'],
                $plugin_name
            );

            // Trigger initial sync
            self::trigger_initial_sync($magicdash_data['apiKey'], $magicdash_data['siteId']);
        }

        /**
         * Store connection details
         *
         * @param string $api_key The API key
         * @param string $site_id The site ID
         * @param string $plugin_name The plugin establishing the connection
         */
        private static function store_connection($api_key, $site_id, $plugin_name = '') {
            // Encrypt the API key before storing
            $encrypted_api_key = self::encrypt_value($api_key);

            // Get existing connected plugins or start fresh
            $existing_plugins = self::get_connected_plugins();
            if (!empty($plugin_name) && !in_array($plugin_name, $existing_plugins)) {
                $existing_plugins[] = $plugin_name;
            }

            // Store the connection
            self::$connection = array(
                'magicdash_url' => self::get_magicdash_url(),
                'api_key' => $encrypted_api_key,
                'site_id' => $site_id,
                'connected_at' => time(),
                'connected_plugins' => $existing_plugins,
                'connected_via' => 'license_activation',
            );

            // Cache the decrypted key for immediate use
            self::$decrypted_api_key = $api_key;

            self::save_connection();

            // Also store in mcl_integration_settings so REST API can validate incoming requests
            $integration_settings = get_option('mcl_integration_settings', array());
            $integration_settings['mcl_api_key'] = $encrypted_api_key;
            update_option('mcl_integration_settings', $integration_settings);
        }

        /**
         * Trigger initial sync by calling the verify endpoint via MagicProxy
         *
         * @param string $api_key The API key
         * @param string $site_id The site ID
         */
        private static function trigger_initial_sync($api_key, $site_id) {
            $proxy_url = self::get_proxy_url();
            $verify_url = $proxy_url . '/api/proxy/sites/verify';

            $body = array(
                'apiKey' => $api_key,
                'siteUrl' => get_site_url(),
                'siteName' => get_bloginfo('name'),
                'installedPlugins' => self::get_connected_plugins(),
            );

            // Make the request to trigger sync (non-blocking is fine here)
            wp_remote_post($verify_url, array(
                'body' => wp_json_encode($body),
                'headers' => array(
                    'Content-Type' => 'application/json',
                ),
                'timeout' => 10,
                'blocking' => true,
                'sslverify' => !self::is_localhost_url($proxy_url),
            ));
        }

        /**
         * Auto-register plugin when activated if connection exists
         *
         * @param string $plugin The plugin being activated
         * @param bool $network_wide Whether the plugin is being activated network-wide
         */
        public static function maybe_auto_register($plugin, $network_wide) {
            // Check if this is a MagicPlugin
            $plugin_basename = basename(dirname($plugin));
            $magic_plugins = array(
                'magicchecklists' => array('name' => 'MagicChecklists', 'version_const' => 'MAGIC_CHECKLISTS_VERSION'),
                'magicassistant' => array('name' => 'MagicAssistant', 'version_const' => 'MAGIC_ASSISTANT_VERSION'),
            );

            if (!isset($magic_plugins[$plugin_basename])) {
                return;
            }

            // Reload connection data (it might have been set by another plugin)
            self::load_connection();

            if (!self::is_connected()) {
                return;
            }

            $plugin_info = $magic_plugins[$plugin_basename];
            $version = defined($plugin_info['version_const']) ? constant($plugin_info['version_const']) : '';

            // Register the newly activated plugin
            self::register_plugin($plugin_info['name'], $version);
        }

        /**
         * Add license status to plugin row in plugins list
         *
         * @param array $links Plugin row meta links
         * @param string $file Plugin file
         * @return array
         */
        public static function add_license_status_to_plugin_row($links, $file) {
            // Check each registered plugin
            foreach (self::$configs as $slug => $config) {
                if ($file !== plugin_basename($config['plugin_file'])) {
                    continue;
                }

                $text_domain = $config['text_domain'] ?? 'magic-plugins';
                if (self::is_license_active($slug)) {
                    $links[] = '<span style="color: #46b450;">' . __('License: Active', $text_domain) . '</span>';
                } else {
                    $links[] = '<span style="color: #dc3232;">' . __('License: Inactive', $text_domain) . '</span>';
                }
                break;
            }

            return $links;
        }

        /**
         * Load connection data from database
         */
        private static function load_connection() {
            self::$connection = get_option(self::CONNECTION_OPTION, array());
        }

        /**
         * Save connection data to database
         */
        private static function save_connection() {
            update_option(self::CONNECTION_OPTION, self::$connection);
        }

        /**
         * Get the MagicProxy URL
         *
         * @return string
         */
        public static function get_proxy_url() {
            if (defined('MAGICPROXY_URL')) {
                return rtrim(MAGICPROXY_URL, '/');
            }
            return self::DEFAULT_PROXY_URL;
        }

        /**
         * Get the MagicDash URL
         *
         * @return string
         */
        public static function get_magicdash_url() {
            if (!empty(self::$connection['magicdash_url'])) {
                return self::$connection['magicdash_url'];
            }
            if (defined('MAGICDASH_URL')) {
                return rtrim(MAGICDASH_URL, '/');
            }
            return self::DEFAULT_MAGICDASH_URL;
        }

        /**
         * Encrypt a value for secure storage
         *
         * @param string $value The value to encrypt
         * @return string The encrypted value (base64 encoded with IV)
         */
        private static function encrypt_value($value) {
            if (empty($value)) {
                return '';
            }

            $salt = wp_salt('auth');
            $iv = openssl_random_pseudo_bytes(16);

            $encrypted = openssl_encrypt(
                $value,
                self::ENCRYPTION_METHOD,
                $salt,
                0,
                $iv
            );

            if ($encrypted === false) {
                return '';
            }

            // Store IV with the encrypted data
            return base64_encode($iv . $encrypted);
        }

        /**
         * Decrypt a stored value
         *
         * @param string $stored_value The encrypted value to decrypt
         * @return string The decrypted value
         */
        private static function decrypt_value($stored_value) {
            if (empty($stored_value)) {
                return '';
            }

            $decoded = base64_decode($stored_value);
            if ($decoded === false) {
                return '';
            }

            // Extract IV from stored data (first 16 bytes)
            $iv = substr($decoded, 0, 16);
            $encrypted = substr($decoded, 16);

            $salt = wp_salt('auth');

            $decrypted = openssl_decrypt(
                $encrypted,
                self::ENCRYPTION_METHOD,
                $salt,
                0,
                $iv
            );

            return $decrypted !== false ? $decrypted : '';
        }

        /**
         * Check if a URL is a localhost/development URL
         *
         * @param string $url The URL to check
         * @return bool True if localhost/development URL
         */
        private static function is_localhost_url($url) {
            $parsed = wp_parse_url($url);
            if (!$parsed || empty($parsed['host'])) {
                return false;
            }

            $host = strtolower($parsed['host']);

            // Check for common localhost patterns
            $localhost_patterns = array('localhost', '127.0.0.1', '0.0.0.0', '::1');
            if (in_array($host, $localhost_patterns, true)) {
                return true;
            }

            // Check for .local, .localhost, .test domains
            if (preg_match('/\.(local|localhost|test|dev|ddev\.site)$/i', $host)) {
                return true;
            }

            // Check for local IP ranges
            if (filter_var($host, FILTER_VALIDATE_IP)) {
                if (
                    strpos($host, '192.168.') === 0 ||
                    strpos($host, '10.') === 0 ||
                    preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $host)
                ) {
                    return true;
                }
            }

            return false;
        }
    }

} // end class_exists
