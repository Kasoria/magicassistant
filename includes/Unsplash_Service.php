<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * Unsplash Service Class
 *
 * Provides helper functions to query the Unsplash API THROUGH MagicProxy. All
 * credentials are handled by MagicProxy, so this class only needs to forward
 * requests and return decoded JSON responses.
 */
class Unsplash_Service {

    private $ai_provider;
    private $db;
    private $timeout = 30;

    private $proxy_url = 'https://proxy.magicplugins.io/api/proxy/unsplash';

    public function __construct($ai_provider = null) {
        $this->ai_provider = $ai_provider;
        $this->db          = $ai_provider ? $ai_provider->get_db() : null;
    }

    /**
     * Perform an Unsplash search query
     *
     * @param array $args { query(string,required), per_page(int), orientation(string) }
     * @return array
     * @throws \Exception
     */
    public function search_images($args) {
        if (empty($args['query'])) {
            throw new \Exception('query parameter required');
        }

        $payload = array(
            'action'    => 'search',
            'data'      => array(
                'query'       => $args['query'],
                'per_page'    => isset($args['per_page']) ? intval($args['per_page']) : 10,
                'orientation' => isset($args['orientation']) ? sanitize_text_field($args['orientation']) : 'landscape',
            ),
            'site_url'  => home_url(),
            'timestamp' => time(),
        );

        // Merge license headers so proxy can verify usage
        $headers = array('Content-Type' => 'application/json');
        if ($this->ai_provider && method_exists($this->ai_provider, 'get_license_headers')) {
            $headers = array_merge($headers, $this->ai_provider->get_license_headers());
        }

        $response = wp_remote_post($this->proxy_url, array(
            'headers'  => $headers,
            'body'     => wp_json_encode($payload),
            'timeout'  => $this->timeout,
            'sslverify'=> true,
        ));

        if (is_wp_error($response)) {
            throw new \Exception('Unsplash proxy request failed: ' . $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if ($status !== 200) {
            throw new \Exception('Unsplash proxy error HTTP ' . $status . ' - ' . substr($body, 0, 200));
        }

        $data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from Unsplash proxy');
        }

        if (isset($data['error'])) {
            throw new \Exception('Unsplash API error: ' . $data['error']);
        }

        return $data['data'] ?? $data;
    }

    /**
     * Get random images from Unsplash
     *
     * @param array $args { count(int), orientation(string), query(string) }
     * @return array
     * @throws \Exception
     */
    public function get_random_images($args = array()) {
        $payload = array(
            'action'    => 'random',
            'data'      => array(
                'count'       => isset($args['count']) ? max(1, min(30, intval($args['count']))) : 1,
                'orientation' => isset($args['orientation']) ? sanitize_text_field($args['orientation']) : 'landscape',
            ),
            'site_url'  => home_url(),
            'timestamp' => time(),
        );

        if (!empty($args['query'])) {
            $payload['data']['query'] = sanitize_text_field($args['query']);
        }

        // License headers
        $headers = array('Content-Type' => 'application/json');
        if ($this->ai_provider && method_exists($this->ai_provider, 'get_license_headers')) {
            $headers = array_merge($headers, $this->ai_provider->get_license_headers());
        }

        $response = wp_remote_post($this->proxy_url, array(
            'headers'  => $headers,
            'body'     => wp_json_encode($payload),
            'timeout'  => $this->timeout,
            'sslverify'=> true,
        ));

        if (is_wp_error($response)) {
            throw new \Exception('Unsplash proxy request failed: ' . $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if ($status !== 200) {
            throw new \Exception('Unsplash proxy error HTTP ' . $status . ' - ' . substr($body, 0, 200));
        }

        $data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from Unsplash proxy');
        }

        if (isset($data['error'])) {
            throw new \Exception('Unsplash API error: ' . $data['error']);
        }

        return $data['data'] ?? $data;
    }
} 