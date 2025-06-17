<?php

namespace MagicAssistant\PageBuilders;

if (!defined('ABSPATH')) exit;

/**
 * Bricks Element Mapper
 * 
 * Maps HTML elements to Bricks element types and CSS properties to Bricks settings
 */
class BricksElementMapper {
    
    /**
     * Map HTML element to Bricks element type
     */
    public function map_html_to_bricks_element($tag_name, $classes, $text_content) {
        // Check for specific class patterns first
        if ($this->has_class($classes, 'btn') || $this->has_class($classes, 'button')) {
            return 'button';
        }
        
        // Map based on HTML tag
        switch ($tag_name) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                return 'heading';
                
            case 'p':
                return 'text-basic';
                
            case 'a':
                return !empty($text_content) ? 'button' : 'link';
                
            case 'img':
                return 'image';
                
            case 'video':
                return 'video';
                
            case 'iframe':
                return 'html';
                
            case 'button':
                return 'button';
                
            case 'form':
                return 'form';
                
            case 'input':
                return 'form-field';
                
            case 'textarea':
                return 'form-field';
                
            case 'select':
                return 'form-field';
                
            case 'ul':
            case 'ol':
                return 'list';
                
            case 'li':
                return 'list-item';
                
            case 'blockquote':
                return 'text-basic';
                
            case 'code':
            case 'pre':
                return 'code';
                
            case 'table':
                return 'table';
                
            case 'section':
            case 'article':
            case 'header':
            case 'footer':
            case 'main':
            case 'aside':
            case 'nav':
                return 'section';
                
            case 'div':
                // Check if it should be a container based on classes
                if ($this->has_class($classes, 'container') || 
                    $this->has_class($classes, 'wrapper') ||
                    $this->has_class($classes, 'flex') ||
                    $this->has_class($classes, 'grid')) {
                    return 'container';
                }
                return 'div';
                
            case 'span':
                return 'text-basic';
                
            case 'hr':
                return 'divider';
                
            default:
                // For unknown elements, use html element
                return 'html';
        }
    }
    
    /**
     * Map CSS properties to Bricks settings
     */
    public function map_css_to_bricks_settings($parsed_styles, $bricks_element_type) {
        $settings = array();
        
        // Handle different CSS properties and convert to Bricks format
        foreach ($parsed_styles as $property => $value) {
            switch ($property) {
                // Typography
                case 'font-size':
                    $settings['typography']['fontSize'] = $this->convert_font_size($value);
                    break;
                    
                case 'font-weight':
                    $settings['typography']['fontWeight'] = $value;
                    break;
                    
                case 'font-family':
                    $settings['typography']['fontFamily'] = $value;
                    break;
                    
                case 'line-height':
                    $settings['typography']['lineHeight'] = $value;
                    break;
                    
                case 'text-align':
                    $settings['typography']['textAlign'] = $value;
                    break;
                    
                case 'text-transform':
                    $settings['typography']['textTransform'] = $value;
                    break;
                    
                case 'text-decoration-line':
                    $settings['typography']['textDecoration'] = $value;
                    break;
                    
                case 'color':
                    $settings['typography']['color'] = $this->convert_color($value);
                    break;
                    
                // Background
                case 'background-color':
                    $settings['background']['color'] = $this->convert_color($value);
                    break;
                    
                // Dimensions
                case 'width':
                    $settings['_width'] = $this->convert_dimension($value);
                    break;
                    
                case 'height':
                    $settings['_height'] = $this->convert_dimension($value);
                    break;
                    
                case 'min-width':
                    $settings['_minWidth'] = $this->convert_dimension($value);
                    break;
                    
                case 'max-width':
                    $settings['_maxWidth'] = $this->convert_dimension($value);
                    break;
                    
                case 'min-height':
                    $settings['_minHeight'] = $this->convert_dimension($value);
                    break;
                    
                case 'max-height':
                    $settings['_maxHeight'] = $this->convert_dimension($value);
                    break;
                    
                // Spacing
                case 'margin':
                    $this->set_spacing_value($settings, 'margin', $value);
                    break;
                    
                case 'margin-top':
                    $settings['_margin']['top'] = $this->convert_dimension($value);
                    break;
                    
                case 'margin-right':
                    $settings['_margin']['right'] = $this->convert_dimension($value);
                    break;
                    
                case 'margin-bottom':
                    $settings['_margin']['bottom'] = $this->convert_dimension($value);
                    break;
                    
                case 'margin-left':
                    $settings['_margin']['left'] = $this->convert_dimension($value);
                    break;
                    
                case 'padding':
                    $this->set_spacing_value($settings, 'padding', $value);
                    break;
                    
                case 'padding-top':
                    $settings['_padding']['top'] = $this->convert_dimension($value);
                    break;
                    
                case 'padding-right':
                    $settings['_padding']['right'] = $this->convert_dimension($value);
                    break;
                    
                case 'padding-bottom':
                    $settings['_padding']['bottom'] = $this->convert_dimension($value);
                    break;
                    
                case 'padding-left':
                    $settings['_padding']['left'] = $this->convert_dimension($value);
                    break;
                    
                // Display & Layout
                case 'display':
                    $settings['_display'] = $value;
                    break;
                    
                case 'position':
                    $settings['_position'] = $value;
                    break;
                    
                case 'top':
                case 'right':
                case 'bottom':
                case 'left':
                    $settings['_' . $property] = $this->convert_dimension($value);
                    break;
                    
                case 'z-index':
                    $settings['_zIndex'] = intval($value);
                    break;
                    
                // Flexbox
                case 'flex-direction':
                    $settings['_direction'] = $value;
                    break;
                    
                case 'justify-content':
                    $settings['_justifyContent'] = $this->convert_flex_value($value);
                    break;
                    
                case 'align-items':
                    $settings['_alignItems'] = $this->convert_flex_value($value);
                    break;
                    
                case 'align-content':
                    $settings['_alignContent'] = $this->convert_flex_value($value);
                    break;
                    
                case 'flex-wrap':
                    $settings['_flexWrap'] = $value;
                    break;
                    
                case 'gap':
                    $settings['_gap'] = $this->convert_dimension($value);
                    break;
                    
                case 'flex':
                    $settings['_flex'] = $value;
                    break;
                    
                case 'flex-grow':
                    $settings['_flexGrow'] = intval($value);
                    break;
                    
                case 'flex-shrink':
                    $settings['_flexShrink'] = intval($value);
                    break;
                    
                // Grid
                case 'grid-template-columns':
                    $settings['_gridTemplateColumns'] = $value;
                    break;
                    
                case 'grid-template-rows':
                    $settings['_gridTemplateRows'] = $value;
                    break;
                    
                // Borders
                case 'border-width':
                    $settings['_border']['width'] = $this->convert_dimension($value);
                    break;
                    
                case 'border-color':
                    $settings['_border']['color'] = $this->convert_color($value);
                    break;
                    
                case 'border-style':
                    $settings['_border']['style'] = $value;
                    break;
                    
                case 'border-radius':
                    $settings['_border']['radius'] = $this->convert_dimension($value);
                    break;
                    
                // Effects
                case 'box-shadow':
                    $settings['_boxShadow'] = $this->convert_box_shadow($value);
                    break;
                    
                case 'opacity':
                    $settings['_opacity'] = floatval($value);
                    break;
                    
                // Overflow
                case 'overflow':
                    $settings['_overflow'] = $value;
                    break;
                    
                case 'overflow-x':
                    $settings['_overflowX'] = $value;
                    break;
                    
                case 'overflow-y':
                    $settings['_overflowY'] = $value;
                    break;
            }
        }
        
        // Handle responsive and state variants
        if (isset($parsed_styles['media_query'])) {
            $settings = $this->wrap_with_responsive($settings, $parsed_styles);
        }
        
        if (isset($parsed_styles['pseudo_class'])) {
            $settings = $this->wrap_with_state($settings, $parsed_styles);
        }
        
        return $settings;
    }
    
    /**
     * Check if a class string contains a specific class
     */
    private function has_class($classes, $target_class) {
        if (empty($classes)) return false;
        $class_array = explode(' ', $classes);
        return in_array($target_class, $class_array);
    }
    
    /**
     * Convert font size to Bricks format
     */
    private function convert_font_size($value) {
        // Extract numeric value and unit
        if (preg_match('/^([0-9.]+)(rem|px|em|%)$/', $value, $matches)) {
            return array(
                'size' => floatval($matches[1]),
                'unit' => $matches[2]
            );
        }
        
        return $value;
    }
    
    /**
     * Convert color value to Bricks format
     */
    private function convert_color($value) {
        // If it's already a hex color, return as is
        if (preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $value)) {
            return $value;
        }
        
        // Convert rgb/rgba to hex if possible, otherwise return as is
        return $value;
    }
    
    /**
     * Convert dimension value to Bricks format
     */
    private function convert_dimension($value) {
        if ($value === 'auto' || $value === 'inherit' || $value === 'initial') {
            return $value;
        }
        
        // Extract numeric value and unit
        if (preg_match('/^([0-9.]+)(rem|px|em|%|vh|vw)$/', $value, $matches)) {
            return array(
                'size' => floatval($matches[1]),
                'unit' => $matches[2]
            );
        }
        
        // Handle percentage values
        if (preg_match('/^([0-9.]+)%$/', $value, $matches)) {
            return array(
                'size' => floatval($matches[1]),
                'unit' => '%'
            );
        }
        
        return $value;
    }
    
    /**
     * Set spacing value (margin/padding) that applies to all sides
     */
    private function set_spacing_value(&$settings, $type, $value) {
        $converted = $this->convert_dimension($value);
        $settings['_' . $type] = array(
            'top' => $converted,
            'right' => $converted,
            'bottom' => $converted,
            'left' => $converted
        );
    }
    
    /**
     * Convert flexbox values to Bricks format
     */
    private function convert_flex_value($value) {
        $flex_map = array(
            'flex-start' => 'start',
            'flex-end' => 'end',
            'space-between' => 'space-between',
            'space-around' => 'space-around',
            'space-evenly' => 'space-evenly'
        );
        
        return $flex_map[$value] ?? $value;
    }
    
    /**
     * Convert box shadow value to Bricks format
     */
    private function convert_box_shadow($value) {
        // For now, return as custom CSS since Bricks shadow format is complex
        return array(
            'css' => 'box-shadow: ' . $value
        );
    }
    
    /**
     * Wrap settings with responsive breakpoint
     */
    private function wrap_with_responsive($settings, $parsed_styles) {
        // Extract breakpoint from media query
        if (preg_match('/min-width:\s*(\d+)px/', $parsed_styles['media_query'], $matches)) {
            $breakpoint = intval($matches[1]);
            
            // Map to Bricks breakpoint names
            $bricks_breakpoint = $this->get_bricks_breakpoint($breakpoint);
            
            if ($bricks_breakpoint) {
                return array(
                    '_breakpoint' => $bricks_breakpoint,
                    '_settings' => $settings
                );
            }
        }
        
        return $settings;
    }
    
    /**
     * Wrap settings with state (hover, focus, etc.)
     */
    private function wrap_with_state($settings, $parsed_styles) {
        $state = str_replace(':', '', $parsed_styles['pseudo_class']);
        
        return array(
            '_state' => $state,
            '_settings' => $settings
        );
    }
    
    /**
     * Get Bricks breakpoint name from pixel value
     */
    private function get_bricks_breakpoint($pixel_value) {
        if ($pixel_value >= 1536) return 'desktop_landscape';
        if ($pixel_value >= 1280) return 'desktop';
        if ($pixel_value >= 1024) return 'tablet_landscape';
        if ($pixel_value >= 768) return 'tablet_portrait';
        if ($pixel_value >= 640) return 'mobile_landscape';
        
        return 'mobile_portrait';
    }
} 