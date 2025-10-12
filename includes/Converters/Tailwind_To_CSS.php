<?php

namespace MagicAssistant\Converters;

if (!defined('ABSPATH')) exit;

/**
 * Tailwind to CSS Converter
 *
 * Converts Tailwind utility classes to vanilla CSS
 */
class Tailwind_To_CSS {

    private $color_map = array(
        'slate' => array('50' => '#f8fafc', '100' => '#f1f5f9', '200' => '#e2e8f0', '300' => '#cbd5e1', '400' => '#94a3b8', '500' => '#64748b', '600' => '#475569', '700' => '#334155', '800' => '#1e293b', '900' => '#0f172a'),
        'gray' => array('50' => '#f9fafb', '100' => '#f3f4f6', '200' => '#e5e7eb', '300' => '#d1d5db', '400' => '#9ca3af', '500' => '#6b7280', '600' => '#4b5563', '700' => '#374151', '800' => '#1f2937', '900' => '#111827'),
        'zinc' => array('50' => '#fafafa', '100' => '#f4f4f5', '200' => '#e4e4e7', '300' => '#d4d4d8', '400' => '#a1a1aa', '500' => '#71717a', '600' => '#52525b', '700' => '#3f3f46', '800' => '#27272a', '900' => '#18181b'),
        'red' => array('50' => '#fef2f2', '100' => '#fee2e2', '200' => '#fecaca', '300' => '#fca5a5', '400' => '#f87171', '500' => '#ef4444', '600' => '#dc2626', '700' => '#b91c1c', '800' => '#991b1b', '900' => '#7f1d1d'),
        'orange' => array('50' => '#fff7ed', '100' => '#ffedd5', '200' => '#fed7aa', '300' => '#fdba74', '400' => '#fb923c', '500' => '#f97316', '600' => '#ea580c', '700' => '#c2410c', '800' => '#9a3412', '900' => '#7c2d12'),
        'amber' => array('50' => '#fffbeb', '100' => '#fef3c7', '200' => '#fde68a', '300' => '#fcd34d', '400' => '#fbbf24', '500' => '#f59e0b', '600' => '#d97706', '700' => '#b45309', '800' => '#92400e', '900' => '#78350f'),
        'yellow' => array('50' => '#fefce8', '100' => '#fef9c3', '200' => '#fef08a', '300' => '#fde047', '400' => '#facc15', '500' => '#eab308', '600' => '#ca8a04', '700' => '#a16207', '800' => '#854d0e', '900' => '#713f12'),
        'lime' => array('50' => '#f7fee7', '100' => '#ecfccb', '200' => '#d9f99d', '300' => '#bef264', '400' => '#a3e635', '500' => '#84cc16', '600' => '#65a30d', '700' => '#4d7c0f', '800' => '#3f6212', '900' => '#365314'),
        'green' => array('50' => '#f0fdf4', '100' => '#dcfce7', '200' => '#bbf7d0', '300' => '#86efac', '400' => '#4ade80', '500' => '#22c55e', '600' => '#16a34a', '700' => '#15803d', '800' => '#166534', '900' => '#14532d'),
        'emerald' => array('50' => '#ecfdf5', '100' => '#d1fae5', '200' => '#a7f3d0', '300' => '#6ee7b7', '400' => '#34d399', '500' => '#10b981', '600' => '#059669', '700' => '#047857', '800' => '#065f46', '900' => '#064e3b'),
        'teal' => array('50' => '#f0fdfa', '100' => '#ccfbf1', '200' => '#99f6e4', '300' => '#5eead4', '400' => '#2dd4bf', '500' => '#14b8a6', '600' => '#0d9488', '700' => '#0f766e', '800' => '#115e59', '900' => '#134e4a'),
        'cyan' => array('50' => '#ecfeff', '100' => '#cffafe', '200' => '#a5f3fc', '300' => '#67e8f9', '400' => '#22d3ee', '500' => '#06b6d4', '600' => '#0891b2', '700' => '#0e7490', '800' => '#155e75', '900' => '#164e63'),
        'sky' => array('50' => '#f0f9ff', '100' => '#e0f2fe', '200' => '#bae6fd', '300' => '#7dd3fc', '400' => '#38bdf8', '500' => '#0ea5e9', '600' => '#0284c7', '700' => '#0369a1', '800' => '#075985', '900' => '#0c4a6e'),
        'blue' => array('50' => '#eff6ff', '100' => '#dbeafe', '200' => '#bfdbfe', '300' => '#93c5fd', '400' => '#60a5fa', '500' => '#3b82f6', '600' => '#2563eb', '700' => '#1d4ed8', '800' => '#1e40af', '900' => '#1e3a8a'),
        'indigo' => array('50' => '#eef2ff', '100' => '#e0e7ff', '200' => '#c7d2fe', '300' => '#a5b4fc', '400' => '#818cf8', '500' => '#6366f1', '600' => '#4f46e5', '700' => '#4338ca', '800' => '#3730a3', '900' => '#312e81'),
        'violet' => array('50' => '#f5f3ff', '100' => '#ede9fe', '200' => '#ddd6fe', '300' => '#c4b5fd', '400' => '#a78bfa', '500' => '#8b5cf6', '600' => '#7c3aed', '700' => '#6d28d9', '800' => '#5b21b6', '900' => '#4c1d95'),
        'purple' => array('50' => '#faf5ff', '100' => '#f3e8ff', '200' => '#e9d5ff', '300' => '#d8b4fe', '400' => '#c084fc', '500' => '#a855f7', '600' => '#9333ea', '700' => '#7e22ce', '800' => '#6b21a8', '900' => '#581c87'),
        'fuchsia' => array('50' => '#fdf4ff', '100' => '#fae8ff', '200' => '#f5d0fe', '300' => '#f0abfc', '400' => '#e879f9', '500' => '#d946ef', '600' => '#c026d3', '700' => '#a21caf', '800' => '#86198f', '900' => '#701a75'),
        'pink' => array('50' => '#fdf2f8', '100' => '#fce7f3', '200' => '#fbcfe8', '300' => '#f9a8d4', '400' => '#f472b6', '500' => '#ec4899', '600' => '#db2777', '700' => '#be185d', '800' => '#9d174d', '900' => '#831843'),
        'rose' => array('50' => '#fff1f2', '100' => '#ffe4e6', '200' => '#fecdd3', '300' => '#fda4af', '400' => '#fb7185', '500' => '#f43f5e', '600' => '#e11d48', '700' => '#be123c', '800' => '#9f1239', '900' => '#881337'),
        'white' => '#ffffff',
        'black' => '#000000',
        'transparent' => 'transparent',
        'current' => 'currentColor'
    );

