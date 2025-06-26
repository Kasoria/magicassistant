<?php
/**
 * MagicProxy - DataForSEO API Proxy for MagicPlugins
 *
 * @package           MagicProxy
 * @author            MagicPlugins.io
 * @copyright         2024 MagicPlugins.io
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       MagicProxy
 * Plugin URI:        https://magicplugins.io
 * Description:       Secure proxy for DataForSEO API requests from MagicAssistant installations.
 * Version:           1.0.0
 * Requires PHP:      7.4
 * Author:            MagicPlugins.io
 * Text Domain:       magic-proxy
 * License:           GPL v2 or later
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 */

if (!defined('ABSPATH')) exit;

class MagicProxy {
    
    private $dataforseo_api_key;
    private $dataforseo_login;
    private $pagespeed_api_key;
    private $base_url = 'https://api.dataforseo.com/v3';
    
    public function __construct() {
        // Load credentials from options
        $this->dataforseo_login = get_option('magicproxy_dataforseo_login', '');
        $this->dataforseo_api_key = get_option('magicproxy_dataforseo_api_key', '');
        $this->pagespeed_api_key = get_option('magicproxy_pagespeed_api_key', '');
        
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('init', array($this, 'init'));
        
        // Show admin notice if credentials aren't configured
        if (is_admin() && (!$this->dataforseo_login || !$this->dataforseo_api_key)) {
            add_action('admin_notices', array($this, 'show_credential_notice'));
        }
    }
    
    public function init() {
        // Add admin interface for managing API credentials
        if (is_admin()) {
            add_action('admin_menu', array($this, 'add_admin_menu'));
        }
    }
    
    /**
     * Show admin notice if credentials aren't configured
     */
    public function show_credential_notice() {
        $screen = get_current_screen();
        
        // Don't show on the MagicProxy settings page itself
        if ($screen && $screen->id === 'settings_page_magic-proxy') {
            return;
        }
        
        ?>
        <div class="notice notice-warning">
            <p>
                <strong>MagicProxy:</strong> DataForSEO API credentials are not configured. 
                SEO analysis features will use mock data only. 
                <a href="<?php echo admin_url('options-general.php?page=magic-proxy'); ?>">Configure credentials</a>
            </p>
        </div>
        <?php
    }
    
    public function register_rest_routes() {
        register_rest_route('magicproxy/v1', '/dataforseo', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_dataforseo_request'),
            'permission_callback' => array($this, 'validate_request'),
        ));
        
