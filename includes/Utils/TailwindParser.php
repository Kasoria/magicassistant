<?php

namespace MagicAssistant\Utils;

if (!defined('ABSPATH')) exit;

/**
 * Tailwind CSS Parser
 * 
 * Converts Tailwind CSS classes to regular CSS properties
 * This handles the most common Tailwind classes used in web design
 */
class TailwindParser {
    
    private $parsed_cache = array();
    
    /**
     * Parse Tailwind classes and return CSS properties
     */
    public function parse_classes($classes_string) {
        if (empty($classes_string)) {
            return array();
        }
        
        // Check cache first
        $cache_key = md5($classes_string);
        if (isset($this->parsed_cache[$cache_key])) {
            return $this->parsed_cache[$cache_key];
        }
        
        $classes = explode(' ', trim($classes_string));
        $css_properties = array();
        
        foreach ($classes as $class) {
            $class = trim($class);
            if (empty($class)) continue;
            
            $parsed = $this->parse_single_class($class);
            if ($parsed) {
                $css_properties = array_merge($css_properties, $parsed);
            }
        }
        
        // Cache the result
        $this->parsed_cache[$cache_key] = $css_properties;
        
        return $css_properties;
    }
    
    /**
     * Parse a single Tailwind class
     */
    private function parse_single_class($class) {
        // Handle responsive prefixes (sm:, md:, lg:, xl:, 2xl:)
        $responsive_prefix = '';
        if (preg_match('/^(sm|md|lg|xl|2xl):(.+)$/', $class, $matches)) {
            $responsive_prefix = $matches[1];
            $class = $matches[2];
        }
        
        // Handle state prefixes (hover:, focus:, active:, etc.)
        $state_prefix = '';
        if (preg_match('/^(hover|focus|active|visited|disabled|group-hover|group-focus):(.+)$/', $class, $matches)) {
            $state_prefix = $matches[1];
            $class = $matches[2];
        }
        
        $css = $this->get_css_for_class($class);
        
        if (!$css) {
            return null;
        }
        
        // Add responsive wrapper if needed
        if ($responsive_prefix) {
            $css = $this->wrap_with_media_query($css, $responsive_prefix);
        }
        
        // Add state wrapper if needed
        if ($state_prefix) {
            $css = $this->wrap_with_state($css, $state_prefix);
        }
        
        return $css;
    }
    
    /**
     * Get CSS properties for a specific Tailwind class
     */
    private function get_css_for_class($class) {
        // Layout classes
        if ($css = $this->parse_layout_classes($class)) return $css;
        
        // Flexbox & Grid classes
        if ($css = $this->parse_flexbox_grid_classes($class)) return $css;
        
        // Spacing classes (margin, padding)
        if ($css = $this->parse_spacing_classes($class)) return $css;
        
        // Sizing classes (width, height)
        if ($css = $this->parse_sizing_classes($class)) return $css;
        
        // Typography classes
        if ($css = $this->parse_typography_classes($class)) return $css;
        
        // Background classes
        if ($css = $this->parse_background_classes($class)) return $css;
        
        // Border classes
        if ($css = $this->parse_border_classes($class)) return $css;
        
        // Effects classes (shadows, opacity, etc.)
        if ($css = $this->parse_effects_classes($class)) return $css;
        
        // Position classes
        if ($css = $this->parse_position_classes($class)) return $css;
        
        return null;
    }
    