    private $spacing_scale = array(
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
        '96' => '24rem'
    );

    /**
     * Convert Tailwind classes to CSS
     *
     * @param array $classes Array of Tailwind classes
     * @return string Generated CSS
     */
    public function convert($classes) {
        if (empty($classes)) {
            return '';
        }

        $css_rules = array();
        $generated_classes = array();

        foreach ($classes as $class) {
            $css_rule = $this->class_to_css($class);
            if ($css_rule) {
                if (!isset($generated_classes[$class])) {
                    $css_rules[] = ".{$class} { {$css_rule} }";
                    $generated_classes[$class] = true;
                }
            }
        }

        return implode("\n", $css_rules);
    }

    /**
     * Get CSS properties for a single Tailwind class as an associative array
     *
     * @param string $class Tailwind class
     * @return array Associative array of CSS properties (property => value)
     */
    public function get_css_properties($class) {
        $css_string = $this->class_to_css($class);
        if (!$css_string) {
            return array();
        }

        $properties = array();

        // Split by semicolon and parse each property
        $declarations = array_filter(explode(';', $css_string));

        foreach ($declarations as $declaration) {
            $parts = explode(':', $declaration, 2);
            if (count($parts) === 2) {
                $property = trim($parts[0]);
                $value = trim($parts[1]);
                $properties[$property] = $value;
            }
        }

        return $properties;
    }

