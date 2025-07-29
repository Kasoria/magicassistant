<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * PageSpeed Service Class
 * 
 * Handles PageSpeed Insights API requests through MagicProxy
 * Ensures data is saved ONLY to 'pagespeed_data' database key
 * Filters out base64 images and filmstrip data to prevent large data storage
 */
class PageSpeed_Service {
    
    private $ai_provider;
    private $db;
    private $timeout = 75;
    
    public function __construct($ai_provider = null) {
        $this->ai_provider = $ai_provider;
        $this->db = $ai_provider ? $ai_provider->get_db() : null;
    }
    
    /**
     * Check if PageSpeed service is available
     */
    public function is_available() {
        // Check if we have the necessary components
        return $this->ai_provider && $this->db;
    }
    
    /**
     * Handle PageSpeed analysis request
     * This method ensures data is saved ONLY to pagespeed_data, never to seo_data
     */
    public function handle_pagespeed_analysis($args) {
        try {
            // Set default URL to home URL if not provided
            if (empty($args['url'])) {
                $args['url'] = home_url();
            }
            
            // Validate URL format
            if (!filter_var($args['url'], FILTER_VALIDATE_URL)) {
                throw new \Exception('Invalid URL format: ' . $args['url']);
            }
            
            // Add default parameters if missing
            $args = array_merge(array(
                'strategy' => 'mobile',
                'category' => array('performance', 'accessibility', 'best-practices', 'seo'),
                'locale' => 'en'
            ), $args);
            
            // Make PageSpeed request through MagicProxy
            $result = $this->make_pagespeed_request($args);
            
            if (!$result || isset($result['error'])) {
                throw new \Exception($result['error'] ?? 'PageSpeed analysis failed');
            }
            
            // Process and filter the results to remove base64 data
            $processed_result = $this->process_and_filter_pagespeed_data($result);
            
            // Save data ONLY to pagespeed_data (never to seo_data)
            $this->save_pagespeed_data_to_db($processed_result, $args);
            
            return $processed_result;
            
        } catch (\Exception $e) {
            throw new \Exception('PageSpeed analysis failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Make PageSpeed request through MagicProxy
     */
    private function make_pagespeed_request($args) {
        if (!$this->ai_provider || !$this->db) {
            throw new \Exception('PageSpeed service not properly initialized');
        }
        
        $proxy_url = 'https://magicplugins.io/wp-json/magicproxy/v1/pagespeed';
        
        $site_url = home_url();
        $site_id = parse_url($site_url, PHP_URL_HOST);
        $timestamp = time();
        
        // Create signature for authentication
        $signature_data = array(
            'site_id' => $site_id,
            'timestamp' => $timestamp,
            'action' => 'analyze'
        );
        $signature = hash_hmac('sha256', wp_json_encode($signature_data), $site_id);
        
        $request_data = array(
            'action' => 'analyze',
            'data' => $args,
            'auth' => array(
                'site_id' => $site_id,
                'signature' => $signature
            ),
            'site_url' => $site_url,
            'timestamp' => $timestamp
        );
        
        // Debug logging for troubleshooting
        if (function_exists('error_log')) {
        }
        
        $response = wp_remote_post($proxy_url, array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'MagicAssistant/1.0'
            ),
            'body' => wp_json_encode($request_data),
            'timeout' => $this->timeout
        ));
        
        if (is_wp_error($response)) {
            throw new \Exception('PageSpeed proxy request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        // Debug logging for troubleshooting
        if (function_exists('error_log')) {
        }
        
        if ($status_code !== 200) {
            $error_message = "PageSpeed proxy returned HTTP {$status_code}";
            if (!empty($body)) {
                $decoded_body = json_decode($body, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded_body['message'])) {
                    $error_message .= ': ' . $decoded_body['message'];
                } else {
                    $error_message .= ': ' . substr($body, 0, 200);
                }
            }
            throw new \Exception($error_message);
        }
        
        $result = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from PageSpeed proxy: ' . json_last_error_msg());
        }
        
        if (!isset($result['success']) || !$result['success']) {
            $error_message = 'PageSpeed proxy request failed';
            if (isset($result['message'])) {
                $error_message .= ': ' . $result['message'];
            }
            if (isset($result['error'])) {
                $error_message .= ' (Error: ' . $result['error'] . ')';
            }
            throw new \Exception($error_message);
        }
        
        return $result['data'] ?? array();
    }
    
    /**
     * Process and filter PageSpeed data to remove base64 images and large binary content
     */
    private function process_and_filter_pagespeed_data($raw_data) {
        if (!is_array($raw_data)) {
            return array();
        }
        
        // Create a clean structure for PageSpeed data
        $processed = array(
            'url' => $raw_data['url'] ?? '',
            'strategy' => $raw_data['strategy'] ?? 'mobile',
            'scores' => array(),
            'coreWebVitals' => array(),
            'opportunities' => array(),
            'diagnostics' => array(),
            'audits' => array(),
            'loadingExperience' => array(),
            'originLoadingExperience' => array(),
            'lighthouse' => array(),
            'lastUpdated' => current_time('mysql'),
            'timestamp' => time(),
            'analysisTimestamp' => $raw_data['analysis_timestamp'] ?? null
        );
        
        // Extract and clean scores
        if (isset($raw_data['scores']) && is_array($raw_data['scores'])) {
            foreach ($raw_data['scores'] as $category => $score_data) {
                if (is_array($score_data)) {
                    $processed['scores'][$category] = array(
                        'score' => intval($score_data['score'] ?? 0),
                        'title' => sanitize_text_field($score_data['title'] ?? $category)
                    );
                }
            }
        }
        
        // Extract and clean Core Web Vitals (no base64 data here typically)
        if (isset($raw_data['core_web_vitals']) && is_array($raw_data['core_web_vitals'])) {
            foreach ($raw_data['core_web_vitals'] as $metric => $vital_data) {
                if (is_array($vital_data)) {
                    $processed['coreWebVitals'][$metric] = array(
                        'value' => floatval($vital_data['value'] ?? 0),
                        'displayValue' => sanitize_text_field($vital_data['displayValue'] ?? 'N/A'),
                        'score' => isset($vital_data['score']) ? floatval($vital_data['score']) : null,
                        'title' => sanitize_text_field($vital_data['title'] ?? $metric)
                    );
                }
            }
        }
        
        // Extract and clean opportunities (filter out any base64 content)
        if (isset($raw_data['opportunities']) && is_array($raw_data['opportunities'])) {
            foreach ($raw_data['opportunities'] as $opportunity) {
                if (is_array($opportunity)) {
                    $clean_opportunity = array(
                        'id' => sanitize_text_field($opportunity['id'] ?? ''),
                        'title' => sanitize_text_field($opportunity['title'] ?? ''),
                        'description' => sanitize_textarea_field($opportunity['description'] ?? ''),
                        'score' => isset($opportunity['score']) ? floatval($opportunity['score']) : null,
                        'displayValue' => sanitize_text_field($opportunity['displayValue'] ?? '')
                    );
                    
                    // Add savings information if available (excluding any base64 data)
                    if (isset($opportunity['overallSavingsMs'])) {
                        $clean_opportunity['overallSavingsMs'] = intval($opportunity['overallSavingsMs']);
                    }
                    if (isset($opportunity['overallSavingsBytes'])) {
                        $clean_opportunity['overallSavingsBytes'] = intval($opportunity['overallSavingsBytes']);
                    }
                    
                    $processed['opportunities'][] = $clean_opportunity;
                }
            }
        }
        
        // Extract and clean diagnostics
        if (isset($raw_data['diagnostics']) && is_array($raw_data['diagnostics'])) {
            foreach ($raw_data['diagnostics'] as $diagnostic) {
                if (is_array($diagnostic)) {
                    $clean_diagnostic = array(
                        'id' => sanitize_text_field($diagnostic['id'] ?? ''),
                        'title' => sanitize_text_field($diagnostic['title'] ?? ''),
                        'description' => sanitize_textarea_field($diagnostic['description'] ?? ''),
                        'score' => isset($diagnostic['score']) ? floatval($diagnostic['score']) : null,
                        'displayValue' => sanitize_text_field($diagnostic['displayValue'] ?? ''),
                        'scoreDisplayMode' => sanitize_text_field($diagnostic['scoreDisplayMode'] ?? 'numeric')
                    );
                    
                    // Add numericValue if available
                    if (isset($diagnostic['numericValue'])) {
                        $clean_diagnostic['numericValue'] = floatval($diagnostic['numericValue']);
                    }
                    
                    $processed['diagnostics'][] = $clean_diagnostic;
                }
            }
        }
        
        // Extract essential audits data (heavily filtered to exclude base64 content)
        if (isset($raw_data['audits']) && is_array($raw_data['audits'])) {
            foreach ($raw_data['audits'] as $audit_id => $audit_data) {
                if (is_array($audit_data)) {
                    $clean_audit = array(
                        'title' => sanitize_text_field($audit_data['title'] ?? $audit_id),
                        'description' => sanitize_textarea_field($audit_data['description'] ?? ''),
                        'score' => isset($audit_data['score']) ? floatval($audit_data['score']) : null,
                        'displayValue' => sanitize_text_field($audit_data['displayValue'] ?? ''),
                        'scoreDisplayMode' => sanitize_text_field($audit_data['scoreDisplayMode'] ?? 'numeric')
                    );
                    
                    // Add numericValue if available
                    if (isset($audit_data['numericValue'])) {
                        $clean_audit['numericValue'] = floatval($audit_data['numericValue']);
                    }
                    
                    // Filter details to exclude base64 data
                    if (isset($audit_data['details']) && is_array($audit_data['details'])) {
                        $clean_audit['details'] = $this->filter_base64_from_array($audit_data['details']);
                    }
                    
                    $processed['audits'][$audit_id] = $clean_audit;
                }
            }
        }
        
        // Extract loading experience data (filter out any potential base64 content)
        if (isset($raw_data['loading_experience']) && is_array($raw_data['loading_experience'])) {
            $processed['loadingExperience'] = $this->filter_base64_from_array($raw_data['loading_experience']);
        }
        
        if (isset($raw_data['origin_loading_experience']) && is_array($raw_data['origin_loading_experience'])) {
            $processed['originLoadingExperience'] = $this->filter_base64_from_array($raw_data['origin_loading_experience']);
        }
        
        // Extract lighthouse metadata (exclude large data like filmstrip)
        if (isset($raw_data['lighthouse']) && is_array($raw_data['lighthouse'])) {
            $lighthouse = $raw_data['lighthouse'];
            $processed['lighthouse'] = array(
                'requestedUrl' => sanitize_url($lighthouse['requestedUrl'] ?? ''),
                'finalUrl' => sanitize_url($lighthouse['finalUrl'] ?? ''),
                'lighthouseVersion' => sanitize_text_field($lighthouse['lighthouseVersion'] ?? ''),
                'fetchTime' => sanitize_text_field($lighthouse['fetchTime'] ?? ''),
                'environment' => isset($lighthouse['environment']) && is_array($lighthouse['environment']) 
                    ? array_map('sanitize_text_field', $lighthouse['environment']) 
                    : array(),
                'runWarnings' => isset($lighthouse['runWarnings']) && is_array($lighthouse['runWarnings'])
                    ? array_map('sanitize_text_field', array_slice($lighthouse['runWarnings'], 0, 10))
                    : array()
            );
        }
        
        return $processed;
    }
    
    /**
     * Recursively filter base64 image data and large binary content from arrays
     */
    private function filter_base64_from_array($data) {
        if (!is_array($data)) {
            if (is_string($data)) {
                // Filter out base64 image data, filmstrip frames, and other large binary content
                if (preg_match('/^data:image\/[^;]+;base64,/', $data) || 
                    (strlen($data) > 10000 && base64_decode($data, true) !== false)) {
                    return '[FILTERED: Base64 image/binary data removed]';
                }
                // Filter out specific filmstrip/screenshot fields
                if (strpos($data, 'data:image/') === 0 || 
                    (strlen($data) > 5000 && (
                        strpos($data, 'screenshot') !== false || 
                        strpos($data, 'filmstrip') !== false ||
                        preg_match('/^[A-Za-z0-9+\/]{1000,}={0,2}$/', $data)
                    ))) {
                    return '[FILTERED: Large image data removed]';
                }
            }
            return $data;
        }
        
        $filtered = array();
        foreach ($data as $key => $value) {
            // Skip known problematic keys that contain base64 data but keep essential ones
            $skip_keys = array('screenshot', 'filmstrip', 'thumbnails');
            if (in_array($key, $skip_keys)) {
                continue;
            }
            
            // Special handling for details arrays
            if ($key === 'details' && is_array($value)) {
                $filtered_details = array();
                foreach ($value as $detail_key => $detail_value) {
                    // Keep essential detail fields but filter out large data
                    if (is_string($detail_value) && (
                        strlen($detail_value) > 5000 || 
                        preg_match('/^data:image/', $detail_value) ||
                        (strlen($detail_value) > 1000 && base64_decode($detail_value, true) !== false)
                    )) {
                        continue; // Skip large binary data
                    }
                    
                    if (is_array($detail_value)) {
                        $filtered_details[$detail_key] = $this->filter_base64_from_array($detail_value);
                    } else {
                        $filtered_details[$detail_key] = $detail_value;
                    }
                }
                $filtered[$key] = $filtered_details;
            } elseif (is_array($value)) {
                $filtered[$key] = $this->filter_base64_from_array($value);
            } else {
                $filtered[$key] = $this->filter_base64_from_array($value);
            }
        }
        
        return $filtered;
    }
    
    /**
     * Save PageSpeed data to database - ONLY to pagespeed_data, never to seo_data
     */
    private function save_pagespeed_data_to_db($result, $args) {
        if (!$this->ai_provider || !$this->ai_provider->get_db()) {
            return false;
        }
        
        $user_id = get_current_user_id();
        
        // Ensure we're saving to the correct database key
        $pagespeed_data = array(
            'url' => $args['url'] ?? '',
            'strategy' => $args['strategy'] ?? 'mobile',
            'scores' => $result['scores'] ?? array(),
            'coreWebVitals' => $result['coreWebVitals'] ?? array(),
            'opportunities' => $result['opportunities'] ?? array(),
            'diagnostics' => $result['diagnostics'] ?? array(),
            'audits' => $result['audits'] ?? array(),
            'loadingExperience' => $result['loadingExperience'] ?? array(),
            'originLoadingExperience' => $result['originLoadingExperience'] ?? array(),
            'lighthouse' => $result['lighthouse'] ?? array(),
            'lastUpdated' => current_time('mysql'),
            'timestamp' => time(),
            'filtered' => true, // Flag to indicate base64 data was filtered
            'data_source' => 'google_pagespeed_insights'
        );
        
        // Save ONLY to pagespeed_data - this is critical!
        $this->db->save_user_setting('pagespeed_data', $pagespeed_data, $user_id);
        
        // IMPORTANT: Do NOT save to seo_data to prevent base64 pollution
        
        return true;
    }
    
    /**
     * Get stored PageSpeed data
     */
    public function get_stored_pagespeed_data($user_id = null) {
        if (!$this->db) {
            return array();
        }
        
        if (!$user_id) {
            $user_id = get_current_user_id();
        }
        
        return $this->db->get_user_setting('pagespeed_data', $user_id, array());
    }
    
    /**
     * Clear PageSpeed data
     */
    public function clear_pagespeed_data($user_id = null) {
        if (!$this->db) {
            return false;
        }
        
        if (!$user_id) {
            $user_id = get_current_user_id();
        }
        
        return $this->db->delete_setting('pagespeed_data', $user_id);
    }
    
    /**
     * Debug PageSpeed proxy connection and identify issues
     */
    public function debug_pagespeed_connection($test_url = null) {
        $debug_info = array(
            'proxy_url' => 'https://magicplugins.io/wp-json/magicproxy/v1/pagespeed',
            'test_url' => $test_url ?: home_url(),
            'site_url' => home_url(),
            'site_id' => parse_url(home_url(), PHP_URL_HOST),
            'timestamp' => time(),
            'tests' => array()
        );
        
        // Test 1: Basic proxy connectivity
        $debug_info['tests']['basic_connectivity'] = $this->test_basic_proxy_connectivity();
        
        // Test 2: Test endpoint specifically
        $debug_info['tests']['test_endpoint'] = $this->test_proxy_test_endpoint();
        
        // Test 3: PageSpeed test endpoint
        $debug_info['tests']['pagespeed_test_endpoint'] = $this->test_pagespeed_test_endpoint($test_url);
        
        // Test 4: Full PageSpeed request with authentication
        $debug_info['tests']['full_pagespeed_request'] = $this->test_full_pagespeed_request($test_url);
        
        return $debug_info;
    }
    
    /**
     * Test basic proxy connectivity
     */
    private function test_basic_proxy_connectivity() {
        $test_url = 'https://magicplugins.io/wp-json/magicproxy/v1/status';
        
        $response = wp_remote_get($test_url, array(
            'timeout' => 10,
            'headers' => array(
                'User-Agent' => 'MagicAssistant/Debug'
            )
        ));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => 'Request failed: ' . $response->get_error_message(),
                'url' => $test_url
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        return array(
            'success' => $status_code === 200,
            'status_code' => $status_code,
            'response_body' => substr($body, 0, 500),
            'url' => $test_url
        );
    }
    
    /**
     * Test proxy test endpoint
     */
    private function test_proxy_test_endpoint() {
        $test_url = 'https://magicplugins.io/wp-json/magicproxy/v1/test';
        
        $response = wp_remote_get($test_url, array(
            'timeout' => 10,
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'MagicAssistant/Debug'
            )
        ));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => 'Request failed: ' . $response->get_error_message(),
                'url' => $test_url
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        return array(
            'success' => $status_code === 200,
            'status_code' => $status_code,
            'response_body' => substr($body, 0, 500),
            'url' => $test_url
        );
    }
    
