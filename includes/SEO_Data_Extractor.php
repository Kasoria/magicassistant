<?php
/**
 * SEO Data Extractor for MagicAssistant
 * Integrates directly with popular SEO plugins and falls back to HTML parsing
 *
 * @package MagicAssistant
 */

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

class SEO_Data_Extractor {
    
    private $active_seo_plugins = array();
    private $primary_seo_plugin = null;
    
    public function __construct() {
        $this->detect_seo_plugins();
    }
    
    /**
     * Detect active SEO plugins
     */
    private function detect_seo_plugins() {
        // RankMath
        if (class_exists('RankMath')) {
            $this->active_seo_plugins['rankmath'] = array(
                'name' => 'RankMath',
                'version' => defined('RANK_MATH_VERSION') ? RANK_MATH_VERSION : 'unknown'
            );
        }
        
        // Yoast SEO
        if (defined('WPSEO_VERSION')) {
            $this->active_seo_plugins['yoast'] = array(
                'name' => 'Yoast SEO',
                'version' => WPSEO_VERSION
            );
        }
        
        // SEOPress
        if (defined('SEOPRESS_VERSION')) {
            $this->active_seo_plugins['seopress'] = array(
                'name' => 'SEOPress',
                'version' => SEOPRESS_VERSION
            );
        }
        
        // All in One SEO
        if (function_exists('aioseo')) {
            $this->active_seo_plugins['aioseo'] = array(
                'name' => 'All in One SEO',
                'version' => defined('AIOSEO_VERSION') ? AIOSEO_VERSION : 'unknown'
            );
        }
        
        // The SEO Framework
        if (function_exists('the_seo_framework')) {
            $this->active_seo_plugins['tsf'] = array(
                'name' => 'The SEO Framework',
                'version' => defined('THE_SEO_FRAMEWORK_VERSION') ? THE_SEO_FRAMEWORK_VERSION : 'unknown'
            );
        }
        
        // WP SEO by Squirrly
        if (class_exists('SQ_Classes_Helpers_Tools')) {
            $this->active_seo_plugins['squirrly'] = array(
                'name' => 'Squirrly SEO',
                'version' => defined('SQ_VERSION') ? SQ_VERSION : 'unknown'
            );
        }
        
        // Set primary plugin (prefer RankMath, then Yoast, then others)
        if (isset($this->active_seo_plugins['rankmath'])) {
            $this->primary_seo_plugin = 'rankmath';
        } elseif (isset($this->active_seo_plugins['yoast'])) {
            $this->primary_seo_plugin = 'yoast';
        } elseif (isset($this->active_seo_plugins['seopress'])) {
            $this->primary_seo_plugin = 'seopress';
        } elseif (isset($this->active_seo_plugins['aioseo'])) {
            $this->primary_seo_plugin = 'aioseo';
        } elseif (isset($this->active_seo_plugins['tsf'])) {
            $this->primary_seo_plugin = 'tsf';
        }
    }
    
    /**
     * Get detected SEO plugins
     */
    public function get_active_plugins() {
        return $this->active_seo_plugins;
    }
    
    /**
     * Extract meta tags data with plugin integration
     */
    public function extract_meta_tags($url, $post_id = null, $analyze_all_pages = false) {
        // First try plugin-specific extraction
        if ($this->primary_seo_plugin && $post_id) {
            $plugin_data = $this->extract_meta_from_plugin($post_id);
            if ($plugin_data) {
                // If critical fields are missing, enhance with HTML fallback
                $needs_html = false;
                $title_missing = empty($plugin_data['title']['content']);
                $desc_missing  = !isset($plugin_data['meta_description']['content']) || $plugin_data['meta_description']['content'] === '';

                // Additionally treat very short descriptions (< 20 chars) as missing
                if (!$desc_missing && isset($plugin_data['meta_description']['length']) && $plugin_data['meta_description']['length'] < 20) {
                    $desc_missing = true;
                }

                $needs_html = $title_missing || $desc_missing;

                if ($needs_html) {
                    $html_data = $this->extract_meta_from_html($url);
                    if (!isset($html_data['error'])) {
                        // Merge HTML data into plugin data only for missing fields
                        if ($title_missing && !empty($html_data['title']['content'])) {
                            $plugin_data['title'] = $html_data['title'];
                            $plugin_data['title']['custom'] = false;
                        }
                        if ($desc_missing && !empty($html_data['meta_description']['content'])) {
                            $plugin_data['meta_description'] = $html_data['meta_description'];
                            $plugin_data['meta_description']['custom'] = false;
                        }
                        // Optional fields
                        if (empty($plugin_data['canonical_url']) && !empty($html_data['canonical_url'])) {
                            $plugin_data['canonical_url'] = $html_data['canonical_url'];
                        }
                        if (empty($plugin_data['robots']) && !empty($html_data['robots'])) {
                            $plugin_data['robots'] = $html_data['robots'];
                        }
                        $plugin_data['data_source'] = 'plugin_html_combined';
                    }
                } else {
                    $plugin_data['data_source'] = 'plugin';
                }

                $plugin_data['plugin'] = $this->active_seo_plugins[$this->primary_seo_plugin]['name'];
                return $plugin_data;
            }
        }
        
        // Fallback to HTML parsing
        return $this->extract_meta_from_html($url);
    }
    