    /**
     * Convert single Tailwind class to CSS rule
     *
     * @param string $class Tailwind class
     * @return string|null CSS rule or null if not recognized
     */
    private function class_to_css($class) {
        // Flexbox
        if ($class === 'flex') return 'display: flex;';
        if ($class === 'inline-flex') return 'display: inline-flex;';
        if ($class === 'flex-row') return 'flex-direction: row;';
        if ($class === 'flex-col') return 'flex-direction: column;';
        if ($class === 'flex-wrap') return 'flex-wrap: wrap;';
        if ($class === 'flex-nowrap') return 'flex-wrap: nowrap;';

        // Justify content
        if ($class === 'justify-start') return 'justify-content: flex-start;';
        if ($class === 'justify-end') return 'justify-content: flex-end;';
        if ($class === 'justify-center') return 'justify-content: center;';
        if ($class === 'justify-between') return 'justify-content: space-between;';
        if ($class === 'justify-around') return 'justify-content: space-around;';

        // Align items
        if ($class === 'items-start') return 'align-items: flex-start;';
        if ($class === 'items-end') return 'align-items: flex-end;';
        if ($class === 'items-center') return 'align-items: center;';
        if ($class === 'items-baseline') return 'align-items: baseline;';
        if ($class === 'items-stretch') return 'align-items: stretch;';

        // Grid
        if ($class === 'grid') return 'display: grid;';
        if (preg_match('/^grid-cols-(\d+)$/', $class, $matches)) {
            return "grid-template-columns: repeat({$matches[1]}, minmax(0, 1fr));";
        }
        if (preg_match('/^gap-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "gap: {$value};";
        }

        // Padding
        if (preg_match('/^p-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding: {$value};";
        }
        if (preg_match('/^px-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding-left: {$value}; padding-right: {$value};";
        }
        if (preg_match('/^py-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding-top: {$value}; padding-bottom: {$value};";
        }
        if (preg_match('/^pt-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding-top: {$value};";
        }
        if (preg_match('/^pr-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding-right: {$value};";
        }
        if (preg_match('/^pb-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding-bottom: {$value};";
        }
        if (preg_match('/^pl-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "padding-left: {$value};";
        }

        // Margin
        if (preg_match('/^m-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "margin: {$value};";
        }
        if (preg_match('/^mx-(\S+)$/', $class, $matches)) {
            $value = $matches[1] === 'auto' ? 'auto' : $this->get_spacing($matches[1]);
            return "margin-left: {$value}; margin-right: {$value};";
        }
        if (preg_match('/^my-(\S+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "margin-top: {$value}; margin-bottom: {$value};";
        }

        // Width & Height
        if ($class === 'w-full') return 'width: 100%;';
        if ($class === 'h-full') return 'height: 100%;';
        if ($class === 'w-screen') return 'width: 100vw;';
        if ($class === 'h-screen') return 'height: 100vh;';
        if (preg_match('/^w-(\d+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "width: {$value};";
        }
        if (preg_match('/^h-(\d+)$/', $class, $matches)) {
            $value = $this->get_spacing($matches[1]);
            return "height: {$value};";
        }

        // Text
        if (preg_match('/^text-(\w+)-(\d+)$/', $class, $matches)) {
            $color = $this->get_color($matches[1], $matches[2]);
            return "color: {$color};";
        }
        if ($class === 'text-center') return 'text-align: center;';
        if ($class === 'text-left') return 'text-align: left;';
        if ($class === 'text-right') return 'text-align: right;';
        if (preg_match('/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/', $class, $matches)) {
            return $this->get_font_size($matches[1]);
        }

        // Font weight
        if ($class === 'font-thin') return 'font-weight: 100;';
        if ($class === 'font-extralight') return 'font-weight: 200;';
        if ($class === 'font-light') return 'font-weight: 300;';
        if ($class === 'font-normal') return 'font-weight: 400;';
        if ($class === 'font-medium') return 'font-weight: 500;';
        if ($class === 'font-semibold') return 'font-weight: 600;';
        if ($class === 'font-bold') return 'font-weight: 700;';
        if ($class === 'font-extrabold') return 'font-weight: 800;';
        if ($class === 'font-black') return 'font-weight: 900;';

        // Background - solid colors
        if (preg_match('/^bg-(\w+)-(\d+)$/', $class, $matches)) {
            $color = $this->get_color($matches[1], $matches[2]);
            return "background-color: {$color};";
        }
        if (preg_match('/^bg-(white|black|transparent)$/', $class, $matches)) {
            $color = $this->get_color($matches[1]);
            return "background-color: {$color};";
        }

        // Background - gradients (skip these - they need special handling)
        if (preg_match('/^bg-gradient-/', $class)) {
            return null; // Gradient direction - requires combining multiple classes
        }
        if (preg_match('/^from-(\w+)-(\d+)$/', $class)) {
            return null; // Gradient start color - part of gradient
        }
        if (preg_match('/^via-(\w+)-(\d+)$/', $class)) {
            return null; // Gradient middle color - part of gradient
        }
        if (preg_match('/^to-(\w+)-(\d+)$/', $class)) {
            return null; // Gradient end color - part of gradient
        }

        // Border
        if ($class === 'border') return 'border-width: 1px;';
        if (preg_match('/^border-(\d+)$/', $class, $matches)) {
            return "border-width: {$matches[1]}px;";
        }
        if (preg_match('/^border-(\w+)-(\d+)$/', $class, $matches)) {
            $color = $this->get_color($matches[1], $matches[2]);
            return "border-color: {$color};";
        }

        // Rounded
        if ($class === 'rounded') return 'border-radius: 0.25rem;';
        if ($class === 'rounded-full') return 'border-radius: 9999px;';
        if ($class === 'rounded-none') return 'border-radius: 0px;';
        if (preg_match('/^rounded-(sm|md|lg|xl|2xl|3xl)$/', $class, $matches)) {
            return $this->get_border_radius($matches[1]);
        }

        // Shadow
        if ($class === 'shadow-sm') return 'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);';
        if ($class === 'shadow') return 'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);';
        if ($class === 'shadow-md') return 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);';
        if ($class === 'shadow-lg') return 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);';
        if ($class === 'shadow-xl') return 'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);';

        // Container
        if ($class === 'container') return 'width: 100%; max-width: 1280px; margin-left: auto; margin-right: auto;';

        // Position
        if ($class === 'relative') return 'position: relative;';
        if ($class === 'absolute') return 'position: absolute;';
        if ($class === 'fixed') return 'position: fixed;';
        if ($class === 'sticky') return 'position: sticky;';

        // Display
        if ($class === 'block') return 'display: block;';
        if ($class === 'inline-block') return 'display: inline-block;';
        if ($class === 'inline') return 'display: inline;';
        if ($class === 'hidden') return 'display: none;';

        // Font family
        if ($class === 'font-sans') return 'font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;';
        if ($class === 'font-serif') return 'font-family: ui-serif, Georgia, serif;';
        if ($class === 'font-mono') return 'font-family: ui-monospace, monospace;';

        // Space between (simplified - requires child selectors)
        if (preg_match('/^space-y-(\S+)$/', $class)) {
            return null; // Requires child selectors - skip
        }
        if (preg_match('/^space-x-(\S+)$/', $class)) {
            return null; // Requires child selectors - skip
        }

        // List style
        if ($class === 'list-none') return 'list-style-type: none;';
        if ($class === 'list-disc') return 'list-style-type: disc;';
        if ($class === 'list-decimal') return 'list-style-type: decimal;';

        // Max width
        if ($class === 'max-w-xs') return 'max-width: 20rem;';
        if ($class === 'max-w-sm') return 'max-width: 24rem;';
        if ($class === 'max-w-md') return 'max-width: 28rem;';
        if ($class === 'max-w-lg') return 'max-width: 32rem;';
        if ($class === 'max-w-xl') return 'max-width: 36rem;';
        if ($class === 'max-w-2xl') return 'max-width: 42rem;';
        if ($class === 'max-w-3xl') return 'max-width: 48rem;';
        if ($class === 'max-w-4xl') return 'max-width: 56rem;';
        if ($class === 'max-w-5xl') return 'max-width: 64rem;';
        if ($class === 'max-w-6xl') return 'max-width: 72rem;';
        if ($class === 'max-w-7xl') return 'max-width: 80rem;';
        if ($class === 'max-w-full') return 'max-width: 100%;';

        return null;
    }

    /**
     * Get spacing value from scale
     */
    private function get_spacing($key) {
        return $this->spacing_scale[$key] ?? $key;
    }

    /**
     * Get color from color map
     */
    private function get_color($color, $shade = null) {
        if ($shade && isset($this->color_map[$color][$shade])) {
            return $this->color_map[$color][$shade];
        }
        if (isset($this->color_map[$color])) {
            return is_string($this->color_map[$color]) ? $this->color_map[$color] : '#000000';
        }
        return '#000000';
    }

    /**
     * Get font size
     */
    private function get_font_size($size) {
        $sizes = array(
            'xs' => 'font-size: 0.75rem; line-height: 1rem;',
            'sm' => 'font-size: 0.875rem; line-height: 1.25rem;',
            'base' => 'font-size: 1rem; line-height: 1.5rem;',
            'lg' => 'font-size: 1.125rem; line-height: 1.75rem;',
            'xl' => 'font-size: 1.25rem; line-height: 1.75rem;',
            '2xl' => 'font-size: 1.5rem; line-height: 2rem;',
            '3xl' => 'font-size: 1.875rem; line-height: 2.25rem;',
            '4xl' => 'font-size: 2.25rem; line-height: 2.5rem;',
            '5xl' => 'font-size: 3rem; line-height: 1;',
            '6xl' => 'font-size: 3.75rem; line-height: 1;',
            '7xl' => 'font-size: 4.5rem; line-height: 1;',
            '8xl' => 'font-size: 6rem; line-height: 1;',
            '9xl' => 'font-size: 8rem; line-height: 1;'
        );
        return $sizes[$size] ?? 'font-size: 1rem;';
    }

    /**
     * Get border radius
     */
    private function get_border_radius($size) {
        $sizes = array(
            'sm' => 'border-radius: 0.125rem;',
            'md' => 'border-radius: 0.375rem;',
            'lg' => 'border-radius: 0.5rem;',
            'xl' => 'border-radius: 0.75rem;',
            '2xl' => 'border-radius: 1rem;',
            '3xl' => 'border-radius: 1.5rem;'
        );
        return $sizes[$size] ?? 'border-radius: 0.25rem;';
    }
}
