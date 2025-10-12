<?php

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

/**
 * Bricks Builder Converter
 *
 * Orchestrates the conversion of HTML + Tailwind CSS to Bricks JSON format
 *
 * Pipeline:
 * 1. Parse HTML structure
 * 2. Convert Tailwind classes to vanilla CSS
 * 3. Build Bricks JSON element structure
 * 4. Return formatted output for insertion
 */
class Bricks_Converter {

    private $html_parser;
    private $tailwind_converter;
    private $json_builder;

    public function __construct() {
        // Load converter dependencies
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/Converters/HTML_Parser.php';
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/Converters/Tailwind_To_CSS.php';
        require_once MAGIC_ASSISTANT_PLUGIN_PATH . 'includes/Converters/Bricks_JSON_Builder.php';

        $this->html_parser = new Converters\HTML_Parser();
        $this->tailwind_converter = new Converters\Tailwind_To_CSS();
        $this->json_builder = new Converters\Bricks_JSON_Builder();
    }

    /**
     * Main conversion method
     *
     * @param string $html HTML markup with Tailwind classes
     * @param string $js Optional JavaScript code
     * @return array Formatted output for Bricks insertion
     */
    public function convert($html, $js = '') {
        try {
            // Step 1: Parse HTML and extract structure + Tailwind classes
            $parsed = $this->html_parser->parse($html);

            if (!$parsed || isset($parsed['error'])) {
                return array(
                    'success' => false,
                    'error' => $parsed['error'] ?? 'Failed to parse HTML'
                );
            }

            // Step 2: Convert Tailwind classes to vanilla CSS
            $css = $this->tailwind_converter->convert($parsed['tailwind_classes']);

            // Step 3: Build Bricks JSON structure (pass tailwind converter for direct CSS application)
            $bricks_json = $this->json_builder->build($parsed['structure'], $parsed['class_map'], $this->tailwind_converter);

            // Step 4: Format output for frontend
            return array(
                'success' => true,
                'html' => $parsed['clean_html'], // HTML without Tailwind classes
                'css' => $css,
                'js' => $js,
                'bricks_structure' => $bricks_json,
                'metadata' => array(
                    'element_count' => count($bricks_json),
                    'has_custom_css' => !empty($css),
                    'has_javascript' => !empty($js)
                )
            );

        } catch (\Exception $e) {
            return array(
                'success' => false,
                'error' => 'Conversion failed: ' . $e->getMessage()
            );
        }
    }

    /**
     * Validate HTML before conversion
     *
     * @param string $html HTML to validate
     * @return array Validation result
     */
    public function validate($html) {
        if (empty($html)) {
            return array(
                'valid' => false,
                'error' => 'Empty HTML provided'
            );
        }

        // Basic HTML validation
        $dom = new \DOMDocument();
        libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        if (!$loaded) {
            return array(
                'valid' => false,
                'error' => 'Invalid HTML markup'
            );
        }

        return array(
            'valid' => true,
            'element_count' => $dom->getElementsByTagName('*')->length
        );
    }

    /**
     * Get conversion statistics
     *
     * @return array Statistics about conversion usage
     */
    public function get_stats() {
        // Could track conversions in database for analytics
        return array(
            'total_conversions' => 0,
            'successful_conversions' => 0,
            'failed_conversions' => 0,
            'avg_conversion_time' => 0
        );
    }
}
