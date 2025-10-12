<?php

namespace MagicAssistant\Converters;

if (!defined('ABSPATH')) exit;

/**
 * HTML Parser
 *
 * Parses HTML structure and extracts Tailwind classes
 */
class HTML_Parser {

    /**
     * Parse HTML and extract structure with Tailwind classes
     *
     * @param string $html HTML markup
     * @return array Parsed structure with Tailwind classes
     */
    public function parse($html) {
        try {
            error_log('HTML PARSER: Starting parse of HTML (length: ' . strlen($html) . ')');

            // Create DOMDocument
            $dom = new \DOMDocument();
            libxml_use_internal_errors(true);

            // Load HTML with UTF-8 encoding
            $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
            libxml_clear_errors();

            // Extract all Tailwind classes from the document
            $tailwind_classes = $this->extract_tailwind_classes($dom);
            error_log('HTML PARSER: Extracted ' . count($tailwind_classes) . ' unique Tailwind classes');
            if (count($tailwind_classes) > 0) {
                error_log('HTML PARSER: First 20 classes: ' . implode(', ', array_slice($tailwind_classes, 0, 20)));
            } else {
                error_log('HTML PARSER WARNING: No Tailwind classes found in HTML!');
            }

            // Build clean structure tree
            $structure = $this->build_structure_tree($dom);
            error_log('HTML PARSER: Built structure tree with ' . count($structure) . ' root elements');

            // Create class mapping (element ID -> classes)
            $class_map = $this->build_class_map($dom);

            // Generate clean HTML (for reference, though we'll use structure mainly)
            $clean_html = $this->generate_clean_html($dom);

            return array(
                'structure' => $structure,
                'tailwind_classes' => $tailwind_classes,
                'class_map' => $class_map,
                'clean_html' => $clean_html
            );

        } catch (\Exception $e) {
            error_log('HTML PARSER ERROR: ' . $e->getMessage());
            return array('error' => 'Parse error: ' . $e->getMessage());
        }
    }

    /**
     * Extract all unique Tailwind classes from document
     *
     * @param \DOMDocument $dom
     * @return array Unique Tailwind classes
     */
    private function extract_tailwind_classes($dom) {
        $classes = array();
        $xpath = new \DOMXPath($dom);
        $elements = $xpath->query('//*[@class]');

        foreach ($elements as $element) {
            $class_attr = $element->getAttribute('class');
            $element_classes = array_filter(explode(' ', $class_attr));

            foreach ($element_classes as $class) {
                if (!in_array($class, $classes)) {
                    $classes[] = trim($class);
                }
            }
        }

        return $classes;
    }

    /**
     * Build structure tree from DOM
     *
     * @param \DOMDocument $dom
     * @return array Structure tree
     */
    private function build_structure_tree($dom) {
        $body = $dom->getElementsByTagName('body')->item(0);

        if (!$body) {
            // No body tag, parse root children
            $root_nodes = array();
            foreach ($dom->childNodes as $node) {
                if ($node->nodeType === XML_ELEMENT_NODE) {
                    $root_nodes[] = $this->parse_node($node);
                }
            }
            return $root_nodes;
        }

        $structure = array();
        foreach ($body->childNodes as $node) {
            if ($node->nodeType === XML_ELEMENT_NODE) {
                $structure[] = $this->parse_node($node);
            }
        }

        return $structure;
    }

    /**
     * Parse individual DOM node
     *
     * @param \DOMNode $node
     * @return array Node structure
     */
    private function parse_node($node) {
        $element = array(
            'tag' => strtolower($node->nodeName),
            'classes' => array(),
            'attributes' => array(),
            'text' => '',
            'children' => array()
        );

        // Extract attributes
        if ($node->hasAttributes()) {
            foreach ($node->attributes as $attr) {
                if ($attr->name === 'class') {
                    $element['classes'] = array_filter(explode(' ', $attr->value));
                } else {
                    $element['attributes'][$attr->name] = $attr->value;
                }
            }
        }

        // Extract text content (only direct text, not from children)
        $text_content = '';
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $text_content .= trim($child->nodeValue);
            }
        }

        if (!empty($text_content)) {
            $element['text'] = $text_content;
        }

        // Parse children
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_ELEMENT_NODE) {
                $element['children'][] = $this->parse_node($child);
            }
        }

        return $element;
    }

    /**
     * Build class map (element identifier -> classes)
     *
     * @param \DOMDocument $dom
     * @return array Class map
     */
    private function build_class_map($dom) {
        $map = array();
        $counter = 0;

        $xpath = new \DOMXPath($dom);
        $elements = $xpath->query('//*[@class]');

        foreach ($elements as $element) {
            $id = 'elem_' . $counter++;
            $classes = array_filter(explode(' ', $element->getAttribute('class')));
            $map[$id] = $classes;
        }

        return $map;
    }

    /**
     * Generate clean HTML without Tailwind classes
     *
     * @param \DOMDocument $dom
     * @return string Clean HTML
     */
    private function generate_clean_html($dom) {
        // Clone the DOM to avoid modifying original
        $clean_dom = clone $dom;

        $xpath = new \DOMXPath($clean_dom);
        $elements = $xpath->query('//*[@class]');

        // Remove class attributes
        foreach ($elements as $element) {
            $element->removeAttribute('class');
        }

        return $clean_dom->saveHTML();
    }

    /**
     * Detect if HTML contains Tailwind classes
     *
     * @param string $html
     * @return bool
     */
    public function has_tailwind($html) {
        // Common Tailwind patterns
        $tailwind_patterns = array(
            '/\bflex\b/',
            '/\bgrid\b/',
            '/\bcontainer\b/',
            '/\bmx-auto\b/',
            '/\bp-\d+\b/',
            '/\btext-\w+\b/',
            '/\bbg-\w+\b/',
            '/\brounded\b/'
        );

        foreach ($tailwind_patterns as $pattern) {
            if (preg_match($pattern, $html)) {
                return true;
            }
        }

        return false;
    }
}