    /**
     * Parse layout classes (display, overflow, etc.)
     */
    private function parse_layout_classes($class) {
        $layout_map = array(
            // Display
            'block' => array('display' => 'block'),
            'inline-block' => array('display' => 'inline-block'),
            'inline' => array('display' => 'inline'),
            'flex' => array('display' => 'flex'),
            'inline-flex' => array('display' => 'inline-flex'),
            'grid' => array('display' => 'grid'),
            'inline-grid' => array('display' => 'inline-grid'),
            'hidden' => array('display' => 'none'),
            
            // Overflow
            'overflow-auto' => array('overflow' => 'auto'),
            'overflow-hidden' => array('overflow' => 'hidden'),
            'overflow-visible' => array('overflow' => 'visible'),
            'overflow-scroll' => array('overflow' => 'scroll'),
            'overflow-x-auto' => array('overflow-x' => 'auto'),
            'overflow-y-auto' => array('overflow-y' => 'auto'),
            'overflow-x-hidden' => array('overflow-x' => 'hidden'),
            'overflow-y-hidden' => array('overflow-y' => 'hidden'),
            
            // Float
            'float-right' => array('float' => 'right'),
            'float-left' => array('float' => 'left'),
            'float-none' => array('float' => 'none'),
            
            // Clear
            'clear-left' => array('clear' => 'left'),
            'clear-right' => array('clear' => 'right'),
            'clear-both' => array('clear' => 'both'),
            'clear-none' => array('clear' => 'none'),
        );
        
        return $layout_map[$class] ?? null;
    }
    
    /**
     * Parse flexbox and grid classes
     */
    private function parse_flexbox_grid_classes($class) {
        $flex_map = array(
            // Flex Direction
            'flex-row' => array('flex-direction' => 'row'),
            'flex-row-reverse' => array('flex-direction' => 'row-reverse'),
            'flex-col' => array('flex-direction' => 'column'),
            'flex-col-reverse' => array('flex-direction' => 'column-reverse'),
            
            // Flex Wrap
            'flex-wrap' => array('flex-wrap' => 'wrap'),
            'flex-wrap-reverse' => array('flex-wrap' => 'wrap-reverse'),
            'flex-nowrap' => array('flex-wrap' => 'nowrap'),
            
            // Align Items
            'items-start' => array('align-items' => 'flex-start'),
            'items-end' => array('align-items' => 'flex-end'),
            'items-center' => array('align-items' => 'center'),
            'items-baseline' => array('align-items' => 'baseline'),
            'items-stretch' => array('align-items' => 'stretch'),
            
            // Justify Content
            'justify-start' => array('justify-content' => 'flex-start'),
            'justify-end' => array('justify-content' => 'flex-end'),
            'justify-center' => array('justify-content' => 'center'),
            'justify-between' => array('justify-content' => 'space-between'),
            'justify-around' => array('justify-content' => 'space-around'),
            'justify-evenly' => array('justify-content' => 'space-evenly'),
            
            // Align Content
            'content-center' => array('align-content' => 'center'),
            'content-start' => array('align-content' => 'flex-start'),
            'content-end' => array('align-content' => 'flex-end'),
            'content-between' => array('align-content' => 'space-between'),
            'content-around' => array('align-content' => 'space-around'),
            'content-evenly' => array('align-content' => 'space-evenly'),
            
            // Align Self
            'self-auto' => array('align-self' => 'auto'),
            'self-start' => array('align-self' => 'flex-start'),
            'self-end' => array('align-self' => 'flex-end'),
            'self-center' => array('align-self' => 'center'),
            'self-stretch' => array('align-self' => 'stretch'),
            'self-baseline' => array('align-self' => 'baseline'),
            
            // Flex
            'flex-1' => array('flex' => '1 1 0%'),
            'flex-auto' => array('flex' => '1 1 auto'),
            'flex-initial' => array('flex' => '0 1 auto'),
            'flex-none' => array('flex' => 'none'),
            
            // Flex Grow
            'flex-grow-0' => array('flex-grow' => '0'),
            'flex-grow' => array('flex-grow' => '1'),
            
            // Flex Shrink
            'flex-shrink-0' => array('flex-shrink' => '0'),
            'flex-shrink' => array('flex-shrink' => '1'),
            
            // Gap
            'gap-0' => array('gap' => '0px'),
            'gap-1' => array('gap' => '0.25rem'),
            'gap-2' => array('gap' => '0.5rem'),
            'gap-3' => array('gap' => '0.75rem'),
            'gap-4' => array('gap' => '1rem'),
            'gap-5' => array('gap' => '1.25rem'),
            'gap-6' => array('gap' => '1.5rem'),
            'gap-8' => array('gap' => '2rem'),
            'gap-10' => array('gap' => '2.5rem'),
            'gap-12' => array('gap' => '3rem'),
            
            // Grid Template Columns
            'grid-cols-1' => array('grid-template-columns' => 'repeat(1, minmax(0, 1fr))'),
            'grid-cols-2' => array('grid-template-columns' => 'repeat(2, minmax(0, 1fr))'),
            'grid-cols-3' => array('grid-template-columns' => 'repeat(3, minmax(0, 1fr))'),
            'grid-cols-4' => array('grid-template-columns' => 'repeat(4, minmax(0, 1fr))'),
            'grid-cols-5' => array('grid-template-columns' => 'repeat(5, minmax(0, 1fr))'),
            'grid-cols-6' => array('grid-template-columns' => 'repeat(6, minmax(0, 1fr))'),
            'grid-cols-12' => array('grid-template-columns' => 'repeat(12, minmax(0, 1fr))'),
        );
        
        return $flex_map[$class] ?? null;
    }
    