    /**
     * Extract meta tags from SEO plugins
     */
    private function extract_meta_from_plugin($post_id) {
        switch ($this->primary_seo_plugin) {
            case 'rankmath':
                return $this->extract_rankmath_meta($post_id);
            case 'yoast':
                return $this->extract_yoast_meta($post_id);
            case 'seopress':
                return $this->extract_seopress_meta($post_id);
            case 'aioseo':
                return $this->extract_aioseo_meta($post_id);
            case 'tsf':
                return $this->extract_tsf_meta($post_id);
            default:
                return null;
        }
    }
    
    /**
     * Extract meta tags from RankMath
     */
    private function extract_rankmath_meta($post_id) {
        if (!class_exists('RankMath\Helper')) {
            return null;
        }
        
        $title = \RankMath\Helper::get_post_meta('title', $post_id);
        $description = \RankMath\Helper::get_post_meta('description', $post_id);
        $focus_keyword = \RankMath\Helper::get_post_meta('focus_keyword', $post_id);
        $canonical = \RankMath\Helper::get_post_meta('canonical_url', $post_id);
        $robots = \RankMath\Helper::get_post_meta('robots', $post_id);
        
        return array(
            'title' => array(
                'content' => $title ?: get_the_title($post_id),
                'length' => strlen($title ?: get_the_title($post_id)),
                'custom' => !empty($title)
            ),
            'meta_description' => array(
                'content' => $description,
                'length' => strlen($description ?: ''),
                'custom' => !empty($description)
            ),
            'focus_keyword' => $focus_keyword,
            'canonical_url' => $canonical,
            'robots' => $robots,
            'plugin_score' => \RankMath\Helper::get_post_meta('seo_score', $post_id)
        );
    }
    
    /**
     * Extract meta tags from Yoast SEO
     */
    private function extract_yoast_meta($post_id) {
        if (!function_exists('YoastSEO')) {
            return null;
        }
        
        $title = get_post_meta($post_id, '_yoast_wpseo_title', true);
        $description = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
        $focus_keyword = get_post_meta($post_id, '_yoast_wpseo_focuskw', true);
        $canonical = get_post_meta($post_id, '_yoast_wpseo_canonical', true);
        $noindex = get_post_meta($post_id, '_yoast_wpseo_meta-robots-noindex', true);
        $nofollow = get_post_meta($post_id, '_yoast_wpseo_meta-robots-nofollow', true);
        $score = get_post_meta($post_id, '_yoast_wpseo_linkdex', true);
        
        $robots = array();
        if ($noindex === '1') $robots[] = 'noindex';
        if ($nofollow === '1') $robots[] = 'nofollow';
        
        return array(
            'title' => array(
                'content' => $title ?: get_the_title($post_id),
                'length' => strlen($title ?: get_the_title($post_id)),
                'custom' => !empty($title)
            ),
            'meta_description' => array(
                'content' => $description,
                'length' => strlen($description ?: ''),
                'custom' => !empty($description)
            ),
            'focus_keyword' => $focus_keyword,
            'canonical_url' => $canonical,
            'robots' => implode(', ', $robots),
            'plugin_score' => $score
        );
    }
    