    /**
     * Test PageSpeed test endpoint  
     */
    private function test_pagespeed_test_endpoint($test_url = null) {
        $url_to_test = $test_url ?: 'https://example.com';
        $endpoint_url = 'https://magicplugins.io/wp-json/magicproxy/v1/test-pagespeed?url=' . urlencode($url_to_test);
        
        $response = wp_remote_get($endpoint_url, array(
            'timeout' => 30,
            'headers' => array(
                'User-Agent' => 'MagicAssistant/Debug'
            )
        ));
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => 'Request failed: ' . $response->get_error_message(),
                'url' => $endpoint_url,
                'test_url' => $url_to_test
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        $decoded_response = null;
        if ($status_code === 200 && !empty($body)) {
            $decoded_response = json_decode($body, true);
        }
        
        return array(
            'success' => $status_code === 200,
            'status_code' => $status_code,
            'response_body' => substr($body, 0, 1000),
            'decoded_response' => $decoded_response,
            'url' => $endpoint_url,
            'test_url' => $url_to_test
        );
    }
    
    /**
     * Test full PageSpeed request with authentication
     */
    private function test_full_pagespeed_request($test_url = null) {
        try {
            $url_to_test = $test_url ?: home_url();
            $proxy_url = 'https://magicplugins.io/wp-json/magicproxy/v1/pagespeed';
            
            $site_url = home_url();
            $site_id = parse_url($site_url, PHP_URL_HOST);
            $timestamp = time();
            
            // Create signature for authentication
            $signature_data = array(
                'site_id' => $site_id,
                'timestamp' => $timestamp,
                'action' => 'analyze'
            );
            $signature = hash_hmac('sha256', wp_json_encode($signature_data), $site_id);
            
            $request_data = array(
                'action' => 'analyze',
                'data' => array(
                    'url' => $url_to_test,
                    'strategy' => 'mobile',
                    'category' => array('performance'),
                    'locale' => 'en'
                ),
                'auth' => array(
                    'site_id' => $site_id,
                    'signature' => $signature
                ),
                'site_url' => $site_url,
                'timestamp' => $timestamp
            );
            
            $response = wp_remote_post($proxy_url, array(
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'MagicAssistant/Debug'
                ),
                'body' => wp_json_encode($request_data),
                'timeout' => 30
            ));
            
            if (is_wp_error($response)) {
                return array(
                    'success' => false,
                    'error' => 'Request failed: ' . $response->get_error_message(),
                    'request_data' => $request_data,
                    'url' => $proxy_url,
                    'test_url' => $url_to_test
                );
            }
            
            $status_code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            
            $decoded_response = null;
            if (!empty($body)) {
                $decoded_response = json_decode($body, true);
            }
            
            return array(
                'success' => $status_code === 200,
                'status_code' => $status_code,
                'response_body' => substr($body, 0, 1000),
                'decoded_response' => $decoded_response,
                'request_data' => $request_data,
                'signature_data' => $signature_data,
                'calculated_signature' => $signature,
                'url' => $proxy_url,
                'test_url' => $url_to_test
            );
            
        } catch (\Exception $e) {
            return array(
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
                'test_url' => $test_url ?: home_url()
            );
        }
    }
} 