        register_rest_route('magicproxy/v1', '/pagespeed', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_pagespeed_request'),
            'permission_callback' => array($this, 'validate_request'),
        ));
        
        register_rest_route('magicproxy/v1', '/status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_status'),
            'permission_callback' => '__return_true',
        ));
        
        // Test endpoint for debugging competitor analysis
        register_rest_route('magicproxy/v1', '/test-competitor', array(
            'methods' => 'GET',
            'callback' => array($this, 'test_competitor_analysis'),
            'permission_callback' => '__return_true',
        ));
        
        // Simple test endpoint to verify proxy is working
        register_rest_route('magicproxy/v1', '/test', array(
            'methods' => array('GET', 'POST'),
            'callback' => array($this, 'test_proxy'),
            'permission_callback' => '__return_true',
        ));
        
        // Test PageSpeed endpoint for debugging
        register_rest_route('magicproxy/v1', '/test-pagespeed', array(
            'methods' => 'GET',
            'callback' => array($this, 'test_pagespeed'),
            'permission_callback' => '__return_true',
        ));
    }
    
    /**
     * Validate incoming requests from MagicAssistant installations
     */
    public function validate_request($request) {
        $data = $request->get_json_params();
        
        // Basic validation
        if (empty($data['action'])) {
            return false;
        }
        
        // For now, allow requests with minimal validation for testing
        // TODO: Implement proper authentication in production
        
        // If auth data is provided, validate it, otherwise allow for testing
        if (!empty($data['auth'])) {
            $auth = $data['auth'];
            
            // Validate timestamp (prevent replay attacks) - increased tolerance
            $timestamp = intval($data['timestamp'] ?? 0);
            $current_time = time();
            if ($timestamp > 0 && abs($current_time - $timestamp) > 1800) { // 30 minutes tolerance
                return false;
            }
            
            // If signature is provided, validate it
            if (!empty($auth['signature']) && !empty($auth['site_id'])) {
                // Recreate expected signature
                $signature_data = array(
                    'site_id' => $auth['site_id'],
                    'timestamp' => $timestamp,
                    'action' => $data['action']
                );
                
                $expected_signature = hash_hmac('sha256', wp_json_encode($signature_data), $auth['site_id']);
                
                if (!hash_equals($expected_signature, $auth['signature'])) {
                    return false;
                }
            }
        }
        
        // Check domain whitelist (more permissive for testing)
        if (!empty($data['site_url'])) {
            $site_url = esc_url_raw($data['site_url']);
            if (!$this->is_allowed_domain($site_url)) {
                return false;
            }
        }
        
        // Rate limiting (more permissive for testing)
        $site_id = $data['auth']['site_id'] ?? 'test_site';
        if (!$this->check_rate_limit($site_id)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Handle DataForSEO API requests
     */
    public function handle_dataforseo_request($request) {
        $data = $request->get_json_params();
        $action = $data['action'] ?? 'unknown';
        $args = $data['data'] ?? array();
        
        try {
            switch ($action) {
                case 'serp_analysis':
                    $result = $this->get_serp_analysis($args);
                    break;
                case 'keyword_difficulty':
                    $result = $this->get_keyword_difficulty($args);
                    break;
                case 'domain_analysis':
                    $result = $this->get_domain_analysis($args);
                    break;
                case 'competitor_analysis':
                    $result = $this->get_competitor_analysis($args);
                    break;
                case 'technical_audit':
                    $result = $this->get_technical_audit($args);
                    break;
                case 'get_locations':
                    $result = $this->get_locations();
                    break;
                case 'status':
                    $result = array('status' => 'operational', 'timestamp' => time());
                    break;
                default:
                    throw new Exception('Unknown action: ' . $action);
            }
            
            // Log successful request
            $site_id = $data['auth']['site_id'] ?? 'unknown_site';
            $this->log_request($site_id, $action, true);
            
            return array(
                'success' => true,
                'data' => $result
            );
            
        } catch (Exception $e) {
            // Log failed request
            $site_id = $data['auth']['site_id'] ?? 'unknown_site';
            $this->log_request($site_id, $action, false, $e->getMessage());
            
            return new WP_Error('dataforseo_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * Handle PageSpeed Insights API requests
     */
    public function handle_pagespeed_request($request) {
        $data = $request->get_json_params();
        $action = $data['action'];
        $args = $data['data'] ?? array();
        
        try {
            switch ($action) {
                case 'analyze':
                    $result = $this->get_pagespeed_analysis($args);
                    break;
                default:
                    throw new Exception('Unknown PageSpeed action: ' . $action);
            }
            
            // Log successful request
            $this->log_request($data['auth']['site_id'], 'pagespeed_' . $action, true);
            
            return array(
                'success' => true,
                'data' => $result
            );
            
        } catch (Exception $e) {
            // Log failed request
            $this->log_request($data['auth']['site_id'], 'pagespeed_' . $action, false, $e->getMessage());
            
            return new WP_Error('pagespeed_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * PageSpeed Insights Analysis
     */
    private function get_pagespeed_analysis($args) {
        $url = esc_url_raw($args['url']);
        $strategy = sanitize_text_field($args['strategy'] ?? 'mobile');
        $category = $args['category'] ?? array('performance', 'accessibility', 'best-practices', 'seo');
        $locale = sanitize_text_field($args['locale'] ?? 'en');
        
        if (empty($url)) {
            throw new Exception('URL is required for PageSpeed analysis');
        }
        
        // Get PageSpeed Insights API key
        if (empty($this->pagespeed_api_key)) {
            throw new Exception('PageSpeed Insights API key not configured. Please add your API key in the MagicProxy settings.');
        }
        
        // Build API request URL
        $api_url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
        $query_params = array(
            'url' => $url,
            'strategy' => $strategy,
            'locale' => $locale,
            'key' => $this->pagespeed_api_key
        );
        
        // Build the URL with base parameters first
        $request_url = add_query_arg($query_params, $api_url);
        
        // Add categories manually to create multiple parameters with same name
        $category_params = array();
        foreach ($category as $cat) {
            $category_params[] = 'category=' . urlencode($cat);
        }
        
        // Append category parameters to the URL
        if (!empty($category_params)) {
            $request_url .= '&' . implode('&', $category_params);
        }
        
        // Debug logging for PageSpeed API request
        // Make API request
        $response = wp_remote_get($request_url, array(
            'timeout' => 75,
            'headers' => array(
                'User-Agent' => 'MagicProxy/1.0'
            )
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('PageSpeed API request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            throw new Exception('PageSpeed API returned error: HTTP ' . $status_code);
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response from PageSpeed API');
        }
        
        if (isset($data['error'])) {
            throw new Exception('PageSpeed API error: ' . $data['error']['message']);
        }
        
        // Process and return the results
        return $this->process_pagespeed_results($data);
    }
    
    /**
     * Process PageSpeed results into a clean format
     */
    private function process_pagespeed_results($data) {
        $lighthouse_result = $data['lighthouseResult'] ?? array();
        $categories = $lighthouse_result['categories'] ?? array();
        $audits = $lighthouse_result['audits'] ?? array();
        
        // Extract scores
        $scores = array();
        foreach ($categories as $category_id => $category_data) {
            $scores[$category_id] = array(
                'score' => round(($category_data['score'] ?? 0) * 100),
                'title' => $category_data['title'] ?? $category_id
            );
        }
        
        // Extract Core Web Vitals
        $core_web_vitals = array();
        $vital_metrics = array(
            'largest-contentful-paint' => 'LCP',
            'first-input-delay' => 'FID',
            'cumulative-layout-shift' => 'CLS',
            'first-contentful-paint' => 'FCP',
            'interaction-to-next-paint' => 'INP'
        );
        
        foreach ($vital_metrics as $metric_id => $metric_name) {
            if (isset($audits[$metric_id])) {
                $audit = $audits[$metric_id];
                $core_web_vitals[$metric_name] = array(
                    'value' => $audit['numericValue'] ?? null,
                    'displayValue' => $audit['displayValue'] ?? 'N/A',
                    'score' => $audit['score'] ?? null,
                    'title' => $audit['title'] ?? $metric_name
                );
            }
        }
        
        // Define opportunity audits (performance improvements)
        $opportunity_audits = array(
            'render-blocking-resources',
            'unused-css-rules',
            'unused-javascript',
            'modern-image-formats',
            'uses-optimized-images',
            'uses-webp-images',
            'uses-responsive-images',
            'efficiently-encode-images',
            'offscreen-images',
            'unminified-css',
            'unminified-javascript',
            'enable-text-compression',
            'uses-long-cache-ttl',
            'total-byte-weight',
            'legacy-javascript',
            'server-response-time',
            'uses-rel-preconnect',
            'uses-rel-preload',
            'font-display',
            'third-party-summary',
            'third-party-facades',
            'largest-contentful-paint-element',
            'prioritize-lcp-image',
            'uses-passive-event-listeners',
            'non-composited-animations',
            'unsized-images'
        );
        
        // Extract opportunities
        $opportunities = array();
        foreach ($opportunity_audits as $audit_id) {
            if (isset($audits[$audit_id])) {
                $audit_data = $audits[$audit_id];
                // Include if it has a score less than 1 (needs improvement)
                if (isset($audit_data['score']) && $audit_data['score'] < 1) {
                    $opportunity = array(
                        'id' => $audit_id,
                        'title' => $audit_data['title'] ?? $audit_id,
                        'description' => $audit_data['description'] ?? '',
                        'score' => $audit_data['score'],
                        'displayValue' => $audit_data['displayValue'] ?? ''
                    );
                    
                    // Add savings information if available
                    if (isset($audit_data['details']['overallSavingsMs'])) {
                        $opportunity['overallSavingsMs'] = $audit_data['details']['overallSavingsMs'];
                    }
                    if (isset($audit_data['details']['overallSavingsBytes'])) {
                        $opportunity['overallSavingsBytes'] = $audit_data['details']['overallSavingsBytes'];
                    }
                    
                    $opportunities[] = $opportunity;
                }
            }
        }
        
        // Define known diagnostic audit patterns (informational audits)
        $diagnostic_patterns = array(
            'mainthread-work-breakdown',
            'bootup-time',
            'uses-long-cache-ttl',
            'total-byte-weight',
            'dom-size',
            'critical-request-chains',
            'user-timings',
            'network-requests',
            'network-rtt',
            'network-server-latency',
            'main-thread-tasks',
            'metrics',
            'resource-summary',
            'third-party-summary',
            'timing-budget',
            'performance-budget'
        );
        
        // Extract diagnostics - include informational audits
        $diagnostics = array();
        foreach ($audits as $audit_id => $audit_data) {
            // Include if it's in our diagnostic patterns OR if it has no score (informational)
            $is_diagnostic = in_array($audit_id, $diagnostic_patterns) || 
                           !isset($audit_data['score']) || 
                           ($audit_data['scoreDisplayMode'] ?? '') === 'informative' ||
                           ($audit_data['scoreDisplayMode'] ?? '') === 'notApplicable';
            
            if ($is_diagnostic) {
                $diagnostic = array(
                    'id' => $audit_id,
                    'title' => $audit_data['title'] ?? $audit_id,
                    'description' => $audit_data['description'] ?? '',
                    'score' => $audit_data['score'] ?? null,
                    'displayValue' => $audit_data['displayValue'] ?? '',
                    'scoreDisplayMode' => $audit_data['scoreDisplayMode'] ?? 'numeric'
                );
                
                // Add numericValue if available
                if (isset($audit_data['numericValue'])) {
                    $diagnostic['numericValue'] = $audit_data['numericValue'];
                }
                
                $diagnostics[] = $diagnostic;
            }
        }
        
        // Extract all audits for comprehensive view (filtered to exclude base64 data)
        $processed_audits = array();
        foreach ($audits as $audit_id => $audit_data) {
            $processed_audits[$audit_id] = array(
                'title' => $audit_data['title'] ?? $audit_id,
                'description' => $audit_data['description'] ?? '',
                'score' => $audit_data['score'] ?? null,
                'displayValue' => $audit_data['displayValue'] ?? '',
                'scoreDisplayMode' => $audit_data['scoreDisplayMode'] ?? 'numeric'
            );
            
            // Add numericValue for metrics
            if (isset($audit_data['numericValue'])) {
                $processed_audits[$audit_id]['numericValue'] = $audit_data['numericValue'];
            }
            
            // Skip details that might contain base64 data
            if (isset($audit_data['details']) && is_array($audit_data['details'])) {
                // Only include safe details
                $safe_details = array();
                foreach ($audit_data['details'] as $key => $value) {
                    if (!is_string($value) || (strlen($value) < 1000 && !preg_match('/^data:image/', $value))) {
                        $safe_details[$key] = $value;
                    }
                }
                if (!empty($safe_details)) {
                    $processed_audits[$audit_id]['details'] = $safe_details;
                }
            }
        }
        
        // Extract loading experience data (CrUX data)
        $loading_experience = array();
        if (isset($data['loadingExperience'])) {
            $loading_experience = $data['loadingExperience'];
        }
        
        $origin_loading_experience = array();
        if (isset($data['originLoadingExperience'])) {
            $origin_loading_experience = $data['originLoadingExperience'];
        }
        
        // Extract lighthouse environment and metadata
        $lighthouse_info = array();
        if (isset($lighthouse_result['requestedUrl'])) {
            $lighthouse_info['requestedUrl'] = $lighthouse_result['requestedUrl'];
        }
        if (isset($lighthouse_result['finalUrl'])) {
            $lighthouse_info['finalUrl'] = $lighthouse_result['finalUrl'];
        }
        if (isset($lighthouse_result['lighthouseVersion'])) {
            $lighthouse_info['lighthouseVersion'] = $lighthouse_result['lighthouseVersion'];
        }
        if (isset($lighthouse_result['fetchTime'])) {
            $lighthouse_info['fetchTime'] = $lighthouse_result['fetchTime'];
        }
        if (isset($lighthouse_result['environment'])) {
            $lighthouse_info['environment'] = $lighthouse_result['environment'];
        }
        if (isset($lighthouse_result['runWarnings'])) {
            $lighthouse_info['runWarnings'] = array_slice($lighthouse_result['runWarnings'], 0, 10);
        }
        
        return array(
            'url' => $data['id'] ?? '',
            'strategy' => $this->extract_strategy_from_data($data),
            'scores' => $scores,
            'core_web_vitals' => $core_web_vitals,
            'opportunities' => $opportunities,
            'diagnostics' => $diagnostics,
            'audits' => $processed_audits,
            'loading_experience' => $loading_experience,
            'origin_loading_experience' => $origin_loading_experience,
            'lighthouse' => $lighthouse_info,
            'timestamp' => time(),
            'analysis_timestamp' => $data['analysisUTCTimestamp'] ?? null
        );
    }
    
    /**
     * Extract strategy from PageSpeed data
     */
    private function extract_strategy_from_data($data) {
        // Try to determine strategy from the data
        if (isset($data['lighthouseResult']['configSettings']['emulatedFormFactor'])) {
            return $data['lighthouseResult']['configSettings']['emulatedFormFactor'];
        }
        
        // Check the original request for strategy
        if (isset($data['captchaResult'])) {
            // The captchaResult field sometimes contains strategy info, but it's misleading
            // Let's default to mobile for now
        }
        
        // Default to mobile
        return 'mobile';
    }
    
    /**
     * SERP Analysis
     */
    private function get_serp_analysis($args) {
        $keyword = sanitize_text_field($args['keyword']);
        $location_code = intval($args['location_code'] ?? 2840);
        $language_code = sanitize_text_field($args['language_code'] ?? 'en');
        $device = sanitize_text_field($args['device'] ?? 'desktop');
        
        if (empty($keyword)) {
            throw new Exception('Keyword is required for SERP analysis');
        }
        
        $endpoint = '/serp/google/organic/live/advanced';
        $request_data = array(
            array(
                'keyword' => $keyword,
                'location_code' => $location_code,
                'language_code' => $language_code,
                'device' => $device,
                'os' => $device === 'mobile' ? 'android' : 'windows',
                'calculate_rectangles' => false,
                'browser_screen_width' => $device === 'mobile' ? 360 : 1920,
                'browser_screen_height' => $device === 'mobile' ? 640 : 1080
            )
        );
        
        return $this->make_dataforseo_request($endpoint, $request_data);
    }
    
    /**
     * Keyword Difficulty
     */
    private function get_keyword_difficulty($args) {
        $keywords = array_map('sanitize_text_field', $args['keywords'] ?? array());
        $location_code = intval($args['location_code'] ?? 2840);
        $language_code = sanitize_text_field($args['language_code'] ?? 'en');
        
        if (empty($keywords)) {
            throw new Exception('Keywords array is required');
        }
        
        if (count($keywords) > 1000) {
            throw new Exception('Maximum 1000 keywords allowed');
        }
        
        // Use Google Ads search volume endpoint for keyword data including competition metrics
        $endpoint = '/keywords_data/google_ads/search_volume/live';
        $request_data = array(
            array(
                'keywords' => $keywords,
                'location_code' => $location_code,
                'language_code' => $language_code,
                'include_adult_keywords' => false,
                'sort_by' => 'search_volume'
                // Note: removed date_from/date_to to use default 12-month data
            )
        );
        
        return $this->make_dataforseo_request($endpoint, $request_data);
    }
    
    /**
     * Domain Analysis
     */
    private function get_domain_analysis($args) {
        $domain = sanitize_text_field($args['domain']);
        $analysis_type = sanitize_text_field($args['analysis_type'] ?? 'overview');
        $location_code = intval($args['location_code'] ?? 2840);
        $language_code = sanitize_text_field($args['language_code'] ?? 'en');
        
        if (empty($domain)) {
            throw new Exception('Domain is required for domain analysis');
        }
        
        // Remove protocol and www from domain
        $domain = preg_replace('/^(https?:\/\/)?(www\.)?/', '', $domain);
        $domain = rtrim($domain, '/');
        
        switch ($analysis_type) {
            case 'overview':
                $endpoint = '/dataforseo_labs/google/ranked_keywords/live';
                $request_data = array(
                    array(
                        'target' => $domain,
                        'location_code' => $location_code,
                        'language_code' => $language_code,
                        'item_types' => array('organic'),
                        'include_clickstream_data' => true,
                        'limit' => 1000
                        // Note: removed filters to test basic functionality first
                    )
                );
                break;
            case 'backlinks':
                $endpoint = '/backlinks/overview/live';
                $request_data = array(
                    array(
                        'target' => $domain,
                        'internal_list_limit' => 10,
                        'include_subdomains' => true,
                        'backlinks_status_type' => 'live'
                    )
                );
                break;
            case 'organic_keywords':
                $endpoint = '/dataforseo_labs/google/ranked_keywords/live';
                $request_data = array(
                    array(
                        'target' => $domain,
                        'location_code' => $location_code,
                        'language_code' => $language_code,
                        'item_types' => array('organic'),
                        'limit' => 1000,
                        'filters' => array(
                            array('position', '<=', 100)
                        )
                    )
                );
                break;
            default:
                throw new Exception('Invalid analysis type. Supported types: overview, backlinks, organic_keywords');
        }
        
        return $this->make_dataforseo_request($endpoint, $request_data);
    }
    
    /**
     * Competitor Analysis
     */
    private function get_competitor_analysis($args) {
        $domain = sanitize_text_field($args['domain']);
        $limit = intval($args['limit'] ?? 10);
        $location_code = intval($args['location_code'] ?? 2840);
        
        if (empty($domain)) {
            throw new Exception('Domain is required for competitor analysis');
        }
        
        // Remove protocol and www from domain
        $domain = preg_replace('/^(https?:\/\/)?(www\.)?/', '', $domain);
        $domain = rtrim($domain, '/');
        
        $endpoint = '/dataforseo_labs/google/competitors_domain/live';
        
        // Build request data - competitors_domain endpoint doesn't support language parameters
        // EXPLICITLY exclude language parameters to prevent API errors
        $request_data = array(
            array(
                'target' => $domain,
                'location_code' => $location_code,
                'item_types' => array('organic'),
                'include_clickstream_data' => true,
                'limit' => min($limit, 100),
                'offset' => 0,
                'filters' => array(
                    array('intersections', '>', 10) // Only competitors with meaningful overlap
                ),
                'order_by' => array('intersections,desc')
            )
        );
        
        return $this->make_dataforseo_request($endpoint, $request_data);
    }
    
    /**
     * Technical Audit
     */
    private function get_technical_audit($args) {
        $url = esc_url_raw($args['url']);
        $audit_type = sanitize_text_field($args['audit_type'] ?? 'lighthouse');
        $device = sanitize_text_field($args['device'] ?? 'desktop');
        
        if (empty($url)) {
            throw new Exception('URL is required for technical audit');
        }
        
        // Validate URL format
        if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('/^https?:\/\//', $url)) {
            throw new Exception('Invalid URL format. URL must include http:// or https://');
        }
        
        switch ($audit_type) {
            case 'lighthouse':
                $endpoint = '/on_page/lighthouse/live/json';
                $request_data = array(
                    array(
                        'url' => $url,
                        'for_mobile' => ($device === 'mobile'),
                        'categories' => array('performance', 'accessibility', 'best_practices', 'seo'),
                        // Note: 'audits' parameter is not supported in live/json endpoint
                        'language_code' => 'en'
                    )
                );
                break;
            case 'page_speed':
                $endpoint = '/on_page/page_screenshot/live';
                $request_data = array(
                    array(
                        'url' => $url,
                        'accept_language' => 'en-US,en;q=0.9',
                        'browser_preset' => $device === 'mobile' ? 'mobile' : 'desktop'
                    )
                );
                break;
            case 'crawl':
                $endpoint = '/on_page/instant_pages/live';
                $request_data = array(
                    array(
                        'url' => $url,
                        'custom_user_agent' => 'Mozilla/5.0 (compatible; DataForSEO/1.0)',
                        'browser_preset' => $device === 'mobile' ? 'mobile' : 'desktop'
                    )
                );
                break;
            default:
                throw new Exception('Invalid audit type. Supported types: lighthouse, page_speed, crawl');
        }
        
        return $this->make_dataforseo_request($endpoint, $request_data);
    }
    
    /**
     * Get available locations
     */
    private function get_locations() {
        $endpoint = '/serp/google/locations';
        
        // DataForSEO locations endpoint doesn't require request body data
        // But we still need to make a POST request with empty body or GET
        $response = wp_remote_get($this->base_url . $endpoint, array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($this->dataforseo_login . ':' . $this->dataforseo_api_key),
                'Content-Type' => 'application/json',
            ),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('DataForSEO locations request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 401) {
            throw new Exception('DataForSEO API authentication failed. Please check your login and API key.');
        }
        
        if ($status_code !== 200) {
            throw new Exception('DataForSEO locations API returned error: HTTP ' . $status_code);
        }
        
        $result = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response from DataForSEO locations API');
        }
        
        if (isset($result['status_code']) && $result['status_code'] !== 20000) {
            throw new Exception('DataForSEO locations API error: ' . ($result['status_message'] ?? 'Unknown error'));
        }
        
        return $this->process_dataforseo_response($result);
    }
    
    /**
     * Filter parameters based on endpoint requirements
     */
    private function filter_endpoint_parameters($endpoint, $data) {
        // Define supported parameters for each endpoint
        $endpoint_params = array(
            '/dataforseo_labs/google/competitors_domain/live' => array(
                'target', 'location_code', 'location_name', 'item_types', 
                'include_clickstream_data', 'filters', 'limit', 'offset', 
                'max_rank_group', 'order_by', 'exclude_top_domains', 
                'intersecting_domains', 'ignore_synonyms', 'tag'
            ),
            '/on_page/lighthouse/live/json' => array(
                'url', 'for_mobile', 'categories', 'version', 
                'language_name', 'language_code', 'tag'
            ),
            '/dataforseo_labs/google/ranked_keywords/live' => array(
                'target', 'location_code', 'location_name', 'language_code', 
                'language_name', 'ignore_synonyms', 'include_clickstream_data', 
                'item_types', 'limit', 'offset', 'load_rank_absolute', 
                'historical_serp_mode', 'filters', 'order_by', 'tag'
            ),
            '/keywords_data/google_ads/search_volume/live' => array(
                'keywords', 'location_code', 'location_name', 'location_coordinate',
                'language_code', 'language_name', 'search_partners', 'date_from', 
                'date_to', 'include_adult_keywords', 'sort_by', 'tag'
            )
        );
        
        if (!isset($endpoint_params[$endpoint])) {
            return $data; // No filtering if endpoint not found
        }
        
        $allowed_params = $endpoint_params[$endpoint];
        $filtered_data = array();
        
        foreach ($data as $request_item) {
            $filtered_item = array();
            foreach ($request_item as $key => $value) {
                if (in_array($key, $allowed_params)) {
                    $filtered_item[$key] = $value;
                }
            }
            $filtered_data[] = $filtered_item;
        }
        
        return $filtered_data;
    }
    
    /**
     * Make request to DataForSEO API
     */
    private function make_dataforseo_request($endpoint, $data) {
        // Check if credentials are configured
        if (empty($this->dataforseo_login) || empty($this->dataforseo_api_key)) {
            throw new Exception('DataForSEO API credentials not configured. Please configure them in Settings > MagicProxy.');
        }
        
        // Check for placeholder credentials
        if ($this->dataforseo_login === 'your-dataforseo-login' || $this->dataforseo_api_key === 'your-dataforseo-api-key') {
            throw new Exception('DataForSEO API credentials are set to default placeholder values. Please update them in Settings > MagicProxy.');
        }
        
        // AGGRESSIVE filtering for competitors_domain endpoint to prevent language parameter issues
        if ($endpoint === '/dataforseo_labs/google/competitors_domain/live') {
            $cleaned_data = array();
            foreach ($data as $request_item) {
                $clean_item = array();
                // Only allow explicitly safe parameters for competitors_domain
                $allowed_fields = array('target', 'location_code', 'item_types', 'include_clickstream_data', 'filters', 'limit', 'offset', 'order_by');
                foreach ($request_item as $key => $value) {
                    if (in_array($key, $allowed_fields)) {
                        $clean_item[$key] = $value;
                    }
                }
                $cleaned_data[] = $clean_item;
            }
            $data = $cleaned_data;
            
        } else {
            // Filter parameters to only include those supported by the endpoint for other endpoints
            $data = $this->filter_endpoint_parameters($endpoint, $data);
        }
        
        $url = $this->base_url . $endpoint;
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($this->dataforseo_login . ':' . $this->dataforseo_api_key),
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode($data),
            'timeout' => 60
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('DataForSEO API request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 401) {
            throw new Exception('DataForSEO API authentication failed. Please check your login and API key in Settings > MagicProxy.');
        }
        
        if ($status_code !== 200) {
            $error_details = '';
            if (!empty($body)) {
                $decoded_body = json_decode($body, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded_body['status_message'])) {
                    $error_details = ' - ' . $decoded_body['status_message'];
                }
            }
            
            throw new Exception('DataForSEO API returned error: HTTP ' . $status_code . $error_details);
        }
        
        $result = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response from DataForSEO API');
        }
        
        if (isset($result['status_code']) && $result['status_code'] !== 20000) {
            throw new Exception('DataForSEO API error: ' . ($result['status_message'] ?? 'Unknown error'));
        }
        
        return $this->process_dataforseo_response($result);
    }
    
    /**
     * Process DataForSEO API response and ensure consistent format
     */
    private function process_dataforseo_response($result) {
        // Ensure we have the expected structure
        if (!isset($result['tasks']) || !is_array($result['tasks'])) {
            // If no tasks array, wrap the result in the expected format
            return array(
                'tasks' => array(
                    array(
                        'result' => array($result)
                    )
                ),
                'status_code' => $result['status_code'] ?? 20000,
                'status_message' => $result['status_message'] ?? 'Success',
                'cost' => $result['cost'] ?? 0,
                'time' => $result['time'] ?? '0',
                'version' => $result['version'] ?? '1.0'
            );
        }
        
        return $result;
    }
    
    /**
     * Check if domain is allowed to use the proxy
     */
    private function is_allowed_domain($site_url) {
        // For development/testing, allow all domains
        // You can implement whitelist/blacklist logic here
        // For now, allow all domains in production too
        return true;
        
        // Example whitelist implementation:
        // $allowed_domains = get_option('magicproxy_allowed_domains', array());
        // $domain = parse_url($site_url, PHP_URL_HOST);
        // return in_array($domain, $allowed_domains);
    }
    
    /**
     * Rate limiting check
     */
    private function check_rate_limit($site_id) {
        $transient_key = 'magicproxy_rate_' . md5($site_id);
        $requests = get_transient($transient_key) ?: 0;
        
        // More permissive rate limiting for testing - 500 requests per hour per site
        if ($requests >= 500) {
            return false;
        }
        
        set_transient($transient_key, $requests + 1, HOUR_IN_SECONDS);

        return true;
    }
    
    /**
     * Log requests for monitoring
     */
    private function log_request($site_id, $action, $success, $error = null) {
        $log_entry = array(
            'site_id' => $site_id,
            'action' => $action,
            'success' => $success,
            'error' => $error,
            'timestamp' => current_time('mysql'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        );
        
        // Store in database or log file
        // For simplicity, using WordPress error log
        error_log('[MagicProxy] ' . wp_json_encode($log_entry));
    }
    
    /**
     * Get proxy status
     */
    public function get_status($request) {
        return array(
            'status' => 'operational',
            'timestamp' => time(),
            'version' => '1.0.0'
        );
    }
    
    /**
     * Simple test endpoint to verify proxy connectivity
     */
    public function test_proxy($request) {
        $method = $request->get_method();
        $data = $request->get_json_params();
        
        return array(
            'success' => true,
            'message' => 'MagicProxy is working!',
            'method' => $method,
            'timestamp' => time(),
            'received_data' => $data,
            'server_time' => current_time('mysql'),
            'wp_debug' => defined('WP_DEBUG') && WP_DEBUG,
            'credentials_configured' => array(
                'dataforseo_login' => !empty($this->dataforseo_login),
                'dataforseo_api_key' => !empty($this->dataforseo_api_key),
                'pagespeed_api_key' => !empty($this->pagespeed_api_key)
            )
        );
    }
    
    /**
     * Test competitor analysis with minimal request
     */
    public function test_competitor_analysis($request) {
        if (empty($this->dataforseo_login) || empty($this->dataforseo_api_key)) {
            return array(
                'error' => 'DataForSEO credentials not configured'
            );
        }
        
        // Send absolutely minimal request to competitors_domain endpoint
        $endpoint = '/dataforseo_labs/google/competitors_domain/live';
        $url = $this->base_url . $endpoint;
        
        $minimal_data = array(
            array(
                'target' => 'kasoria.com',
                'location_code' => 2276,
                'item_types' => array('organic'),
                'limit' => 5
            )
        );
        
        error_log('[MagicProxy TEST] Sending minimal competitor request: ' . wp_json_encode($minimal_data));
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($this->dataforseo_login . ':' . $this->dataforseo_api_key),
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode($minimal_data),
            'timeout' => 60
        ));
        
        if (is_wp_error($response)) {
            return array(
                'error' => 'Request failed: ' . $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        error_log('[MagicProxy TEST] Response status: ' . $status_code);
        error_log('[MagicProxy TEST] Response body: ' . substr($body, 0, 1000));
        
        return array(
            'test_endpoint' => $url,
            'request_data' => $minimal_data,
            'status_code' => $status_code,
            'response_body' => $body
        );
    }
    
    /**
     * Test PageSpeed API connectivity and configuration
     */
    public function test_pagespeed($request) {
        $test_url = $request->get_param('url') ?: 'https://example.com';
        
        // Check API key configuration
        if (empty($this->pagespeed_api_key)) {
            return array(
                'error' => 'PageSpeed Insights API key not configured',
                'instructions' => 'Please configure your Google PageSpeed Insights API key in Settings > MagicProxy'
            );
        }
        
        // Test basic Google PageSpeed API connectivity with a simple request
        $api_url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
        $query_params = array(
            'url' => $test_url,
            'strategy' => 'mobile',
            'key' => $this->pagespeed_api_key,
            'category' => array('performance') // Only test performance to minimize response time
        );
        
        $request_url = add_query_arg($query_params, $api_url);
        
        error_log('[MagicProxy PageSpeed TEST] Testing URL: ' . $test_url);
        error_log('[MagicProxy PageSpeed TEST] Request URL: ' . $request_url);
        
        $start_time = microtime(true);
        
        $response = wp_remote_get($request_url, array(
            'timeout' => 30, // Shorter timeout for testing
            'headers' => array(
                'User-Agent' => 'MagicProxy/1.0 Test'
            )
        ));
        
        $end_time = microtime(true);
        $request_duration = round($end_time - $start_time, 2);
        
        if (is_wp_error($response)) {
            error_log('[MagicProxy PageSpeed TEST] Request failed: ' . $response->get_error_message());
            return array(
                'success' => false,
                'error' => 'Request failed: ' . $response->get_error_message(),
                'test_url' => $test_url,
                'request_duration' => $request_duration,
                'api_key_configured' => !empty($this->pagespeed_api_key)
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        error_log('[MagicProxy PageSpeed TEST] Response status: ' . $status_code);
        error_log('[MagicProxy PageSpeed TEST] Request duration: ' . $request_duration . ' seconds');
        
        if ($status_code !== 200) {
            $error_data = json_decode($body, true);
            $error_message = 'HTTP ' . $status_code;
            
            if ($error_data && isset($error_data['error']['message'])) {
                $error_message .= ': ' . $error_data['error']['message'];
            }
            
            return array(
                'success' => false,
                'error' => $error_message,
                'status_code' => $status_code,
                'test_url' => $test_url,
                'request_duration' => $request_duration,
                'api_key_configured' => !empty($this->pagespeed_api_key),
                'response_body' => substr($body, 0, 500)
            );
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return array(
                'success' => false,
                'error' => 'Invalid JSON response',
                'test_url' => $test_url,
                'request_duration' => $request_duration,
                'api_key_configured' => !empty($this->pagespeed_api_key)
            );
        }
        
        // Extract basic info from response
        $performance_score = null;
        if (isset($data['lighthouseResult']['categories']['performance']['score'])) {
            $performance_score = round($data['lighthouseResult']['categories']['performance']['score'] * 100);
        }
        
        return array(
            'success' => true,
            'message' => 'PageSpeed API is working correctly',
            'test_url' => $test_url,
            'request_duration' => $request_duration,
            'performance_score' => $performance_score,
            'api_key_configured' => !empty($this->pagespeed_api_key),
            'lighthouse_version' => $data['lighthouseResult']['lighthouseVersion'] ?? 'unknown'
        );
    }
    
    /**
     * Add admin menu for managing proxy settings
     */
    public function add_admin_menu() {
        add_options_page(
            'MagicProxy Settings',
            'MagicProxy',
            'manage_options',
            'magic-proxy',
            array($this, 'admin_page')
        );
    }
    
    /**
     * Admin page for proxy settings
     */
    public function admin_page() {
        if (isset($_POST['submit']) && check_admin_referer('magicproxy_settings', '_wpnonce')) {
            // Handle settings update
            $login = sanitize_text_field($_POST['dataforseo_login']);
            $api_key = sanitize_text_field($_POST['dataforseo_api_key']);
            $pagespeed_key = sanitize_text_field($_POST['pagespeed_api_key']);
            
            update_option('magicproxy_dataforseo_login', $login);
            update_option('magicproxy_dataforseo_api_key', $api_key);
            update_option('magicproxy_pagespeed_api_key', $pagespeed_key);
            
            $this->dataforseo_login = $login;
            $this->dataforseo_api_key = $api_key;
            $this->pagespeed_api_key = $pagespeed_key;
            
            echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
        }
        ?>
        <div class="wrap">
            <h1>MagicProxy Settings</h1>
            <p>Configure your API credentials for the proxy service.</p>
            
            <form method="post">
                <?php wp_nonce_field('magicproxy_settings', '_wpnonce'); ?>
                
                <h2>DataForSEO API Settings</h2>
                <p>Configure your DataForSEO credentials for SEO analysis features.</p>
                <table class="form-table">
                    <tr>
                        <th scope="row">DataForSEO Login</th>
                        <td>
                            <input type="text" name="dataforseo_login" value="<?php echo esc_attr($this->dataforseo_login); ?>" class="regular-text" required />
                            <p class="description">Your DataForSEO login email</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">DataForSEO API Key</th>
                        <td>
                            <input type="password" name="dataforseo_api_key" value="<?php echo esc_attr($this->dataforseo_api_key); ?>" class="regular-text" required />
                            <p class="description">Your DataForSEO API key</p>
                        </td>
                    </tr>
                </table>
                
                <h2>Google PageSpeed Insights API Settings</h2>
                <p>Configure your Google PageSpeed Insights API key for performance analysis features.</p>
                <table class="form-table">
                    <tr>
                        <th scope="row">PageSpeed Insights API Key</th>
                        <td>
                            <input type="password" name="pagespeed_api_key" value="<?php echo esc_attr($this->pagespeed_api_key); ?>" class="regular-text" />
                            <p class="description">
                                Your Google PageSpeed Insights API key. Get one from the 
                                <a href="https://developers.google.com/speed/docs/insights/v5/get-started#APIKey" target="_blank">Google Cloud Console</a>.
                                <br><strong>Required for:</strong> PageSpeed analysis, Core Web Vitals testing, performance insights.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <h2>API Usage Statistics</h2>
            <p>Monitor proxy usage and requests from MagicAssistant installations.</p>
            
            <?php
            // Display basic stats
            $logs = $this->get_recent_logs();
            if (!empty($logs)) {
                echo '<h3>Recent Requests (Last 24 hours)</h3>';
                echo '<table class="wp-list-table widefat fixed striped">';
                echo '<thead><tr><th>Time</th><th>Site</th><th>Action</th><th>Status</th></tr></thead>';
                echo '<tbody>';
                foreach ($logs as $log) {
                    $status = $log['success'] ? '<span style="color: green;">✓ Success</span>' : '<span style="color: red;">✗ Failed</span>';
                    echo '<tr>';
                    echo '<td>' . esc_html($log['timestamp']) . '</td>';
                    echo '<td>' . esc_html(substr($log['site_id'], 0, 16)) . '...</td>';
                    echo '<td>' . esc_html($log['action']) . '</td>';
                    echo '<td>' . $status . '</td>';
                    echo '</tr>';
                }
                echo '</tbody></table>';
            } else {
                echo '<p>No recent requests found.</p>';
            }
            ?>
        </div>
        <?php
    }
    
    /**
     * Get recent log entries (simplified for demo)
     */
    private function get_recent_logs() {
        // In a real implementation, you'd store logs in database
        // For now, return empty array
        return array();
    }
}

// Initialize the proxy
new MagicProxy(); 