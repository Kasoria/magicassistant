<?php

namespace MagicAssistant\Converters;

if (!defined('ABSPATH')) exit;

/**
 * Bricks JSON Builder
 *
 * Builds Bricks element JSON structure from parsed HTML
 * Version: 1.1 - Fixed section->container structure
 */
class Bricks_JSON_Builder {

    private $element_counter = 0;
    private $class_counter = 0;
    private $global_classes = array();
    private $tailwind_converter = null;

    /**
     * Build Bricks JSON structure
     *
     * @param array $structure Parsed HTML structure
     * @param array $class_map Class mapping
     * @param Tailwind_To_CSS $tailwind_converter Tailwind converter instance
     * @return array Bricks JSON structure
     */
    public function build($structure, $class_map = array(), $tailwind_converter = null) {
        $this->element_counter = 0;
        $this->class_counter = 0;
        $this->global_classes = array();
        $this->tailwind_converter = $tailwind_converter;

        $elements = array();
        $section_id = $this->generate_id();
        $container_id = $this->generate_id();

        // Check if we have a single root semantic element
        $semantic_tags = array('section', 'header', 'footer', 'main');
        $has_single_semantic_root = count($structure) === 1 &&
                                     in_array($structure[0]['tag'], $semantic_tags);

        $children = array();
        $section_element = array(
            'id' => $section_id,
            'name' => 'section',
            'label' => 'MagicAssistant Generated',
            'parent' => 0,
            'children' => array($container_id),
            'settings' => array()
        );

        if ($has_single_semantic_root) {
            // Use the semantic element as our section
            $semantic_root = $structure[0];

            // Apply the root element's classes and attributes to the section
            if (!empty($semantic_root['classes']) && $this->tailwind_converter) {
                $this->apply_tailwind_styles($semantic_root['classes'], $section_element);
            }

            // Process attributes
            $this->process_attributes($semantic_root['attributes'], $section_element);

            // Set custom tag if not 'section'
            if ($semantic_root['tag'] !== 'section') {
                $section_element['settings']['tag'] = 'custom';
                $section_element['settings']['customTag'] = $semantic_root['tag'];
            }

            // Parse children of the semantic element (they go in the container)
            foreach ($semantic_root['children'] as $child_node) {
                $element = $this->build_element($child_node, $container_id);
                if ($element) {
                    $elements = array_merge($elements, $element['all_elements']);
                    $children[] = $element['id'];
                }
            }

        } else {
            // No semantic root - parse all structure elements
            foreach ($structure as $node) {
                $element = $this->build_element($node, $container_id);
                if ($element) {
                    $elements = array_merge($elements, $element['all_elements']);
                    $children[] = $element['id'];
                }
            }
        }

        // Create container element
        $container_element = array(
            'id' => $container_id,
            'name' => 'container',
            'parent' => $section_id,
            'children' => $children,
            'settings' => array()
        );

        // Add section, then container, then all child elements
        array_unshift($elements, $container_element);
        array_unshift($elements, $section_element);

        // Ensure all empty settings are objects, not arrays
        $elements = $this->normalize_settings($elements);

        return $elements;
    }

    /**
     * Normalize settings to ensure empty arrays become objects in JSON
     *
     * @param array $elements
     * @return array
     */
    private function normalize_settings($elements) {
        foreach ($elements as &$element) {
            if (isset($element['settings']) && empty($element['settings'])) {
                $element['settings'] = new \stdClass();
            }
        }
        return $elements;
    }

