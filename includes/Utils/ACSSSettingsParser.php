<?php //phpcs:ignore
declare(strict_types=1);

namespace MagicAssistant\Utils;

/**
 * Class ACSSSettingsParser
 *
 * Extracts design-relevant tokens from AutomaticCSS settings.
 * Outputs CSS variable names as ACSS generates them (e.g., --primary not --color-primary).
 *
 * @package MagicAssistant\Utils
 */
class ACSSSettingsParser {

	/**
	 * Core color keys - stored as color-X, output as --X
	 */
	const CORE_COLORS = array(
		'color-primary'   => 'primary',
		'color-secondary' => 'secondary',
		'color-accent'    => 'accent',
		'color-tertiary'  => 'tertiary',
		'color-neutral'   => 'neutral',
		'color-base'      => 'base',
		'color-shade'     => 'shade',
		'color-action'    => 'action',
		'color-success'   => 'success',
		'color-warning'   => 'warning',
		'color-danger'    => 'danger',
		'color-info'      => 'info',
	);

	/**
	 * Semantic/contextual color keys
	 */
	const SEMANTIC_COLORS = array(
		'link-color',
		'link-color-hover',
		'text-dark',
		'text-light',
		'body-color',
		'body-bg-color',
		'focus-color',
	);

	/**
	 * Typography base values - these define the system
	 */
	const TYPOGRAPHY_BASE = array(
		'base-text-desk',
		'base-text-mob',
		'base-heading-desk',
		'base-heading-mob',
		'base-text-lh',
		'base-heading-lh',
		'text-scale',
		'heading-scale',
		'text-font-family',
		'heading-font-family',
		'text-font-weight',
		'heading-font-weight',
		'heading-letter-spacing',
		'heading-text-transform',
	);

	/**
	 * Spacing base values - these define the spacing system
	 */
	const SPACING_BASE = array(
		'base-space',
		'base-space-min',
		'space-scale',
		'mob-space-scale',
		'gutter',
	);

	/**
	 * Layout/width values
	 */
	const LAYOUT_KEYS = array(
		'content-width',
		'container-width',
		'website-width',
		'vp-min',
		'vp-max',
		'body-max-width',
	);

	/**
	 * Breakpoint values
	 */
	const BREAKPOINT_KEYS = array(
		'breakpoint-xs',
		'breakpoint-s',
		'breakpoint-m',
		'breakpoint-l',
		'breakpoint-xl',
		'breakpoint-xxl',
	);

	/**
	 * Border/radius values
	 */
	const BORDER_KEYS = array(
		'base-radius',
		'radius-scale',
		'border-size',
		'border-style',
	);

	/**
	 * Effects values
	 */
	const EFFECTS_KEYS = array(
		'box-shadow-1-value',
		'box-shadow-2-value',
		'box-shadow-3-value',
		'transition-duration',
		'transition-timing',
	);

	/**
	 * Extract design tokens from ACSS settings
	 *
	 * @param array $settings The full automatic_css_settings array.
	 * @return array Extracted tokens organized by category.
	 */
	public static function extract( array $settings ): array {
		$tokens = array(
			'colors'      => array(),
			'typography'  => array(),
			'spacing'     => array(),
			'layout'      => array(),
			'breakpoints' => array(),
			'borders'     => array(),
			'effects'     => array(),
		);

		if ( empty( $settings ) ) {
			return $tokens;
		}

		// Extract core colors (stored as color-X, output as X)
		foreach ( self::CORE_COLORS as $stored_key => $output_name ) {
			if ( isset( $settings[ $stored_key ] ) && ! empty( $settings[ $stored_key ] ) ) {
				$tokens['colors'][ $output_name ] = $settings[ $stored_key ];
			}
		}

		// Extract semantic colors
		foreach ( self::SEMANTIC_COLORS as $key ) {
			if ( isset( $settings[ $key ] ) && ! empty( $settings[ $key ] ) ) {
				$tokens['colors'][ $key ] = $settings[ $key ];
			}
		}

		// Extract typography base values
		foreach ( self::TYPOGRAPHY_BASE as $key ) {
			if ( isset( $settings[ $key ] ) && $settings[ $key ] !== '' ) {
				$tokens['typography'][ $key ] = $settings[ $key ];
			}
		}

		// Extract spacing base values
		foreach ( self::SPACING_BASE as $key ) {
			if ( isset( $settings[ $key ] ) && $settings[ $key ] !== '' ) {
				$tokens['spacing'][ $key ] = $settings[ $key ];
			}
		}

		// Extract layout values
		foreach ( self::LAYOUT_KEYS as $key ) {
			if ( isset( $settings[ $key ] ) && $settings[ $key ] !== '' ) {
				$tokens['layout'][ $key ] = $settings[ $key ];
			}
		}

		// Extract breakpoints
		foreach ( self::BREAKPOINT_KEYS as $key ) {
			if ( isset( $settings[ $key ] ) && $settings[ $key ] !== '' ) {
				$tokens['breakpoints'][ $key ] = $settings[ $key ];
			}
		}

		// Extract borders
		foreach ( self::BORDER_KEYS as $key ) {
			if ( isset( $settings[ $key ] ) && $settings[ $key ] !== '' ) {
				$tokens['borders'][ $key ] = $settings[ $key ];
			}
		}

		// Extract effects
		foreach ( self::EFFECTS_KEYS as $key ) {
			if ( isset( $settings[ $key ] ) && $settings[ $key ] !== '' ) {
				$tokens['effects'][ $key ] = $settings[ $key ];
			}
		}

		return $tokens;
	}