    /**
     * Extract meta tags from SEOPress
     */
    private function extract_seopress_meta($post_id) {
        $title = get_post_meta($post_id, '_seopress_titles_title', true);
        $description = get_post_meta($post_id, '_seopress_titles_desc', true);
        $canonical = get_post_meta($post_id, '_seopress_robots_canonical', true);
        $noindex = get_post_meta($post_id, '_seopress_robots_index', true);
        $nofollow = get_post_meta($post_id, '_seopress_robots_follow', true);
        $target_keyword = get_post_meta($post_id, '_seopress_analysis_target_kw', true);
        
        $robots = array();
        if ($noindex === 'yes') $robots[] = 'noindex';
        if ($nofollow === 'yes') $robots[] = 'nofollow';
        
        return array(
            'title' => array(
                'content' => $title ?: get_the_title($post_id),
                'length' => strlen($title ?: get_the_title($post_id)),
                'custom' => !empty($title)
            ),
            'meta_description' => array(
                'content' => $description,
                'length' => strlen($description ?: ''),
                'custom' => !empty($description)
            ),
            'focus_keyword' => $target_keyword,
            'canonical_url' => $canonical,
            'robots' => implode(', ', $robots)
        );
    }
    
    /**
     * Extract meta tags from All in One SEO
     */
    private function extract_aioseo_meta($post_id) {
        if (!function_exists('aioseo')) {
            return null;
        }
        
        $post = aioseo()->meta->metaData->getMetaData($post_id);
        if (!$post) {
            return null;
        }
        
        return array(
            'title' => array(
                'content' => $post->title ?: get_the_title($post_id),
                'length' => strlen($post->title ?: get_the_title($post_id)),
                'custom' => !empty($post->title)
            ),
            'meta_description' => array(
                'content' => $post->description,
                'length' => strlen($post->description ?: ''),
                'custom' => !empty($post->description)
            ),
            'focus_keyword' => $post->keyphrases->focus->keyphrase ?? '',
            'canonical_url' => $post->canonical_url,
            'robots' => $post->robots_default ? 'default' : implode(', ', array_filter([
                $post->robots_noindex ? 'noindex' : '',
                $post->robots_nofollow ? 'nofollow' : ''
            ]))
        );
    }
    
    /**
     * Extract meta tags from The SEO Framework
     */
    private function extract_tsf_meta($post_id) {
        if (!function_exists('the_seo_framework')) {
            return null;
        }
        
        $tsf = the_seo_framework();
        $title = $tsf->get_post_meta_item('_genesis_title', $post_id);
        $description = $tsf->get_post_meta_item('_genesis_description', $post_id);
        $canonical = $tsf->get_post_meta_item('_genesis_canonical_uri', $post_id);
        $noindex = $tsf->get_post_meta_item('_genesis_noindex', $post_id);
        $nofollow = $tsf->get_post_meta_item('_genesis_nofollow', $post_id);
        
        $robots = array();
        if ($noindex) $robots[] = 'noindex';
        if ($nofollow) $robots[] = 'nofollow';
        
        return array(
            'title' => array(
                'content' => $title ?: get_the_title($post_id),
                'length' => strlen($title ?: get_the_title($post_id)),
                'custom' => !empty($title)
            ),
            'meta_description' => array(
                'content' => $description,
                'length' => strlen($description ?: ''),
                'custom' => !empty($description)
            ),
            'canonical_url' => $canonical,
            'robots' => implode(', ', $robots)
        );
    }
    
