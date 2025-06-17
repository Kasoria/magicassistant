<?php

namespace MagicAssistant\Pagebuilders;

if (!defined('ABSPATH')) exit;

/**
 * Bricks Pagebuilder Integration
 * 
 * Handles conversion of HTML with Tailwind classes to native Bricks elements
 */
class Bricks_Integration {
    
    private $db;
    private $tailwind_to_css_map;
    private $html_to_bricks_map;
    
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_bricks_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_bricks_scripts'));
        
        // Initialize mapping tables
        $this->init_tailwind_css_map();
        $this->init_html_bricks_map();
    }
    
    public function set_db($db) {
        $this->db = $db;
    }
    
    /**
     * Enqueue Bricks-specific integration scripts
     */
    public function enqueue_bricks_scripts() {
        if ($this->is_builder_context()) {
            wp_enqueue_script(
                'magicassistant-bricks-integration',
                MAGICASSISTANT_URL . 'assets/js/bricks-integration.js',
                array('jquery'),
                MAGICASSISTANT_VERSION,
                true
            );
        }
    }
    
    /**
     * Check if we're in Bricks builder context
     */
    public function is_builder_context() {
        // Check for Bricks builder URL parameters
        $is_bricks_iframe = isset($_GET['bricks']) && $_GET['bricks'] === 'run';
        $is_bricks_builder = isset($_GET['bricks']) && $_GET['bricks'] === 'edit';
        
        // Check for Bricks functions if available
        if (function_exists('bricks_is_builder_iframe')) {
            $is_bricks_iframe = $is_bricks_iframe || bricks_is_builder_iframe();
        }
        
        if (function_exists('bricks_is_builder_main')) {
            $is_bricks_builder = $is_bricks_builder || bricks_is_builder_main();
        }
        
        return $is_bricks_iframe || $is_bricks_builder;
    }
    
    /**
     * Process HTML content and convert to Bricks elements
     */
    public function process_html_content($html_content, $content_type, $insert_method) {
        // Parse HTML structure
        $parsed_elements = $this->parse_html_structure($html_content);
        
        // Convert to Bricks elements
        $bricks_elements = $this->convert_to_bricks_elements($parsed_elements);
        
        // Generate insertion script
        $insert_script = $this->generate_insert_script($bricks_elements, $insert_method);
        
        return array(
            'elements_created' => count($bricks_elements),
            'insert_script' => $insert_script,
            'bricks_elements' => $bricks_elements,
            'message' => sprintf('Generated %d Bricks elements ready for insertion', count($bricks_elements))
        );
    }
    
    /**
     * Parse HTML structure into a tree of elements
     */
    private function parse_html_structure($html_content) {
        // Clean and prepare HTML
        $html_content = $this->clean_html($html_content);
        
        // Use DOMDocument to parse HTML
        $dom = new \DOMDocument();
        $dom->loadHTML('<!DOCTYPE html><html><body>' . $html_content . '</body></html>', 
                      LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR);
        
        $body = $dom->getElementsByTagName('body')->item(0);
        
        return $this->parse_dom_node($body);
    }
    
    /**
     * Recursively parse DOM nodes
     */
    private function parse_dom_node($node) {
        $elements = array();
        
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_ELEMENT_NODE) {
                $element = array(
                    'tag' => strtolower($child->tagName),
                    'attributes' => $this->extract_attributes($child),
                    'content' => $this->get_text_content($child),
                    'tailwind_classes' => $this->extract_tailwind_classes($child),
                    'children' => $this->parse_dom_node($child)
                );
                
                $elements[] = $element;
            }
        }
        
        return $elements;
    }
    
    /**
     * Extract attributes from DOM node
     */
    private function extract_attributes($node) {
        $attributes = array();
        
        if ($node->hasAttributes()) {
            foreach ($node->attributes as $attr) {
                $attributes[$attr->name] = $attr->value;
            }
        }
        
        return $attributes;
    }
    
    /**
     * Get text content from node (direct text only, not children)
     */
    private function get_text_content($node) {
        $text = '';
        
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $text .= trim($child->textContent);
            }
        }
        
        return $text;
    }
    
    /**
     * Extract Tailwind classes from the class attribute
     */
    private function extract_tailwind_classes($node) {
        $class_attr = $node->getAttribute('class');
        if (empty($class_attr)) {
            return array();
        }
        
        $classes = explode(' ', $class_attr);
        $tailwind_classes = array();
        
        foreach ($classes as $class) {
            $class = trim($class);
            if (!empty($class) && $this->is_tailwind_class($class)) {
                $tailwind_classes[] = $class;
            }
        }
        
        return $tailwind_classes;
    }
    
    /**
     * Check if a class is a Tailwind class
     */
    private function is_tailwind_class($class) {
        // Basic Tailwind class patterns
        $tailwind_patterns = array(
            '/^(p|m|pt|pr|pb|pl|mt|mr|mb|ml)-/', // spacing
            '/^(w|h|max-w|max-h|min-w|min-h)-/', // sizing
            '/^(text|bg|border|shadow|rounded)-/', // styling
            '/^(flex|grid|block|inline|hidden)$/', // display
            '/^(justify|items|content)-/', // flexbox/grid
            '/^(hover|focus|active):/', // states
            '/^(sm|md|lg|xl|2xl):/', // responsive
            '/^(text-)?(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/', // text sizes
        );
        
        foreach ($tailwind_patterns as $pattern) {
            if (preg_match($pattern, $class)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Convert parsed elements to Bricks elements
     */
    private function convert_to_bricks_elements($parsed_elements) {
        $bricks_elements = array();
        
        foreach ($parsed_elements as $element) {
            $bricks_element = $this->convert_single_element($element);
            if ($bricks_element) {
                $bricks_elements[] = $bricks_element;
            }
        }
        
        return $bricks_elements;
    }
    
    /**
     * Convert a single parsed element to Bricks element
     */
    private function convert_single_element($element) {
        $tag = $element['tag'];
        $content = $element['content'];
        $tailwind_classes = $element['tailwind_classes'];
        $children = $element['children'];
        
        // Map HTML tag to Bricks element
        $bricks_type = $this->map_html_tag_to_bricks($tag);
        
        if (!$bricks_type) {
            // Fallback to div/container for unknown elements
            $bricks_type = 'div';
        }
        
        // Generate unique element ID
        $element_id = $this->generate_element_id();
        
        // Convert Tailwind classes to CSS styles
        $css_styles = $this->convert_tailwind_to_css($tailwind_classes);
        
        // Build Bricks element structure
        $bricks_element = array(
            'id' => $element_id,
            'name' => $bricks_type,
            'settings' => $this->build_element_settings($bricks_type, $content, $css_styles, $element),
            'children' => array()
        );
        
        // Process children recursively
        if (!empty($children)) {
            foreach ($children as $child) {
                $child_element = $this->convert_single_element($child);
                if ($child_element) {
                    $child_element['parent'] = $element_id;
                    $bricks_element['children'][] = $child_element;
                }
            }
        }
        
        return $bricks_element;
    }
    
    /**
     * Map HTML tag to Bricks element type
     */
    private function map_html_tag_to_bricks($tag) {
        return $this->html_to_bricks_map[$tag] ?? null;
    }
    
    /**
     * Convert Tailwind classes to CSS properties
     */
    private function convert_tailwind_to_css($tailwind_classes) {
        $css_styles = array();
        
        foreach ($tailwind_classes as $class) {
            $css_property = $this->tailwind_to_css($class);
            if ($css_property) {
                $css_styles = array_merge($css_styles, $css_property);
            }
        }
        
        return $css_styles;
    }
    
    /**
     * Convert single Tailwind class to CSS property
     */
    private function tailwind_to_css($class) {
        // Handle responsive and state variants
        $variants = array();
        if (strpos($class, ':') !== false) {
            $parts = explode(':', $class);
            $class = array_pop($parts);
            $variants = $parts;
        }
        
        // Check direct mappings first
        if (isset($this->tailwind_to_css_map[$class])) {
            $css = $this->tailwind_to_css_map[$class];
            
            // Apply variants if needed
            if (!empty($variants)) {
                return $this->apply_css_variants($css, $variants);
            }
            
            return $css;
        }
        
        // Handle dynamic classes (e.g., w-32, p-4)
        return $this->parse_dynamic_tailwind_class($class, $variants);
    }
    
    /**
     * Parse dynamic Tailwind classes
     */
    private function parse_dynamic_tailwind_class($class, $variants = array()) {
        // Width classes (w-1, w-2, w-1/2, etc.)
        if (preg_match('/^w-(.+)$/', $class, $matches)) {
            return array('width' => $this->convert_tailwind_size($matches[1]));
        }
        
        // Height classes
        if (preg_match('/^h-(.+)$/', $class, $matches)) {
            return array('height' => $this->convert_tailwind_size($matches[1]));
        }
        
        // Padding classes
        if (preg_match('/^p-(.+)$/', $class, $matches)) {
            $size = $this->convert_tailwind_spacing($matches[1]);
            return array('padding' => $size);
        }
        
        if (preg_match('/^(pt|pr|pb|pl)-(.+)$/', $class, $matches)) {
            $side = array('pt' => 'top', 'pr' => 'right', 'pb' => 'bottom', 'pl' => 'left')[$matches[1]];
            $size = $this->convert_tailwind_spacing($matches[2]);
            return array("padding-{$side}" => $size);
        }
        
        // Margin classes
        if (preg_match('/^m-(.+)$/', $class, $matches)) {
            $size = $this->convert_tailwind_spacing($matches[1]);
            return array('margin' => $size);
        }
        
        if (preg_match('/^(mt|mr|mb|ml)-(.+)$/', $class, $matches)) {
            $side = array('mt' => 'top', 'mr' => 'right', 'mb' => 'bottom', 'ml' => 'left')[$matches[1]];
            $size = $this->convert_tailwind_spacing($matches[2]);
            return array("margin-{$side}" => $size);
        }
        
        // Text size classes
        if (preg_match('/^text-(.+)$/', $class, $matches)) {
            $size = $this->convert_tailwind_text_size($matches[1]);
            if ($size) {
                return array('font-size' => $size);
            }
        }
        
        // Background color classes
        if (preg_match('/^bg-(.+)$/', $class, $matches)) {
            $color = $this->convert_tailwind_color($matches[1]);
            if ($color) {
                return array('background-color' => $color);
            }
        }
        
        // Text color classes
        if (preg_match('/^text-(.+)$/', $class, $matches)) {
            $color = $this->convert_tailwind_color($matches[1]);
            if ($color) {
                return array('color' => $color);
            }
        }
        
        return null;
    }
    
    /**
     * Convert Tailwind size to CSS value
     */
    private function convert_tailwind_size($size) {
        // Handle fractions
        if (strpos($size, '/') !== false) {
            list($numerator, $denominator) = explode('/', $size);
            return (floatval($numerator) / floatval($denominator) * 100) . '%';
        }
        
        // Handle named sizes
        $size_map = array(
            'auto' => 'auto',
            'full' => '100%',
            'screen' => '100vh',
            'min' => 'min-content',
            'max' => 'max-content',
            'fit' => 'fit-content'
        );
        
        if (isset($size_map[$size])) {
            return $size_map[$size];
        }
        
        // Handle numeric sizes (multiply by 0.25rem)
        if (is_numeric($size)) {
            return ($size * 0.25) . 'rem';
        }
        
        return $size;
    }
    
    /**
     * Convert Tailwind spacing to CSS value
     */
    private function convert_tailwind_spacing($spacing) {
        if ($spacing === 'auto') {
            return 'auto';
        }
        
        if (is_numeric($spacing)) {
            return ($spacing * 0.25) . 'rem';
        }
        
        return $spacing;
    }
    
    /**
     * Convert Tailwind text size to CSS value
     */
    private function convert_tailwind_text_size($size) {
        $text_sizes = array(
            'xs' => '0.75rem',
            'sm' => '0.875rem',
            'base' => '1rem',
            'lg' => '1.125rem',
            'xl' => '1.25rem',
            '2xl' => '1.5rem',
            '3xl' => '1.875rem',
            '4xl' => '2.25rem',
            '5xl' => '3rem',
            '6xl' => '3.75rem',
            '7xl' => '4.5rem',
            '8xl' => '6rem',
            '9xl' => '8rem'
        );
        
        return $text_sizes[$size] ?? null;
    }
    
    /**
     * Convert Tailwind color to CSS value
     */
    private function convert_tailwind_color($color) {
        // Basic color mappings (could be expanded)
        $color_map = array(
            'transparent' => 'transparent',
            'current' => 'currentColor',
            'black' => '#000000',
            'white' => '#ffffff',
            'gray-50' => '#f9fafb',
            'gray-100' => '#f3f4f6',
            'gray-200' => '#e5e7eb',
            'gray-300' => '#d1d5db',
            'gray-400' => '#9ca3af',
            'gray-500' => '#6b7280',
            'gray-600' => '#4b5563',
            'gray-700' => '#374151',
            'gray-800' => '#1f2937',
            'gray-900' => '#111827',
            'red-500' => '#ef4444',
            'blue-500' => '#3b82f6',
            'green-500' => '#10b981',
            'yellow-500' => '#f59e0b',
            'purple-500' => '#8b5cf6',
            'pink-500' => '#ec4899'
        );
        
        return $color_map[$color] ?? null;
    }
    
    /**
     * Build element settings for Bricks
     */
    private function build_element_settings($bricks_type, $content, $css_styles, $original_element) {
        $settings = array();
        
        // Add content based on element type
        switch ($bricks_type) {
            case 'text':
                $settings['text'] = $content;
                break;
            case 'heading':
                $settings['text'] = $content;
                $settings['tag'] = $this->determine_heading_tag($original_element['tag']);
                break;
            case 'button':
                $settings['text'] = $content;
                $settings['link'] = $original_element['attributes']['href'] ?? '';
                break;
            case 'image':
                $settings['image'] = array(
                    'url' => $original_element['attributes']['src'] ?? '',
                    'alt' => $original_element['attributes']['alt'] ?? ''
                );
                break;
        }
        
        // Add CSS styles
        if (!empty($css_styles)) {
            $settings['_css'] = $this->convert_css_to_bricks_format($css_styles);
        }
        
        return $settings;
    }
    
    /**
     * Convert CSS styles to Bricks format
     */
    private function convert_css_to_bricks_format($css_styles) {
        $bricks_css = array();
        
        foreach ($css_styles as $property => $value) {
            // Map CSS properties to Bricks CSS structure
            $bricks_css[] = array(
                'selector' => '',
                'property' => $property,
                'value' => $value
            );
        }
        
        return $bricks_css;
    }
    
    /**
     * Determine heading tag from original element
     */
    private function determine_heading_tag($original_tag) {
        if (in_array($original_tag, array('h1', 'h2', 'h3', 'h4', 'h5', 'h6'))) {
            return $original_tag;
        }
        return 'h2'; // Default
    }
    
    /**
     * Generate unique element ID
     */
    private function generate_element_id() {
        return 'mat_' . uniqid();
    }
    
    /**
     * Generate JavaScript to insert elements into Bricks
     */
    private function generate_insert_script($bricks_elements, $insert_method) {
        $elements_json = json_encode($bricks_elements);
        
        return "
        if (typeof window.matBricksIntegration !== 'undefined') {
            window.matBricksIntegration.insertElements({$elements_json}, '{$insert_method}');
        } else {
            console.warn('Bricks integration not loaded');
        }
        ";
    }
    
    /**
     * Clean HTML content
     */
    private function clean_html($html) {
        // Remove comments and scripts
        $html = preg_replace('/<!--.*?-->/s', '', $html);
        $html = preg_replace('/<script[^>]*>.*?<\/script>/s', '', $html);
        
        // Normalize whitespace
        $html = preg_replace('/\s+/', ' ', $html);
        
        return trim($html);
    }
    
    /**
     * Initialize Tailwind to CSS mapping
     */
    private function init_tailwind_css_map() {
        $this->tailwind_to_css_map = array(
            // Display
            'block' => array('display' => 'block'),
            'inline' => array('display' => 'inline'),
            'inline-block' => array('display' => 'inline-block'),
            'flex' => array('display' => 'flex'),
            'inline-flex' => array('display' => 'inline-flex'),
            'grid' => array('display' => 'grid'),
            'hidden' => array('display' => 'none'),
            
            // Flexbox
            'flex-row' => array('flex-direction' => 'row'),
            'flex-col' => array('flex-direction' => 'column'),
            'justify-start' => array('justify-content' => 'flex-start'),
            'justify-center' => array('justify-content' => 'center'),
            'justify-end' => array('justify-content' => 'flex-end'),
            'justify-between' => array('justify-content' => 'space-between'),
            'items-start' => array('align-items' => 'flex-start'),
            'items-center' => array('align-items' => 'center'),
            'items-end' => array('align-items' => 'flex-end'),
            
            // Text alignment
            'text-left' => array('text-align' => 'left'),
            'text-center' => array('text-align' => 'center'),
            'text-right' => array('text-align' => 'right'),
            'text-justify' => array('text-align' => 'justify'),
            
            // Font weight
            'font-thin' => array('font-weight' => '100'),
            'font-light' => array('font-weight' => '300'),
            'font-normal' => array('font-weight' => '400'),
            'font-medium' => array('font-weight' => '500'),
            'font-semibold' => array('font-weight' => '600'),
            'font-bold' => array('font-weight' => '700'),
            'font-extrabold' => array('font-weight' => '800'),
            'font-black' => array('font-weight' => '900'),
            
            // Border radius
            'rounded-none' => array('border-radius' => '0'),
            'rounded-sm' => array('border-radius' => '0.125rem'),
            'rounded' => array('border-radius' => '0.25rem'),
            'rounded-md' => array('border-radius' => '0.375rem'),
            'rounded-lg' => array('border-radius' => '0.5rem'),
            'rounded-xl' => array('border-radius' => '0.75rem'),
            'rounded-2xl' => array('border-radius' => '1rem'),
            'rounded-3xl' => array('border-radius' => '1.5rem'),
            'rounded-full' => array('border-radius' => '9999px'),
            
            // Shadow
            'shadow-sm' => array('box-shadow' => '0 1px 2px 0 rgb(0 0 0 / 0.05)'),
            'shadow' => array('box-shadow' => '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'),
            'shadow-md' => array('box-shadow' => '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'),
            'shadow-lg' => array('box-shadow' => '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'),
            'shadow-xl' => array('box-shadow' => '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'),
        );
    }
    
    /**
     * Initialize HTML to Bricks element mapping
     */
    private function init_html_bricks_map() {
        $this->html_to_bricks_map = array(
            'h1' => 'heading',
            'h2' => 'heading',
            'h3' => 'heading',
            'h4' => 'heading',
            'h5' => 'heading',
            'h6' => 'heading',
            'p' => 'text-basic',
            'span' => 'text-basic',
            'div' => 'div',
            'section' => 'section',
            'article' => 'div',
            'aside' => 'div',
            'header' => 'div',
            'footer' => 'div',
            'nav' => 'div',
            'a' => 'button',
            'button' => 'button',
            'img' => 'image',
            'ul' => 'list',
            'ol' => 'list',
            'li' => 'text',
            'form' => 'form',
            'input' => 'form-field',
            'textarea' => 'form-field',
            'select' => 'form-field',
            'video' => 'video',
            'iframe' => 'code', // Embed as code block
        );
    }
} 