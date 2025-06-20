<?php
/**
 * DataForSEO integration for MagicAssistant
 * Routes all SEO API calls through magicplugins.io proxy
 *
 * @package MagicAssistant
 */

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

class DataForSEO {
    
    private $proxy_url = 'https://magicplugins.io/wp-json/magicproxy/v1/dataforseo';
    private $mcp_server;
    private $timeout = 30;
    
    public function __construct() {
        // Will be initialized by the main plugin class
    }
    
    public function set_mcp_server($mcp_server) {
        $this->mcp_server = $mcp_server;
    }
    
    /**
     * Handle SERP analysis request
     */
    public function handle_serp_analysis($args) {
        return $this->make_proxy_request('serp_analysis', $args);
    }
    
    /**
     * Handle keyword difficulty request
     */
    public function handle_keyword_difficulty($args) {
        return $this->make_proxy_request('keyword_difficulty', $args);
    }
    
    /**
     * Handle domain analysis request
     */
    public function handle_domain_analysis($args) {
        return $this->make_proxy_request('domain_analysis', $args);
    }
    
    /**
     * Handle competitor analysis request
     */
    public function handle_competitor_analysis($args) {
        return $this->make_proxy_request('competitor_analysis', $args);
    }
    
    /**
     * Handle technical audit request
     */
    public function handle_technical_audit($args) {
        return $this->make_proxy_request('technical_audit', $args);
    }
    