    /**
     * Parse spacing classes (margin, padding)
     */
    private function parse_spacing_classes($class) {
        // Spacing scale
        $spacing_scale = array(
            '0' => '0px',
            'px' => '1px',
            '0.5' => '0.125rem',
            '1' => '0.25rem',
            '1.5' => '0.375rem',
            '2' => '0.5rem',
            '2.5' => '0.625rem',
            '3' => '0.75rem',
            '3.5' => '0.875rem',
            '4' => '1rem',
            '5' => '1.25rem',
            '6' => '1.5rem',
            '7' => '1.75rem',
            '8' => '2rem',
            '9' => '2.25rem',
            '10' => '2.5rem',
            '11' => '2.75rem',
            '12' => '3rem',
            '14' => '3.5rem',
            '16' => '4rem',
            '20' => '5rem',
            '24' => '6rem',
            '28' => '7rem',
            '32' => '8rem',
            '36' => '9rem',
            '40' => '10rem',
            '44' => '11rem',
            '48' => '12rem',
            '52' => '13rem',
            '56' => '14rem',
            '60' => '15rem',
            '64' => '16rem',
            '72' => '18rem',
            '80' => '20rem',
            '96' => '24rem',
        );
        
        // Margin classes
        if (preg_match('/^m-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin' => $value) : null;
        }
        
        if (preg_match('/^mx-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin-left' => $value, 'margin-right' => $value) : null;
        }
        
        if (preg_match('/^my-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin-top' => $value, 'margin-bottom' => $value) : null;
        }
        
        if (preg_match('/^mt-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin-top' => $value) : null;
        }
        
        if (preg_match('/^mr-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin-right' => $value) : null;
        }
        
        if (preg_match('/^mb-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin-bottom' => $value) : null;
        }
        
        if (preg_match('/^ml-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('margin-left' => $value) : null;
        }
        
        // Padding classes
        if (preg_match('/^p-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding' => $value) : null;
        }
        
        if (preg_match('/^px-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding-left' => $value, 'padding-right' => $value) : null;
        }
        
        if (preg_match('/^py-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding-top' => $value, 'padding-bottom' => $value) : null;
        }
        
        if (preg_match('/^pt-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding-top' => $value) : null;
        }
        
        if (preg_match('/^pr-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding-right' => $value) : null;
        }
        
        if (preg_match('/^pb-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding-bottom' => $value) : null;
        }
        
        if (preg_match('/^pl-(.+)$/', $class, $matches)) {
            $value = $spacing_scale[$matches[1]] ?? null;
            return $value ? array('padding-left' => $value) : null;
        }
        
        return null;
    }
    
    /**
     * Parse sizing classes (width, height)
     */
    private function parse_sizing_classes($class) {
        $size_map = array(
            // Width
            'w-0' => array('width' => '0px'),
            'w-px' => array('width' => '1px'),
            'w-0.5' => array('width' => '0.125rem'),
            'w-1' => array('width' => '0.25rem'),
            'w-2' => array('width' => '0.5rem'),
            'w-3' => array('width' => '0.75rem'),
            'w-4' => array('width' => '1rem'),
            'w-5' => array('width' => '1.25rem'),
            'w-6' => array('width' => '1.5rem'),
            'w-8' => array('width' => '2rem'),
            'w-10' => array('width' => '2.5rem'),
            'w-12' => array('width' => '3rem'),
            'w-16' => array('width' => '4rem'),
            'w-20' => array('width' => '5rem'),
            'w-24' => array('width' => '6rem'),
            'w-32' => array('width' => '8rem'),
            'w-40' => array('width' => '10rem'),
            'w-48' => array('width' => '12rem'),
            'w-56' => array('width' => '14rem'),
            'w-64' => array('width' => '16rem'),
            'w-auto' => array('width' => 'auto'),
            'w-1/2' => array('width' => '50%'),
            'w-1/3' => array('width' => '33.333333%'),
            'w-2/3' => array('width' => '66.666667%'),
            'w-1/4' => array('width' => '25%'),
            'w-2/4' => array('width' => '50%'),
            'w-3/4' => array('width' => '75%'),
            'w-1/5' => array('width' => '20%'),
            'w-2/5' => array('width' => '40%'),
            'w-3/5' => array('width' => '60%'),
            'w-4/5' => array('width' => '80%'),
            'w-1/6' => array('width' => '16.666667%'),
            'w-5/6' => array('width' => '83.333333%'),
            'w-full' => array('width' => '100%'),
            'w-screen' => array('width' => '100vw'),
            'w-min' => array('width' => 'min-content'),
            'w-max' => array('width' => 'max-content'),
            'w-fit' => array('width' => 'fit-content'),
            
            // Height
            'h-0' => array('height' => '0px'),
            'h-px' => array('height' => '1px'),
            'h-0.5' => array('height' => '0.125rem'),
            'h-1' => array('height' => '0.25rem'),
            'h-2' => array('height' => '0.5rem'),
            'h-3' => array('height' => '0.75rem'),
            'h-4' => array('height' => '1rem'),
            'h-5' => array('height' => '1.25rem'),
            'h-6' => array('height' => '1.5rem'),
            'h-8' => array('height' => '2rem'),
            'h-10' => array('height' => '2.5rem'),
            'h-12' => array('height' => '3rem'),
            'h-16' => array('height' => '4rem'),
            'h-20' => array('height' => '5rem'),
            'h-24' => array('height' => '6rem'),
            'h-32' => array('height' => '8rem'),
            'h-40' => array('height' => '10rem'),
            'h-48' => array('height' => '12rem'),
            'h-56' => array('height' => '14rem'),
            'h-64' => array('height' => '16rem'),
            'h-auto' => array('height' => 'auto'),
            'h-1/2' => array('height' => '50%'),
            'h-1/3' => array('height' => '33.333333%'),
            'h-2/3' => array('height' => '66.666667%'),
            'h-1/4' => array('height' => '25%'),
            'h-3/4' => array('height' => '75%'),
            'h-full' => array('height' => '100%'),
            'h-screen' => array('height' => '100vh'),
            'h-min' => array('height' => 'min-content'),
            'h-max' => array('height' => 'max-content'),
            'h-fit' => array('height' => 'fit-content'),
            
            // Min/Max Width
            'min-w-0' => array('min-width' => '0px'),
            'min-w-full' => array('min-width' => '100%'),
            'min-w-min' => array('min-width' => 'min-content'),
            'min-w-max' => array('min-width' => 'max-content'),
            'min-w-fit' => array('min-width' => 'fit-content'),
            'max-w-none' => array('max-width' => 'none'),
            'max-w-xs' => array('max-width' => '20rem'),
            'max-w-sm' => array('max-width' => '24rem'),
            'max-w-md' => array('max-width' => '28rem'),
            'max-w-lg' => array('max-width' => '32rem'),
            'max-w-xl' => array('max-width' => '36rem'),
            'max-w-2xl' => array('max-width' => '42rem'),
            'max-w-3xl' => array('max-width' => '48rem'),
            'max-w-4xl' => array('max-width' => '56rem'),
            'max-w-5xl' => array('max-width' => '64rem'),
            'max-w-6xl' => array('max-width' => '72rem'),
            'max-w-7xl' => array('max-width' => '80rem'),
            'max-w-full' => array('max-width' => '100%'),
            'max-w-screen-sm' => array('max-width' => '640px'),
            'max-w-screen-md' => array('max-width' => '768px'),
            'max-w-screen-lg' => array('max-width' => '1024px'),
            'max-w-screen-xl' => array('max-width' => '1280px'),
            'max-w-screen-2xl' => array('max-width' => '1536px'),
            
            // Min/Max Height
            'min-h-0' => array('min-height' => '0px'),
            'min-h-full' => array('min-height' => '100%'),
            'min-h-screen' => array('min-height' => '100vh'),
            'max-h-full' => array('max-height' => '100%'),
            'max-h-screen' => array('max-height' => '100vh'),
        );
        
        return $size_map[$class] ?? null;
    }
    
    /**
     * Parse typography classes
     */
    private function parse_typography_classes($class) {
        $typography_map = array(
            // Font Family
            'font-sans' => array('font-family' => 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'),
            'font-serif' => array('font-family' => 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'),
            'font-mono' => array('font-family' => 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'),
            
            // Font Size
            'text-xs' => array('font-size' => '0.75rem', 'line-height' => '1rem'),
            'text-sm' => array('font-size' => '0.875rem', 'line-height' => '1.25rem'),
            'text-base' => array('font-size' => '1rem', 'line-height' => '1.5rem'),
            'text-lg' => array('font-size' => '1.125rem', 'line-height' => '1.75rem'),
            'text-xl' => array('font-size' => '1.25rem', 'line-height' => '1.75rem'),
            'text-2xl' => array('font-size' => '1.5rem', 'line-height' => '2rem'),
            'text-3xl' => array('font-size' => '1.875rem', 'line-height' => '2.25rem'),
            'text-4xl' => array('font-size' => '2.25rem', 'line-height' => '2.5rem'),
            'text-5xl' => array('font-size' => '3rem', 'line-height' => '1'),
            'text-6xl' => array('font-size' => '3.75rem', 'line-height' => '1'),
            'text-7xl' => array('font-size' => '4.5rem', 'line-height' => '1'),
            'text-8xl' => array('font-size' => '6rem', 'line-height' => '1'),
            'text-9xl' => array('font-size' => '8rem', 'line-height' => '1'),
            
            // Font Weight
            'font-thin' => array('font-weight' => '100'),
            'font-extralight' => array('font-weight' => '200'),
            'font-light' => array('font-weight' => '300'),
            'font-normal' => array('font-weight' => '400'),
            'font-medium' => array('font-weight' => '500'),
            'font-semibold' => array('font-weight' => '600'),
            'font-bold' => array('font-weight' => '700'),
            'font-extrabold' => array('font-weight' => '800'),
            'font-black' => array('font-weight' => '900'),
            
            // Text Alignment
            'text-left' => array('text-align' => 'left'),
            'text-center' => array('text-align' => 'center'),
            'text-right' => array('text-align' => 'right'),
            'text-justify' => array('text-align' => 'justify'),
            
            // Text Color (basic colors)
            'text-black' => array('color' => '#000000'),
            'text-white' => array('color' => '#ffffff'),
            'text-gray-100' => array('color' => '#f7fafc'),
            'text-gray-200' => array('color' => '#edf2f7'),
            'text-gray-300' => array('color' => '#e2e8f0'),
            'text-gray-400' => array('color' => '#cbd5e0'),
            'text-gray-500' => array('color' => '#a0aec0'),
            'text-gray-600' => array('color' => '#718096'),
            'text-gray-700' => array('color' => '#4a5568'),
            'text-gray-800' => array('color' => '#2d3748'),
            'text-gray-900' => array('color' => '#1a202c'),
            'text-red-500' => array('color' => '#f56565'),
            'text-blue-500' => array('color' => '#4299e1'),
            'text-green-500' => array('color' => '#48bb78'),
            'text-yellow-500' => array('color' => '#ed8936'),
            'text-purple-500' => array('color' => '#9f7aea'),
            'text-pink-500' => array('color' => '#ed64a6'),
            
            // Text Decoration
            'underline' => array('text-decoration-line' => 'underline'),
            'overline' => array('text-decoration-line' => 'overline'),
            'line-through' => array('text-decoration-line' => 'line-through'),
            'no-underline' => array('text-decoration-line' => 'none'),
            
            // Text Transform
            'uppercase' => array('text-transform' => 'uppercase'),
            'lowercase' => array('text-transform' => 'lowercase'),
            'capitalize' => array('text-transform' => 'capitalize'),
            'normal-case' => array('text-transform' => 'none'),
            
            // Line Height
            'leading-3' => array('line-height' => '.75rem'),
            'leading-4' => array('line-height' => '1rem'),
            'leading-5' => array('line-height' => '1.25rem'),
            'leading-6' => array('line-height' => '1.5rem'),
            'leading-7' => array('line-height' => '1.75rem'),
            'leading-8' => array('line-height' => '2rem'),
            'leading-9' => array('line-height' => '2.25rem'),
            'leading-10' => array('line-height' => '2.5rem'),
            'leading-none' => array('line-height' => '1'),
            'leading-tight' => array('line-height' => '1.25'),
            'leading-snug' => array('line-height' => '1.375'),
            'leading-normal' => array('line-height' => '1.5'),
            'leading-relaxed' => array('line-height' => '1.625'),
            'leading-loose' => array('line-height' => '2'),
        );
        
        return $typography_map[$class] ?? null;
    }
    
    /**
     * Parse background classes
     */
    private function parse_background_classes($class) {
        $background_map = array(
            // Background Color (basic colors)
            'bg-transparent' => array('background-color' => 'transparent'),
            'bg-current' => array('background-color' => 'currentColor'),
            'bg-black' => array('background-color' => '#000000'),
            'bg-white' => array('background-color' => '#ffffff'),
            'bg-gray-50' => array('background-color' => '#f9fafb'),
            'bg-gray-100' => array('background-color' => '#f3f4f6'),
            'bg-gray-200' => array('background-color' => '#e5e7eb'),
            'bg-gray-300' => array('background-color' => '#d1d5db'),
            'bg-gray-400' => array('background-color' => '#9ca3af'),
            'bg-gray-500' => array('background-color' => '#6b7280'),
            'bg-gray-600' => array('background-color' => '#4b5563'),
            'bg-gray-700' => array('background-color' => '#374151'),
            'bg-gray-800' => array('background-color' => '#1f2937'),
            'bg-gray-900' => array('background-color' => '#111827'),
            'bg-red-50' => array('background-color' => '#fef2f2'),
            'bg-red-100' => array('background-color' => '#fee2e2'),
            'bg-red-500' => array('background-color' => '#ef4444'),
            'bg-red-600' => array('background-color' => '#dc2626'),
            'bg-red-700' => array('background-color' => '#b91c1c'),
            'bg-blue-50' => array('background-color' => '#eff6ff'),
            'bg-blue-100' => array('background-color' => '#dbeafe'),
            'bg-blue-500' => array('background-color' => '#3b82f6'),
            'bg-blue-600' => array('background-color' => '#2563eb'),
            'bg-blue-700' => array('background-color' => '#1d4ed8'),
            'bg-green-50' => array('background-color' => '#f0fdf4'),
            'bg-green-100' => array('background-color' => '#dcfce7'),
            'bg-green-500' => array('background-color' => '#22c55e'),
            'bg-green-600' => array('background-color' => '#16a34a'),
            'bg-green-700' => array('background-color' => '#15803d'),
            'bg-yellow-50' => array('background-color' => '#fefce8'),
            'bg-yellow-100' => array('background-color' => '#fef3c7'),
            'bg-yellow-500' => array('background-color' => '#eab308'),
            'bg-purple-50' => array('background-color' => '#faf5ff'),
            'bg-purple-100' => array('background-color' => '#f3e8ff'),
            'bg-purple-500' => array('background-color' => '#a855f7'),
            'bg-pink-50' => array('background-color' => '#fdf2f8'),
            'bg-pink-100' => array('background-color' => '#fce7f3'),
            'bg-pink-500' => array('background-color' => '#ec4899'),
        );
        
        return $background_map[$class] ?? null;
    }
    
    /**
     * Parse border classes
     */
    private function parse_border_classes($class) {
        $border_map = array(
            // Border Width
            'border-0' => array('border-width' => '0px'),
            'border' => array('border-width' => '1px'),
            'border-2' => array('border-width' => '2px'),
            'border-4' => array('border-width' => '4px'),
            'border-8' => array('border-width' => '8px'),
            'border-t' => array('border-top-width' => '1px'),
            'border-r' => array('border-right-width' => '1px'),
            'border-b' => array('border-bottom-width' => '1px'),
            'border-l' => array('border-left-width' => '1px'),
            'border-t-0' => array('border-top-width' => '0px'),
            'border-r-0' => array('border-right-width' => '0px'),
            'border-b-0' => array('border-bottom-width' => '0px'),
            'border-l-0' => array('border-left-width' => '0px'),
            
            // Border Radius
            'rounded-none' => array('border-radius' => '0px'),
            'rounded-sm' => array('border-radius' => '0.125rem'),
            'rounded' => array('border-radius' => '0.25rem'),
            'rounded-md' => array('border-radius' => '0.375rem'),
            'rounded-lg' => array('border-radius' => '0.5rem'),
            'rounded-xl' => array('border-radius' => '0.75rem'),
            'rounded-2xl' => array('border-radius' => '1rem'),
            'rounded-3xl' => array('border-radius' => '1.5rem'),
            'rounded-full' => array('border-radius' => '9999px'),
            
            // Border Color (basic colors)
            'border-transparent' => array('border-color' => 'transparent'),
            'border-current' => array('border-color' => 'currentColor'),
            'border-black' => array('border-color' => '#000000'),
            'border-white' => array('border-color' => '#ffffff'),
            'border-gray-200' => array('border-color' => '#e5e7eb'),
            'border-gray-300' => array('border-color' => '#d1d5db'),
            'border-gray-400' => array('border-color' => '#9ca3af'),
            'border-gray-500' => array('border-color' => '#6b7280'),
            'border-red-500' => array('border-color' => '#ef4444'),
            'border-blue-500' => array('border-color' => '#3b82f6'),
            'border-green-500' => array('border-color' => '#22c55e'),
            
            // Border Style
            'border-solid' => array('border-style' => 'solid'),
            'border-dashed' => array('border-style' => 'dashed'),
            'border-dotted' => array('border-style' => 'dotted'),
            'border-double' => array('border-style' => 'double'),
            'border-none' => array('border-style' => 'none'),
        );
        
        return $border_map[$class] ?? null;
    }
    
    /**
     * Parse effects classes (shadows, opacity, etc.)
     */
    private function parse_effects_classes($class) {
        $effects_map = array(
            // Box Shadow
            'shadow-sm' => array('box-shadow' => '0 1px 2px 0 rgb(0 0 0 / 0.05)'),
            'shadow' => array('box-shadow' => '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'),
            'shadow-md' => array('box-shadow' => '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'),
            'shadow-lg' => array('box-shadow' => '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'),
            'shadow-xl' => array('box-shadow' => '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'),
            'shadow-2xl' => array('box-shadow' => '0 25px 50px -12px rgb(0 0 0 / 0.25)'),
            'shadow-inner' => array('box-shadow' => 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'),
            'shadow-none' => array('box-shadow' => '0 0 #0000'),
            
            // Opacity
            'opacity-0' => array('opacity' => '0'),
            'opacity-5' => array('opacity' => '0.05'),
            'opacity-10' => array('opacity' => '0.1'),
            'opacity-20' => array('opacity' => '0.2'),
            'opacity-25' => array('opacity' => '0.25'),
            'opacity-30' => array('opacity' => '0.3'),
            'opacity-40' => array('opacity' => '0.4'),
            'opacity-50' => array('opacity' => '0.5'),
            'opacity-60' => array('opacity' => '0.6'),
            'opacity-70' => array('opacity' => '0.7'),
            'opacity-75' => array('opacity' => '0.75'),
            'opacity-80' => array('opacity' => '0.8'),
            'opacity-90' => array('opacity' => '0.9'),
            'opacity-95' => array('opacity' => '0.95'),
            'opacity-100' => array('opacity' => '1'),
        );
        
        return $effects_map[$class] ?? null;
    }
    
    /**
     * Parse position classes
     */
    private function parse_position_classes($class) {
        $position_map = array(
            // Position
            'static' => array('position' => 'static'),
            'fixed' => array('position' => 'fixed'),
            'absolute' => array('position' => 'absolute'),
            'relative' => array('position' => 'relative'),
            'sticky' => array('position' => 'sticky'),
            
            // Top/Right/Bottom/Left
            'inset-0' => array('top' => '0px', 'right' => '0px', 'bottom' => '0px', 'left' => '0px'),
            'inset-x-0' => array('right' => '0px', 'left' => '0px'),
            'inset-y-0' => array('top' => '0px', 'bottom' => '0px'),
            'top-0' => array('top' => '0px'),
            'right-0' => array('right' => '0px'),
            'bottom-0' => array('bottom' => '0px'),
            'left-0' => array('left' => '0px'),
            'top-auto' => array('top' => 'auto'),
            'right-auto' => array('right' => 'auto'),
            'bottom-auto' => array('bottom' => 'auto'),
            'left-auto' => array('left' => 'auto'),
            
            // Z-Index
            'z-0' => array('z-index' => '0'),
            'z-10' => array('z-index' => '10'),
            'z-20' => array('z-index' => '20'),
            'z-30' => array('z-index' => '30'),
            'z-40' => array('z-index' => '40'),
            'z-50' => array('z-index' => '50'),
            'z-auto' => array('z-index' => 'auto'),
        );
        
        return $position_map[$class] ?? null;
    }
    
    /**
     * Wrap CSS with media query for responsive design
     */
    private function wrap_with_media_query($css, $breakpoint) {
        $breakpoints = array(
            'sm' => '640px',
            'md' => '768px',
            'lg' => '1024px',
            'xl' => '1280px',
            '2xl' => '1536px'
        );
        
        if (!isset($breakpoints[$breakpoint])) {
            return $css;
        }
        
        return array(
            'media_query' => '@media (min-width: ' . $breakpoints[$breakpoint] . ')',
            'css' => $css
        );
    }
    
    /**
     * Wrap CSS with state pseudo-class
     */
    private function wrap_with_state($css, $state) {
        $state_map = array(
            'hover' => ':hover',
            'focus' => ':focus',
            'active' => ':active',
            'visited' => ':visited',
            'disabled' => ':disabled',
            'group-hover' => '.group:hover &',
            'group-focus' => '.group:focus &'
        );
        
        $pseudo_class = $state_map[$state] ?? ':' . $state;
        
        return array(
            'pseudo_class' => $pseudo_class,
            'css' => $css
        );
    }
}
