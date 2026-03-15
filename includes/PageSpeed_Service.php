<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * PageSpeed Service Class
 *
 * Handles PageSpeed Insights API requests directly to Google's public API.
 * Ensures data is saved ONLY to 'pagespeed_data' database key.
 * Filters out base64 images and filmstrip data to prevent large data storage.
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
        return $this->ai_provider && $this->db;
    }

    /**
     * Handle PageSpeed analysis request
     * This method ensures data is saved ONLY to pagespeed_data, never to seo_data
     */
    public function handle_pagespeed_analysis($args) {
        try {
            if (empty($args['url'])) {
                $args['url'] = home_url();
            }

            if (!filter_var($args['url'], FILTER_VALIDATE_URL)) {
                throw new \Exception('Invalid URL format: ' . $args['url']);
            }

            $args = array_merge(array(
                'strategy' => 'mobile',
                'category' => array('performance', 'accessibility', 'best-practices', 'seo'),
                'locale' => 'en'
            ), $args);

            // Make PageSpeed request directly to Google API
            $raw_google_data = $this->make_pagespeed_request($args);

            if (!$raw_google_data || isset($raw_google_data['error'])) {
                throw new \Exception($raw_google_data['error']['message'] ?? 'PageSpeed analysis failed');
            }

            // Transform Google's raw response into the processed format
            $result = $this->transform_google_response($raw_google_data);

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
     * Make PageSpeed request directly to Google PageSpeed Insights API
     */
    private function make_pagespeed_request($args) {
        if (!$this->ai_provider || !$this->db) {
            throw new \Exception('PageSpeed service not properly initialized');
        }

        $query_params = array(
            'url'      => $args['url'],
            'strategy' => $args['strategy'] ?? 'mobile',
        );

        // Add optional Google API key for higher rate limits
        if ($this->db) {
            $encrypted_key = $this->db->get_setting('google_api_key');
            if (!empty($encrypted_key)) {
                $api_key = $this->db->decrypt_api_key($encrypted_key);
                if (!empty($api_key)) {
                    $query_params['key'] = $api_key;
                }
            }
        }

        // Build URL with categories appended separately (multiple category params)
        $base_url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' . http_build_query($query_params);

        $categories = $args['category'] ?? array('performance', 'accessibility', 'best-practices', 'seo');
        foreach ($categories as $category) {
            $base_url .= '&category=' . urlencode($category);
        }

        $response = wp_remote_get($base_url, array(
            'headers' => array(
                'User-Agent' => 'MagicAssistant/1.0',
            ),
            'timeout' => $this->timeout,
        ));

        if (is_wp_error($response)) {
            throw new \Exception('Google PageSpeed API request failed: ' . $response->get_error_message());
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($status_code !== 200) {
            $error_message = "Google PageSpeed API returned HTTP {$status_code}";
            if (!empty($body)) {
                $decoded_body = json_decode($body, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded_body['error']['message'])) {
                    $error_message .= ': ' . $decoded_body['error']['message'];
                } else {
                    $error_message .= ': ' . substr($body, 0, 200);
                }
            }
            throw new \Exception($error_message);
        }

        $result = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from Google PageSpeed API: ' . json_last_error_msg());
        }

        return $result;
    }

    /**
     * Transform Google's raw PageSpeed API response into the format expected by
     * process_and_filter_pagespeed_data (same structure the proxy used to return).
     */
    private function transform_google_response($data) {
        $lighthouse  = $data['lighthouseResult'] ?? array();
        $categories  = $lighthouse['categories'] ?? array();
        $audits      = $lighthouse['audits'] ?? array();

        // Scores
        $scores = array();
        foreach ($categories as $key => $category) {
            $scores[$key] = array(
                'score' => round(($category['score'] ?? 0) * 100),
                'title' => $category['title'] ?? $key,
            );
        }

        // Core Web Vitals
        $vital_metrics = array(
            'largest-contentful-paint'  => 'LCP',
            'first-input-delay'         => 'FID',
            'cumulative-layout-shift'   => 'CLS',
            'first-contentful-paint'    => 'FCP',
            'interaction-to-next-paint' => 'INP',
        );

        $core_web_vitals = array();
        foreach ($vital_metrics as $audit_id => $short_name) {
            if (isset($audits[$audit_id])) {
                $audit = $audits[$audit_id];
                $core_web_vitals[$short_name] = array(
                    'value'        => $audit['numericValue'] ?? null,
                    'displayValue' => $audit['displayValue'] ?? 'N/A',
                    'score'        => $audit['score'] ?? null,
                    'title'        => $audit['title'] ?? $audit_id,
                );
            }
        }

        // Opportunities
        $opportunity_ids = array(
            'render-blocking-resources', 'unused-css-rules', 'unused-javascript', 'modern-image-formats',
            'uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'efficiently-encode-images',
            'offscreen-images', 'unminified-css', 'unminified-javascript', 'enable-text-compression',
            'uses-long-cache-ttl', 'total-byte-weight', 'legacy-javascript', 'server-response-time',
            'uses-rel-preconnect', 'uses-rel-preload', 'font-display', 'third-party-summary',
            'third-party-facades', 'largest-contentful-paint-element', 'prioritize-lcp-image',
            'uses-passive-event-listeners', 'non-composited-animations', 'unsized-images',
        );

        $opportunities = array();
        foreach ($opportunity_ids as $id) {
            if (isset($audits[$id]) && isset($audits[$id]['score']) && $audits[$id]['score'] < 1) {
                $audit = $audits[$id];
                $item = array(
                    'id'           => $id,
                    'title'        => $audit['title'] ?? $id,
                    'description'  => $audit['description'] ?? '',
                    'score'        => $audit['score'],
                    'displayValue' => $audit['displayValue'] ?? '',
                );
                if (isset($audit['details']['overallSavingsMs'])) {
                    $item['overallSavingsMs'] = $audit['details']['overallSavingsMs'];
                }
                if (isset($audit['details']['overallSavingsBytes'])) {
                    $item['overallSavingsBytes'] = $audit['details']['overallSavingsBytes'];
                }
                $opportunities[] = $item;
            }
        }

        // Diagnostics
        $diagnostic_patterns = array(
            'mainthread-work-breakdown', 'bootup-time', 'uses-long-cache-ttl', 'total-byte-weight',
            'dom-size', 'critical-request-chains', 'user-timings', 'network-requests', 'network-rtt',
            'network-server-latency', 'main-thread-tasks', 'metrics', 'resource-summary',
            'third-party-summary', 'timing-budget', 'performance-budget',
        );

        $diagnostics = array();
        foreach ($audits as $id => $audit) {
            $is_informative = in_array($id, $diagnostic_patterns, true)
                || !isset($audit['score'])
                || in_array($audit['scoreDisplayMode'] ?? '', array('informative', 'notApplicable'), true);

            if ($is_informative) {
                $diag = array(
                    'id'               => $id,
                    'title'            => $audit['title'] ?? $id,
                    'description'      => $audit['description'] ?? '',
                    'score'            => $audit['score'] ?? null,
                    'displayValue'     => $audit['displayValue'] ?? '',
                    'scoreDisplayMode' => $audit['scoreDisplayMode'] ?? 'numeric',
                );
                if (isset($audit['numericValue'])) {
                    $diag['numericValue'] = $audit['numericValue'];
                }
                $diagnostics[] = $diag;
            }
        }

        // Processed audits (safe values, no base64)
        $processed_audits = array();
        foreach ($audits as $id => $audit) {
            $processed_audits[$id] = array(
                'title'            => $audit['title'] ?? $id,
                'description'      => $audit['description'] ?? '',
                'score'            => $audit['score'] ?? null,
                'displayValue'     => $audit['displayValue'] ?? '',
                'scoreDisplayMode' => $audit['scoreDisplayMode'] ?? 'numeric',
            );
            if (isset($audit['numericValue'])) {
                $processed_audits[$id]['numericValue'] = $audit['numericValue'];
            }
        }

        // Determine strategy
        $strategy = 'mobile';
        if (isset($lighthouse['configSettings']['emulatedFormFactor'])) {
            $strategy = $lighthouse['configSettings']['emulatedFormFactor'];
        }

        return array(
            'url'                       => $data['id'] ?? '',
            'strategy'                  => $strategy,
            'scores'                    => $scores,
            'core_web_vitals'           => $core_web_vitals,
            'opportunities'             => $opportunities,
            'diagnostics'               => $diagnostics,
            'audits'                    => $processed_audits,
            'loading_experience'        => $data['loadingExperience'] ?? array(),
            'origin_loading_experience' => $data['originLoadingExperience'] ?? array(),
            'lighthouse'                => array(
                'requestedUrl'      => $lighthouse['requestedUrl'] ?? '',
                'finalUrl'          => $lighthouse['finalUrl'] ?? '',
                'lighthouseVersion' => $lighthouse['lighthouseVersion'] ?? '',
                'fetchTime'         => $lighthouse['fetchTime'] ?? '',
                'environment'       => $lighthouse['environment'] ?? array(),
                'runWarnings'       => array_slice($lighthouse['runWarnings'] ?? array(), 0, 10),
            ),
            'analysis_timestamp'        => $data['analysisUTCTimestamp'] ?? null,
        );
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

        // Extract and clean Core Web Vitals
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

        // Extract and clean opportunities
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

                    if (isset($audit_data['numericValue'])) {
                        $clean_audit['numericValue'] = floatval($audit_data['numericValue']);
                    }

                    if (isset($audit_data['details']) && is_array($audit_data['details'])) {
                        $clean_audit['details'] = $this->filter_base64_from_array($audit_data['details']);
                    }

                    $processed['audits'][$audit_id] = $clean_audit;
                }
            }
        }

        // Extract loading experience data
        if (isset($raw_data['loading_experience']) && is_array($raw_data['loading_experience'])) {
            $processed['loadingExperience'] = $this->filter_base64_from_array($raw_data['loading_experience']);
        }

        if (isset($raw_data['origin_loading_experience']) && is_array($raw_data['origin_loading_experience'])) {
            $processed['originLoadingExperience'] = $this->filter_base64_from_array($raw_data['origin_loading_experience']);
        }

        // Extract lighthouse metadata (exclude large data like filmstrip)
        if (isset($raw_data['lighthouse']) && is_array($raw_data['lighthouse'])) {
            $lh = $raw_data['lighthouse'];
            $processed['lighthouse'] = array(
                'requestedUrl' => sanitize_url($lh['requestedUrl'] ?? ''),
                'finalUrl' => sanitize_url($lh['finalUrl'] ?? ''),
                'lighthouseVersion' => sanitize_text_field($lh['lighthouseVersion'] ?? ''),
                'fetchTime' => sanitize_text_field($lh['fetchTime'] ?? ''),
                'environment' => isset($lh['environment']) && is_array($lh['environment'])
                    ? array_map('sanitize_text_field', $lh['environment'])
                    : array(),
                'runWarnings' => isset($lh['runWarnings']) && is_array($lh['runWarnings'])
                    ? array_map('sanitize_text_field', array_slice($lh['runWarnings'], 0, 10))
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
                if (preg_match('/^data:image\/[^;]+;base64,/', $data) ||
                    (strlen($data) > 10000 && base64_decode($data, true) !== false)) {
                    return '[FILTERED: Base64 image/binary data removed]';
                }
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
            $skip_keys = array('screenshot', 'filmstrip', 'thumbnails');
            if (in_array($key, $skip_keys)) {
                continue;
            }

            if ($key === 'details' && is_array($value)) {
                $filtered_details = array();
                foreach ($value as $detail_key => $detail_value) {
                    if (is_string($detail_value) && (
                        strlen($detail_value) > 5000 ||
                        preg_match('/^data:image/', $detail_value) ||
                        (strlen($detail_value) > 1000 && base64_decode($detail_value, true) !== false)
                    )) {
                        continue;
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
            'filtered' => true,
            'data_source' => 'google_pagespeed_insights'
        );

        // Save ONLY to pagespeed_data - this is critical!
        $this->db->save_user_setting('pagespeed_data', $pagespeed_data, $user_id);

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
}