    /**
     * Build single Bricks element
     *
     * @param array $node HTML node
     * @param string $parent_id Parent element ID
     * @return array Element data with all nested elements
     */
    private function build_element($node, $parent_id) {
        $element_id = $this->generate_id();
        $bricks_name = $this->map_html_tag_to_bricks($node['tag'], $node);

        $element = array(
            'id' => $element_id,
            'name' => $bricks_name,
            'parent' => $parent_id,
            'children' => array(),
            'settings' => array()
        );

        // Process tag settings
        if ($this->should_set_custom_tag($node['tag'], $bricks_name)) {
            $element['settings']['tag'] = 'custom';
            $element['settings']['customTag'] = $node['tag'];
        }

        // Process classes (apply Tailwind CSS directly to element settings)
        if (!empty($node['classes']) && $this->tailwind_converter) {
            $this->apply_tailwind_styles($node['classes'], $element);
        }

        // Process text content
        if (!empty($node['text']) && $this->can_have_text_content($bricks_name)) {
            $element['settings']['text'] = $node['text'];
        }

        // Process attributes
        $this->process_attributes($node['attributes'], $element);

        // Process children
        $all_elements = array($element);
        $child_ids = array();

        if (!empty($node['children'])) {
            foreach ($node['children'] as $child_node) {
                $child_result = $this->build_element($child_node, $element_id);
                if ($child_result) {
                    $child_ids[] = $child_result['id'];
                    $all_elements = array_merge($all_elements, $child_result['all_elements']);
                }
            }
        }

        $element['children'] = $child_ids;

        return array(
            'id' => $element_id,
            'element' => $element,
            'all_elements' => $all_elements
        );
    }

    /**
     * Map HTML tag to Bricks element name
     *
     * @param string $tag HTML tag name
     * @param array $node Full node data
     * @return string Bricks element name
     */
    private function map_html_tag_to_bricks($tag, $node) {
        // Check if element has text content only (no children)
        $has_text_only = !empty($node['text']) && empty($node['children']);

        // Element mapping (semantic tags map to div when nested, since root is already section->container)
        // IMPORTANT: <a> tags map to 'button' elements
        // The href attribute is processed separately to add link settings to the button
        $mapping = array(
            'section' => 'div',
            'header' => 'div',
            'footer' => 'div',
            'main' => 'div',
            'aside' => 'div',
            'article' => 'div',
            'nav' => 'div',
            'div' => 'div',
            'a' => 'button',  // Links are button elements with href attribute processed as link settings
            'ul' => 'div',
            'ol' => 'div',
            'li' => 'div',
            'img' => 'image',
            'picture' => 'image',
            'video' => 'video',
            'button' => 'button',  // <button> and <a> tags both become button elements
            'form' => 'div',
            'input' => 'div',
            'textarea' => 'div',
            'select' => 'div',
            'label' => $has_text_only ? 'text-basic' : 'div',
            'h1' => 'heading',
            'h2' => 'heading',
            'h3' => 'heading',
            'h4' => 'heading',
            'h5' => 'heading',
            'h6' => 'heading',
            'p' => $has_text_only ? 'text-basic' : 'div',
            'span' => $has_text_only ? 'text-basic' : 'div',
            'strong' => $has_text_only ? 'text-basic' : 'div',
            'em' => $has_text_only ? 'text-basic' : 'div',
            'i' => $has_text_only ? 'text-basic' : 'div',
            'b' => $has_text_only ? 'text-basic' : 'div',
            'figcaption' => $has_text_only ? 'text-basic' : 'div',
            'address' => $has_text_only ? 'text-basic' : 'div'
        );

        return $mapping[$tag] ?? 'div';
    }

    /**
     * Check if element should have custom tag set
     *
     * @param string $html_tag HTML tag
     * @param string $bricks_name Bricks element name
     * @return bool
     */
    private function should_set_custom_tag($html_tag, $bricks_name) {
        // If Bricks element doesn't match HTML tag, might need custom tag
        $default_tags = array(
            'section' => 'section',
            'div' => 'div',
            'text-basic' => 'p',
            'heading' => 'h2',
            'image' => 'img',
            'video' => 'video',
            'button' => 'button'
        );

        $expected_tag = $default_tags[$bricks_name] ?? 'div';

        // Special handling for headings
        if ($bricks_name === 'heading' && in_array($html_tag, array('h1', 'h2', 'h3', 'h4', 'h5', 'h6'))) {
            return false; // Will handle via tag setting
        }

        return $html_tag !== $expected_tag;
    }