	/**
	 * Format extracted tokens for compact output with ACSS variable naming
	 *
	 * @param array $tokens Tokens organized by category.
	 * @return array Formatted sections for each category.
	 */
	public static function format_for_output( array $tokens ): array {
		$sections = array();

		// Format colors
		if ( ! empty( $tokens['colors'] ) ) {
			$lines = array();
			foreach ( $tokens['colors'] as $name => $value ) {
				$var_name = '--' . $name;
				$lines[]  = "{$var_name}: {$value}";
			}
			$sections['colors'] = implode( '; ', $lines );
		}

		// Format typography with explanation of the system
		if ( ! empty( $tokens['typography'] ) ) {
			$lines = array();
			foreach ( $tokens['typography'] as $name => $value ) {
				$var_name = '--' . $name;
				$lines[]  = "{$var_name}: {$value}";
			}
			$sections['typography'] = implode( '; ', $lines );
		}

		// Format spacing with explanation
		if ( ! empty( $tokens['spacing'] ) ) {
			$lines = array();
			foreach ( $tokens['spacing'] as $name => $value ) {
				$var_name = '--' . $name;
				$lines[]  = "{$var_name}: {$value}";
			}
			// Add note about generated variables
			$sections['spacing'] = implode( '; ', $lines );
		}

		// Format layout
		if ( ! empty( $tokens['layout'] ) ) {
			$lines = array();
			foreach ( $tokens['layout'] as $name => $value ) {
				$var_name = '--' . $name;
				$lines[]  = "{$var_name}: {$value}";
			}
			$sections['layout'] = implode( '; ', $lines );
		}

		// Format breakpoints
		if ( ! empty( $tokens['breakpoints'] ) ) {
			$lines = array();
			foreach ( $tokens['breakpoints'] as $name => $value ) {
				// Breakpoints are just values in px
				$lines[] = "{$name}: {$value}px";
			}
			$sections['breakpoints'] = implode( '; ', $lines );
		}

		// Format borders
		if ( ! empty( $tokens['borders'] ) ) {
			$lines = array();
			foreach ( $tokens['borders'] as $name => $value ) {
				$var_name = '--' . $name;
				$lines[]  = "{$var_name}: {$value}";
			}
			$sections['borders'] = implode( '; ', $lines );
		}

		// Format effects
		if ( ! empty( $tokens['effects'] ) ) {
			$lines = array();
			foreach ( $tokens['effects'] as $name => $value ) {
				$var_name = '--' . $name;
				$lines[]  = "{$var_name}: {$value}";
			}
			$sections['effects'] = implode( '; ', $lines );
		}

		return $sections;
	}

	/**
	 * Get the generated ACSS variable names for AI reference
	 * These are the actual CSS variable names ACSS generates that can be used in designs
	 *
	 * @return array List of common ACSS variable patterns
	 */
	public static function get_acss_variable_reference(): array {
		return array(
			'colors'     => array(
				'Core colors'  => '--primary, --secondary, --accent, --tertiary, --neutral, --base, --shade, --action',
				'Color shades' => '--{color}-light, --{color}-dark, --{color}-ultra-light, --{color}-ultra-dark',
				'Transparency' => '--{color}-trans-10 through --{color}-trans-90',
				'Status'       => '--success, --warning, --danger, --info',
				'Text'         => '--text-dark, --text-light, --link-color',
			),
			'spacing'    => array(
				'Space scale'   => '--space-xs, --space-s, --space-m, --space-l, --space-xl, --space-xxl',
				'Section space' => '--section-space-s, --section-space-m, --section-space-l, --section-space-xl',
				'Gaps'          => '--content-gap, --grid-gap, --gutter',
			),
			'typography' => array(
				'Text sizes'    => '--text-xs, --text-s, --text-m, --text-l, --text-xl, --text-xxl',
				'Headings'      => '--h1, --h2, --h3, --h4, --h5, --h6',
				'Font families' => '--text-font-family, --heading-font-family',
			),
			'borders'    => array(
				'Radius' => '--radius-s, --radius-m, --radius-l, --radius-full (or just --radius for base)',
			),
			'shadows'    => array(
				'Box shadows' => '--shadow-s, --shadow-m, --shadow-l (or --box-shadow-m, --box-shadow-l)',
			),
		);
	}
}