    /**
     * Make request to magicplugins.io proxy
     */
    private function make_proxy_request($action, $args) {
        // Prepare request data
        $request_data = array(
            'action' => $action,
            'data' => $args,
            'site_url' => home_url(),
            'plugin_version' => MAGIC_ASSISTANT_VERSION,
            'timestamp' => time()
        );
        
        // Add site authentication
        $request_data['auth'] = $this->generate_request_auth($request_data);
        
        // Make the request
        $response = wp_remote_post($this->proxy_url, array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'MagicAssistant/' . MAGIC_ASSISTANT_VERSION,
            ),
            'body' => wp_json_encode($request_data),
            'timeout' => $this->timeout,
            'sslverify' => true
        ));
        
        if (is_wp_error($response)) {
            throw new \Exception('DataForSEO proxy request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            throw new \Exception('DataForSEO proxy returned error: HTTP ' . $status_code);
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON response from DataForSEO proxy');
        }
        
        if (isset($data['error'])) {
            throw new \Exception('DataForSEO API error: ' . $data['error']);
        }
        
        return $data['data'] ?? $data;
    }
    
    /**
     * Generate authentication signature for requests
     */
    private function generate_request_auth($request_data) {
        // Create a unique identifier for this site
        $site_identifier = hash('sha256', home_url() . get_option('siteurl'));
        
        // Create signature using site data
        $signature_data = array(
            'site_id' => $site_identifier,
            'timestamp' => $request_data['timestamp'],
            'action' => $request_data['action']
        );
        
        return array(
            'site_id' => $site_identifier,
            'signature' => hash_hmac('sha256', wp_json_encode($signature_data), $site_identifier)
        );
    }
    
    /**
     * Check if DataForSEO integration is available
     */
    public function is_available() {
        // Could add additional checks here (e.g., connectivity test)
        return true;
    }
    
    /**
     * Get available locations for DataForSEO
     */
    public function get_available_locations() {
        try {
            return $this->make_proxy_request('get_locations', array());
        } catch (\Exception $e) {
            return $this->get_common_locations();
        }
    }
    
    /**
     * Get common location codes with more comprehensive list
     */
    public function get_common_locations() {
        return array(
            array('location_code' => 2840, 'location_name' => 'United States', 'language' => 'en'),
            array('location_code' => 2826, 'location_name' => 'United Kingdom', 'language' => 'en'),
            array('location_code' => 2124, 'location_name' => 'Canada', 'language' => 'en'),
            array('location_code' => 2036, 'location_name' => 'Australia', 'language' => 'en'),
            array('location_code' => 2276, 'location_name' => 'Germany', 'language' => 'de'),
            array('location_code' => 2040, 'location_name' => 'Austria', 'language' => 'de'),
            array('location_code' => 2756, 'location_name' => 'Switzerland', 'language' => 'de'),
            array('location_code' => 2250, 'location_name' => 'France', 'language' => 'fr'),
            array('location_code' => 2056, 'location_name' => 'Belgium', 'language' => 'fr'),
            array('location_code' => 2724, 'location_name' => 'Spain', 'language' => 'es'),
            array('location_code' => 2484, 'location_name' => 'Mexico', 'language' => 'es'),
            array('location_code' => 2380, 'location_name' => 'Italy', 'language' => 'it'),
            array('location_code' => 2528, 'location_name' => 'Netherlands', 'language' => 'nl'),
            array('location_code' => 2616, 'location_name' => 'Poland', 'language' => 'pl'),
            array('location_code' => 2203, 'location_name' => 'Czech Republic', 'language' => 'cs')
        );
    }
    
    /**
     * Suggest location and language based on keyword context
     */
    public function suggest_location_and_language($keyword) {
        $keyword_lower = strtolower($keyword);
        
        // German keywords/cities
        if (preg_match('/\b(hamburg|berlin|münchen|frankfurt|köln|stuttgart|düsseldorf|dortmund|essen|bremen|dresden|hannover|nürnberg|duisburg|bochum|wuppertal|webdesigner|seo|marketing|rechtsanwalt|steuerberater|zahnarzt|arzt|restaurant|hotel|friseur|autowerkstatt)\b/i', $keyword_lower)) {
            return array('location_code' => 2276, 'language_code' => 'de', 'country' => 'Germany');
        }
        
        // French keywords/cities
        if (preg_match('/\b(paris|marseille|lyon|toulouse|nice|nantes|strasbourg|montpellier|bordeaux|lille|rennes|reims|le havre|saint-étienne|toulon|angers|grenoble|dijon|nîmes|aix-en-provence|référencement|marketing|avocat|comptable|dentiste|médecin|coiffeur|garage)\b/i', $keyword_lower)) {
            return array('location_code' => 2250, 'language_code' => 'fr', 'country' => 'France');
        }
        
        // Spanish keywords/cities
        if (preg_match('/\b(madrid|barcelona|valencia|sevilla|zaragoza|málaga|murcia|palma|las palmas|bilbao|alicante|córdoba|valladolid|vigo|gijón|hospitalet|vitoria|coruña|granada|oviedo|badalona|cartagena|terrassa|jerez|sabadell|móstoles|santa cruz|pamplona|almería|fuenlabrada|leganés|santander|burgos|castellón|alcorcón|getafe|salamanca|huelva|marbella|badajoz|tarragona|león|cádiz|dos hermanas|jaén|ourense|torrejón|parla|alcobendas|reus|telde|barakaldo|lugo|san sebastián|lorca|coslada|talavera|el puerto|cornellá|avilés|palencia|gecho|orihuela|ceuta|guadalajara|mieres|rivas|molina|paterna|majadahonda|sagunto|línea|roquetas|sant boi|sant cugat|manresa|rubí|vilanova|mollet|mataró|granollers|esplugues|viladecans|sitges|santa coloma|badalona|seo|marketing|abogado|contador|dentista|médico|peluquero|taller)\b/i', $keyword_lower)) {
            return array('location_code' => 2724, 'language_code' => 'es', 'country' => 'Spain');
        }
        
        // Italian keywords/cities
        if (preg_match('/\b(roma|milano|napoli|torino|palermo|genova|bologna|firenze|bari|catania|venezia|verona|messina|padova|trieste|taranto|brescia|parma|prato|modena|reggio calabria|reggio emilia|perugia|ravenna|livorno|cagliari|foggia|rimini|salerno|ferrara|sassari|monza|syracusa|pescara|bergamo|forlì|trento|vicenza|terni|bolzano|novara|piacenza|ancona|andria|arezzo|udine|cesena|lecce|pesaro|barletta|alessandria|la spezia|pisa|catanzaro|pistoia|lucca|torre del greco|como|guidonia|tivoli|brindisi|marsala|prato|grosseto|latina|castel|seo|marketing|avvocato|commercialista|dentista|medico|parrucchiere|officina)\b/i', $keyword_lower)) {
            return array('location_code' => 2380, 'language_code' => 'it', 'country' => 'Italy');
        }
        
        // Default to asking user
        return null;
    }
    
    /**
     * Handle location suggestion request
     */
    public function handle_location_suggestion($args) {
        $keyword = $args['keyword'] ?? '';
        
        if (empty($keyword)) {
            throw new \Exception('Keyword is required for location suggestion');
        }
        
        $suggestion = $this->suggest_location_and_language($keyword);
        
        if ($suggestion) {
            return array(
                'success' => true,
                'keyword' => $keyword,
                'suggested_location_code' => $suggestion['location_code'],
                'suggested_language_code' => $suggestion['language_code'],
                'suggested_country' => $suggestion['country'],
                'confidence' => 'high',
                'message' => "Based on the keyword '{$keyword}', I suggest using location code {$suggestion['location_code']} ({$suggestion['country']}) and language code '{$suggestion['language_code']}'."
            );
        } else {
            // Return common locations for user to choose from
            $common_locations = $this->get_common_locations();
            return array(
                'success' => true,
                'keyword' => $keyword,
                'suggested_location_code' => null,
                'suggested_language_code' => null,
                'confidence' => 'low',
                'message' => "Could not automatically detect the language/location for '{$keyword}'. Please choose from the available options or ask the user for clarification.",
                'available_locations' => array_slice($common_locations, 0, 10) // Return top 10 most common
            );
        }
    }
    
    /**
     * Get DataForSEO service status
     */
    public function get_service_status() {
        try {
            $response = $this->make_proxy_request('status', array());
            return array(
                'available' => true,
                'status' => $response['status'] ?? 'operational'
            );
        } catch (\Exception $e) {
            return array(
                'available' => false,
                'error' => $e->getMessage()
            );
        }
    }
} 