    /**
     * Apply Tailwind styles directly to element settings
     *
     * @param array $classes Tailwind classes
     * @param array &$element Element reference
     */
    private function apply_tailwind_styles($classes, &$element) {
        if (!$this->tailwind_converter) {
            error_log('BRICKS CONVERTER: No Tailwind converter available');
            return;
        }

        error_log('BRICKS CONVERTER: Processing ' . count($classes) . ' Tailwind classes for element: ' . $element['name']);

        // Get CSS properties for each Tailwind class
        $applied_count = 0;
        foreach ($classes as $class) {
            $css_properties = $this->tailwind_converter->get_css_properties($class);

            if (!empty($css_properties)) {
                error_log('BRICKS CONVERTER: Class "' . $class . '" -> ' . count($css_properties) . ' CSS properties');
                foreach ($css_properties as $property => $value) {
                    // Map CSS property names to Bricks property names
                    $bricks_property = $this->map_css_to_bricks_property($property);
                    if ($bricks_property) {
                        $element['settings'][$bricks_property] = $value;
                        $applied_count++;
                        error_log('BRICKS CONVERTER: Applied ' . $bricks_property . ' = ' . $value);
                    }
                }
            } else {
                error_log('BRICKS CONVERTER: Class "' . $class . '" produced no CSS properties (might be gradient/space-y/etc)');
            }
        }

        error_log('BRICKS CONVERTER: Applied ' . $applied_count . ' CSS properties to element');
    }

    /**
     * Map CSS property names to Bricks Builder property names
     *
     * @param string $css_property CSS property name (e.g., 'background-color')
     * @return string|null Bricks property name (e.g., '_backgroundColor') or null if unsupported
     */
    private function map_css_to_bricks_property($css_property) {
        // Bricks uses camelCase with underscore prefix for CSS properties
        $mapping = array(
            // Background
            'background-color' => '_backgroundColor',
            'background-image' => '_backgroundImage',
            'background-size' => '_backgroundSize',
            'background-position' => '_backgroundPosition',

            // Colors
            'color' => '_color',

            // Typography
            'font-size' => '_typography.fontSize',
            'font-weight' => '_typography.fontWeight',
            'font-family' => '_typography.fontFamily',
            'line-height' => '_typography.lineHeight',
            'text-align' => '_typography.textAlign',
            'letter-spacing' => '_typography.letterSpacing',

            // Spacing
            'padding' => '_padding',
            'padding-top' => '_padding.top',
            'padding-right' => '_padding.right',
            'padding-bottom' => '_padding.bottom',
            'padding-left' => '_padding.left',
            'margin' => '_margin',
            'margin-top' => '_margin.top',
            'margin-right' => '_margin.right',
            'margin-bottom' => '_margin.bottom',
            'margin-left' => '_margin.left',

            // Layout
            'width' => '_width',
            'height' => '_height',
            'max-width' => '_maxWidth',
            'max-height' => '_maxHeight',
            'display' => '_display',
            'position' => '_position',

            // Flexbox
            'flex-direction' => '_flexDirection',
            'justify-content' => '_justifyContent',
            'align-items' => '_alignItems',
            'flex-wrap' => '_flexWrap',
            'gap' => '_gap',

            // Grid
            'grid-template-columns' => '_gridTemplateColumns',

            // Border
            'border-width' => '_border.width',
            'border-color' => '_border.color',
            'border-style' => '_border.style',
            'border-radius' => '_borderRadius',

            // Effects
            'box-shadow' => '_boxShadow',
            'opacity' => '_opacity',

            // List
            'list-style-type' => '_listStyleType'
        );

        return $mapping[$css_property] ?? null;
    }