    /**
     * Extract meta tags from HTML (fallback method)
     */
    private function extract_meta_from_html($url) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return array(
                'error' => 'Failed to fetch page: ' . $response->get_error_message(),
                'data_source' => 'html_fallback'
            );
        }
        
        $html = wp_remote_retrieve_body($response);
        
        // Use DOMDocument to parse HTML
        $dom = new \DOMDocument();
        @$dom->loadHTML($html);
        
        // Extract title
        $title_nodes = $dom->getElementsByTagName('title');
        $title = $title_nodes->length > 0 ? $title_nodes->item(0)->textContent : '';
        
        // Extract meta description
        $description = '';
        $meta_nodes = $dom->getElementsByTagName('meta');
        foreach ($meta_nodes as $meta) {
            if (strtolower($meta->getAttribute('name')) === 'description') {
                $description = $meta->getAttribute('content');
                break;
            }
        }
        
        // Extract canonical URL
        $canonical = '';
        $link_nodes = $dom->getElementsByTagName('link');
        foreach ($link_nodes as $link) {
            if (strtolower($link->getAttribute('rel')) === 'canonical') {
                $canonical = $link->getAttribute('href');
                break;
            }
        }
        
        // Extract robots meta
        $robots = '';
        foreach ($meta_nodes as $meta) {
            if (strtolower($meta->getAttribute('name')) === 'robots') {
                $robots = $meta->getAttribute('content');
                break;
            }
        }
        
        return array(
            'title' => array(
                'content' => $title,
                'length' => strlen($title),
                'custom' => false // Can't determine from HTML alone
            ),
            'meta_description' => array(
                'content' => $description,
                'length' => strlen($description),
                'custom' => false
            ),
            'canonical_url' => $canonical,
            'robots' => $robots,
            'data_source' => 'html_fallback'
        );
    }
    
    /**
     * Extract structured data with plugin integration
     */
    public function extract_structured_data($url, $post_id = null) {
        // First try plugin-specific extraction
        if ($this->primary_seo_plugin && $post_id) {
            $plugin_data = $this->extract_schema_from_plugin($post_id);
            if ($plugin_data) {
                $plugin_data['data_source'] = 'plugin';
                $plugin_data['plugin'] = $this->active_seo_plugins[$this->primary_seo_plugin]['name'];
                return $plugin_data;
            }
        }
        
        // Fallback to HTML parsing
        return $this->extract_schema_from_html($url);
    }
    
    /**
     * Extract structured data from SEO plugins
     */
    private function extract_schema_from_plugin($post_id) {
        switch ($this->primary_seo_plugin) {
            case 'rankmath':
                return $this->extract_rankmath_schema($post_id);
            case 'yoast':
                return $this->extract_yoast_schema($post_id);
            case 'seopress':
                return $this->extract_seopress_schema($post_id);
            default:
                return null;
        }
    }
    
    /**
     * Extract schema from RankMath
     */
    private function extract_rankmath_schema($post_id) {
        if (!class_exists('RankMath\Helper')) {
            return null;
        }
        
        $schema_types = \RankMath\Helper::get_post_meta('rich_snippet', $post_id);
        $schema_data = \RankMath\Helper::get_post_meta('snippet_' . $schema_types, $post_id);
        
        return array(
            'schema_types' => $schema_types ? array($schema_types) : array(),
            'structured_data_count' => $schema_types ? 1 : 0,
            'has_json_ld' => !empty($schema_types),
            'has_microdata' => false,
            'has_rdfa' => false,
            'schema_details' => $schema_data
        );
    }
    
    /**
     * Extract schema from Yoast SEO
     */
    private function extract_yoast_schema($post_id) {
        // Yoast generates schema automatically, we can check for specific settings
        $schema_article_type = get_post_meta($post_id, '_yoast_wpseo_schema_article_type', true);
        $schema_page_type = get_post_meta($post_id, '_yoast_wpseo_schema_page_type', true);
        
        $schemas = array();
        if ($schema_article_type) $schemas[] = $schema_article_type;
        if ($schema_page_type) $schemas[] = $schema_page_type;
        
        return array(
            'schema_types' => $schemas,
            'structured_data_count' => count($schemas),
            'has_json_ld' => !empty($schemas),
            'has_microdata' => false,
            'has_rdfa' => false
        );
    }
    
    /**
     * Extract schema from SEOPress
     */
    private function extract_seopress_schema($post_id) {
        $schema_data = get_post_meta($post_id, '_seopress_pro_rich_snippets_type', true);
        
        return array(
            'schema_types' => $schema_data ? array($schema_data) : array(),
            'structured_data_count' => $schema_data ? 1 : 0,
            'has_json_ld' => !empty($schema_data),
            'has_microdata' => false,
            'has_rdfa' => false
        );
    }
    
    /**
     * Extract structured data from HTML (fallback)
     */
    private function extract_schema_from_html($url) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return array(
                'error' => 'Failed to fetch page: ' . $response->get_error_message(),
                'data_source' => 'html_fallback'
            );
        }
        
        $html = wp_remote_retrieve_body($response);
        
        // Count JSON-LD scripts
        $json_ld_count = preg_match_all('/<script[^>]*type=["\']application\/ld\+json["\'][^>]*>/i', $html);
        
        // Count microdata
        $microdata_count = preg_match_all('/itemscope|itemtype|itemprop/i', $html);
        
        // Count RDFa
        $rdfa_count = preg_match_all('/property=|typeof=|vocab=/i', $html);
        
        return array(
            'structured_data_count' => $json_ld_count + ($microdata_count > 0 ? 1 : 0) + ($rdfa_count > 0 ? 1 : 0),
            'has_json_ld' => $json_ld_count > 0,
            'has_microdata' => $microdata_count > 0,
            'has_rdfa' => $rdfa_count > 0,
            'data_source' => 'html_fallback'
        );
    }
    
    /**
     * Get comprehensive site analysis
     */
    public function get_comprehensive_analysis($analyze_all_pages = false) {
        $results = array(
            'plugin_info' => array(
                'active_plugins' => $this->active_seo_plugins,
                'primary_plugin' => $this->primary_seo_plugin
            ),
            'meta_analysis' => array(),
            'structured_data' => array(),
            'global_settings' => $this->get_global_seo_settings()
        );
        
        if ($analyze_all_pages) {
            $results['pages_analysis'] = $this->analyze_all_pages();
        } else {
            $results['sample_analysis'] = $this->analyze_sample_pages();
        }
        
        return $results;
    }
    
    /**
     * Get global SEO settings from active plugins
     */
    private function get_global_seo_settings() {
        $settings = array();
        
        switch ($this->primary_seo_plugin) {
            case 'rankmath':
                $settings = $this->get_rankmath_global_settings();
                break;
            case 'yoast':
                $settings = $this->get_yoast_global_settings();
                break;
            case 'seopress':
                $settings = $this->get_seopress_global_settings();
                break;
        }
        
        return $settings;
    }
    
    /**
     * Get RankMath global settings
     */
    private function get_rankmath_global_settings() {
        if (!class_exists('RankMath\Helper')) {
            return array();
        }
        
        return array(
            'sitemap_enabled' => \RankMath\Helper::get_settings('sitemap.sitemap_posts'),
            'breadcrumbs_enabled' => \RankMath\Helper::get_settings('general.breadcrumbs'),
            'social_meta_enabled' => \RankMath\Helper::get_settings('titles.social_meta'),
            'schema_enabled' => \RankMath\Helper::get_settings('titles.rich_snippets')
        );
    }
    
    /**
     * Get Yoast global settings
     */
    private function get_yoast_global_settings() {
        $options = get_option('wpseo', array());
        
        return array(
            'sitemap_enabled' => !empty($options['enable_xml_sitemap']),
            'breadcrumbs_enabled' => !empty($options['breadcrumbs-enable']),
            'social_meta_enabled' => true, // Yoast includes this by default
            'opengraph_enabled' => !empty($options['opengraph']),
            'twitter_enabled' => !empty($options['twitter'])
        );
    }
    
    /**
     * Get SEOPress global settings
     */
    private function get_seopress_global_settings() {
        return array(
            'sitemap_enabled' => get_option('seopress_xml_sitemap_option_name'),
            'social_meta_enabled' => get_option('seopress_social_option_name'),
            'schema_enabled' => get_option('seopress_pro_option_name')
        );
    }
    
    /**
     * Analyze sample pages for quick overview
     */
    private function analyze_sample_pages() {
        $posts = get_posts(array(
            'numberposts' => 10,
            'post_status' => 'publish',
            'post_type' => array('post', 'page')
        ));
        
        $results = array();
        foreach ($posts as $post) {
            $url = get_permalink($post->ID);
            $meta_data = $this->extract_meta_tags($url, $post->ID);
            $schema_data = $this->extract_structured_data($url, $post->ID);
            
            $results[] = array(
                'post_id' => $post->ID,
                'url' => $url,
                'title' => $post->post_title,
                'meta_data' => $meta_data,
                'schema_data' => $schema_data
            );
        }
        
        return $results;
    }
    
    /**
     * Analyze all pages (more comprehensive but slower)
     */
    private function analyze_all_pages() {
        // This would be implemented for full site analysis
        // For now, return sample analysis to avoid performance issues
        return $this->analyze_sample_pages();
    }
    
    /**
     * Extract OpenGraph data with plugin integration
     */
    public function extract_opengraph_data($url, $post_id = null) {
        // First try plugin-specific extraction
        if ($this->primary_seo_plugin && $post_id) {
            $plugin_data = $this->extract_opengraph_from_plugin($post_id);
            if ($plugin_data) {
                $plugin_data['data_source'] = 'plugin';
                $plugin_data['plugin'] = $this->active_seo_plugins[$this->primary_seo_plugin]['name'];
                return $plugin_data;
            }
        }
        
        // Fallback to HTML parsing
        return $this->extract_opengraph_from_html($url);
    }
    
    /**
     * Extract OpenGraph data from SEO plugins
     */
    private function extract_opengraph_from_plugin($post_id) {
        switch ($this->primary_seo_plugin) {
            case 'rankmath':
                return $this->extract_rankmath_opengraph($post_id);
            case 'yoast':
                return $this->extract_yoast_opengraph($post_id);
            case 'seopress':
                return $this->extract_seopress_opengraph($post_id);
            case 'aioseo':
                return $this->extract_aioseo_opengraph($post_id);
            default:
                return null;
        }
    }
    
    /**
     * Extract OpenGraph data from RankMath
     */
    private function extract_rankmath_opengraph($post_id) {
        if (!class_exists('RankMath\Helper')) {
            return null;
        }
        
        $og_title = \RankMath\Helper::get_post_meta('facebook_title', $post_id);
        $og_description = \RankMath\Helper::get_post_meta('facebook_description', $post_id);
        $og_image = \RankMath\Helper::get_post_meta('facebook_image', $post_id);
        
        $twitter_title = \RankMath\Helper::get_post_meta('twitter_title', $post_id);
        $twitter_description = \RankMath\Helper::get_post_meta('twitter_description', $post_id);
        $twitter_image = \RankMath\Helper::get_post_meta('twitter_image', $post_id);
        $twitter_card = \RankMath\Helper::get_post_meta('twitter_card_type', $post_id);
        
        return array(
            'opengraph_tags' => array_filter(array(
                'og:title' => $og_title,
                'og:description' => $og_description,
                'og:image' => $og_image,
                'og:type' => 'article'
            )),
            'twitter_tags' => array_filter(array(
                'twitter:title' => $twitter_title,
                'twitter:description' => $twitter_description,
                'twitter:image' => $twitter_image,
                'twitter:card' => $twitter_card ?: 'summary'
            )),
            'opengraph_complete' => !empty($og_title) && !empty($og_description) && !empty($og_image),
            'has_twitter_cards' => !empty($twitter_title) || !empty($twitter_description)
        );
    }
    
    /**
     * Extract OpenGraph data from Yoast SEO
     */
    private function extract_yoast_opengraph($post_id) {
        $og_title = get_post_meta($post_id, '_yoast_wpseo_opengraph-title', true);
        $og_description = get_post_meta($post_id, '_yoast_wpseo_opengraph-description', true);
        $og_image = get_post_meta($post_id, '_yoast_wpseo_opengraph-image', true);
        
        $twitter_title = get_post_meta($post_id, '_yoast_wpseo_twitter-title', true);
        $twitter_description = get_post_meta($post_id, '_yoast_wpseo_twitter-description', true);
        $twitter_image = get_post_meta($post_id, '_yoast_wpseo_twitter-image', true);
        
        return array(
            'opengraph_tags' => array_filter(array(
                'og:title' => $og_title,
                'og:description' => $og_description,
                'og:image' => $og_image,
                'og:type' => 'article'
            )),
            'twitter_tags' => array_filter(array(
                'twitter:title' => $twitter_title,
                'twitter:description' => $twitter_description,
                'twitter:image' => $twitter_image,
                'twitter:card' => 'summary_large_image'
            )),
            'opengraph_complete' => !empty($og_title) && !empty($og_description) && !empty($og_image),
            'has_twitter_cards' => !empty($twitter_title) || !empty($twitter_description)
        );
    }
    
    /**
     * Extract OpenGraph data from SEOPress
     */
    private function extract_seopress_opengraph($post_id) {
        $og_title = get_post_meta($post_id, '_seopress_social_fb_title', true);
        $og_description = get_post_meta($post_id, '_seopress_social_fb_desc', true);
        $og_image = get_post_meta($post_id, '_seopress_social_fb_img', true);
        
        $twitter_title = get_post_meta($post_id, '_seopress_social_twitter_title', true);
        $twitter_description = get_post_meta($post_id, '_seopress_social_twitter_desc', true);
        $twitter_image = get_post_meta($post_id, '_seopress_social_twitter_img', true);
        
        return array(
            'opengraph_tags' => array_filter(array(
                'og:title' => $og_title,
                'og:description' => $og_description,
                'og:image' => $og_image,
                'og:type' => 'article'
            )),
            'twitter_tags' => array_filter(array(
                'twitter:title' => $twitter_title,
                'twitter:description' => $twitter_description,
                'twitter:image' => $twitter_image,
                'twitter:card' => 'summary_large_image'
            )),
            'opengraph_complete' => !empty($og_title) && !empty($og_description) && !empty($og_image),
            'has_twitter_cards' => !empty($twitter_title) || !empty($twitter_description)
        );
    }
    
    /**
     * Extract OpenGraph data from All in One SEO
     */
    private function extract_aioseo_opengraph($post_id) {
        if (!function_exists('aioseo')) {
            return null;
        }
        
        $post = aioseo()->meta->metaData->getMetaData($post_id);
        if (!$post) {
            return null;
        }
        
        return array(
            'opengraph_tags' => array_filter(array(
                'og:title' => $post->og_title,
                'og:description' => $post->og_description,
                'og:image' => $post->og_image,
                'og:type' => $post->og_article_section ? 'article' : 'website'
            )),
            'twitter_tags' => array_filter(array(
                'twitter:title' => $post->twitter_title,
                'twitter:description' => $post->twitter_description,
                'twitter:image' => $post->twitter_image,
                'twitter:card' => $post->twitter_card ?: 'summary'
            )),
            'opengraph_complete' => !empty($post->og_title) && !empty($post->og_description) && !empty($post->og_image),
            'has_twitter_cards' => !empty($post->twitter_title) || !empty($post->twitter_description)
        );
    }
    
    /**
     * Extract OpenGraph data from HTML (fallback)
     */
    private function extract_opengraph_from_html($url) {
        $response = wp_remote_get($url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return array(
                'error' => 'Failed to fetch page: ' . $response->get_error_message(),
                'data_source' => 'html_fallback'
            );
        }
        
        $html = wp_remote_retrieve_body($response);
        
        // Use DOMDocument to parse HTML
        $dom = new \DOMDocument();
        @$dom->loadHTML($html);
        $xpath = new \DOMXPath($dom);
        
        $og_tags = array();
        $twitter_tags = array();
        
        // Extract OpenGraph tags
        $og_metas = $xpath->query('//meta[starts-with(@property, "og:")]');
        foreach ($og_metas as $meta) {
            $property = $meta->getAttribute('property');
            $content = $meta->getAttribute('content');
            $og_tags[$property] = $content;
        }
        
        // Extract Twitter Card tags
        $twitter_metas = $xpath->query('//meta[starts-with(@name, "twitter:")]');
        foreach ($twitter_metas as $meta) {
            $name = $meta->getAttribute('name');
            $content = $meta->getAttribute('content');
            $twitter_tags[$name] = $content;
        }
        
        $issues = array();
        
        // Check for required OpenGraph tags
        if (!isset($og_tags['og:title'])) {
            $issues[] = 'Missing og:title';
        }
        if (!isset($og_tags['og:description'])) {
            $issues[] = 'Missing og:description';
        }
        if (!isset($og_tags['og:image'])) {
            $issues[] = 'Missing og:image';
        }
        
        return array(
            'opengraph_tags' => $og_tags,
            'twitter_tags' => $twitter_tags,
            'issues' => $issues,
            'opengraph_complete' => count($issues) === 0,
            'has_twitter_cards' => !empty($twitter_tags),
            'data_source' => 'html_fallback'
        );
    }
} 