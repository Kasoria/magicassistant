<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * Unsplash Service Class
 *
 * Calls the Unsplash API directly using the user's own access key.
 */
class Unsplash_Service {

    private $ai_provider;
    private $db;
    private $timeout = 30;

    private $api_base_url = 'https://api.unsplash.com';

    public function __construct($ai_provider = null) {
        $this->ai_provider = $ai_provider;
        $this->db          = $ai_provider ? $ai_provider->get_db() : null;
    }

    /**
     * Get the user's Unsplash access key from settings
     *
     * @return string
     * @throws \Exception if no key is configured
     */
    private function get_unsplash_access_key() {
        if (!$this->db) {
            throw new \Exception('Unsplash access key not configured. Please add your Unsplash access key in Settings.');
        }

        $encrypted_key = $this->db->get_setting('unsplash_access_key');

        if (empty($encrypted_key)) {
            throw new \Exception('Unsplash access key not configured. Please add your Unsplash access key in Settings.');
        }

        $access_key = $this->db->decrypt_api_key($encrypted_key);

        if (empty($access_key)) {
            throw new \Exception('Unsplash access key could not be decrypted. Please re-enter your Unsplash access key in Settings.');
        }

        return $access_key;
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

        $access_key = $this->get_unsplash_access_key();

        $query_params = array(
            'query'       => $args['query'],
            'per_page'    => isset($args['per_page']) ? intval($args['per_page']) : 10,
            'orientation' => isset($args['orientation']) ? sanitize_text_field($args['orientation']) : 'landscape',
        );

        $url = $this->api_base_url . '/search/photos?' . http_build_query($query_params);

        $response = wp_remote_get($url, array(
            'headers'   => array(
                'Authorization' => 'Client-ID ' . $access_key,
                'Accept'        => 'application/json',
            ),
            'timeout'   => $this->timeout,
            'sslverify' => true,
        ));

        if (is_wp_error($response)) {
            throw new \Exception('Unsplash API request failed: ' . $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if ($status !== 200) {
            throw new \Exception('Unsplash API error HTTP ' . $status . ' - ' . substr($body, 0, 200));
        }

        $data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from Unsplash API');
        }

        return $data;
    }

    /**
     * Get random images from Unsplash
     *
     * @param array $args { count(int), orientation(string), query(string) }
     * @return array
     * @throws \Exception
     */
    public function get_random_images($args = array()) {
        $access_key = $this->get_unsplash_access_key();

        $query_params = array(
            'count'       => isset($args['count']) ? max(1, min(30, intval($args['count']))) : 1,
            'orientation' => isset($args['orientation']) ? sanitize_text_field($args['orientation']) : 'landscape',
        );

        if (!empty($args['query'])) {
            $query_params['query'] = sanitize_text_field($args['query']);
        }

        $url = $this->api_base_url . '/photos/random?' . http_build_query($query_params);

        $response = wp_remote_get($url, array(
            'headers'   => array(
                'Authorization' => 'Client-ID ' . $access_key,
                'Accept'        => 'application/json',
            ),
            'timeout'   => $this->timeout,
            'sslverify' => true,
        ));

        if (is_wp_error($response)) {
            throw new \Exception('Unsplash API request failed: ' . $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if ($status !== 200) {
            throw new \Exception('Unsplash API error HTTP ' . $status . ' - ' . substr($body, 0, 200));
        }

        $data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from Unsplash API');
        }

        return $data;
    }
}