    /**
     * Process CSS classes and create global classes
     *
     * @param array $classes CSS classes
     * @return array Global class IDs
     */
    private function process_classes($classes) {
        $class_ids = array();

        foreach ($classes as $class) {
            // Check if class already exists
            $existing_id = null;
            foreach ($this->global_classes as $global_class) {
                if ($global_class['name'] === $class) {
                    $existing_id = $global_class['id'];
                    break;
                }
            }

            if ($existing_id) {
                $class_ids[] = $existing_id;
            } else {
                // Create new global class
                $class_id = $this->generate_class_id();
                $this->global_classes[] = array(
                    'id' => $class_id,
                    'name' => $class,
                    'settings' => array()
                );
                $class_ids[] = $class_id;
            }
        }

        return $class_ids;
    }

    /**
     * Process HTML attributes
     *
     * @param array $attributes Attributes
     * @param array &$element Element reference
     */
    private function process_attributes($attributes, &$element) {
        if (empty($attributes)) {
            return;
        }

        $custom_attributes = array();

        foreach ($attributes as $name => $value) {
            // IMPORTANT: Skip 'style' and 'class' attributes - these should not be processed as custom attributes
            // Styles should be handled via Tailwind conversion, not inline styles
            if ($name === 'style' || $name === 'class') {
                error_log("WARNING: Skipping '{$name}' attribute in Bricks conversion. Use Tailwind classes instead.");
                continue;
            }

            switch ($name) {
                case 'id':
                    $element['settings']['_cssId'] = $value;
                    break;

                case 'src':
                    if ($element['name'] === 'image') {
                        $element['settings']['image'] = array(
                            'url' => $value,
                            'external' => true,
                            'filename' => basename($value)
                        );
                    }
                    break;

                case 'href':
                    $element['settings']['link'] = 'url';
                    $element['settings']['url'] = array(
                        'url' => $value,
                        'type' => 'external'
                    );
                    break;

                case 'alt':
                    if ($element['name'] === 'image') {
                        $element['settings']['altText'] = $value;
                    }
                    break;

                case 'title':
                    if (isset($element['settings']['url'])) {
                        $element['settings']['url']['title'] = $value;
                    }
                    break;

                case 'target':
                    if ($value === '_blank' && isset($element['settings']['url'])) {
                        $element['settings']['url']['newTab'] = true;
                    }
                    break;

                case 'rel':
                    if (isset($element['settings']['url'])) {
                        $element['settings']['url']['rel'] = $value;
                    }
                    break;

                case 'aria-label':
                    if (isset($element['settings']['url'])) {
                        $element['settings']['url']['ariaLabel'] = $value;
                    } else {
                        $custom_attributes[] = array(
                            'id' => $this->generate_id(),
                            'name' => $name,
                            'value' => $value
                        );
                    }
                    break;

                default:
                    // Add to custom attributes
                    $custom_attributes[] = array(
                        'id' => $this->generate_id(),
                        'name' => $name,
                        'value' => $value
                    );
                    break;
            }
        }

        if (!empty($custom_attributes)) {
            $element['settings']['_attributes'] = $custom_attributes;
        }
    }

    /**
     * Check if element can have text content
     *
     * @param string $bricks_name Bricks element name
     * @return bool
     */
    private function can_have_text_content($bricks_name) {
        $text_elements = array('text-basic', 'heading', 'button');
        return in_array($bricks_name, $text_elements);
    }

    /**
     * Generate unique element ID
     *
     * @return string
     */
    private function generate_id() {
        return 'mat_' . uniqid() . '_' . $this->element_counter++;
    }

    /**
     * Generate unique class ID
     *
     * @return string
     */
    private function generate_class_id() {
        return 'mat_class_' . uniqid() . '_' . $this->class_counter++;
    }

    /**
     * Get generated global classes
     *
     * @return array Global classes
     */
    public function get_global_classes() {
        return $this->global_classes;
    }
}
