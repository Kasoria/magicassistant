<?php //phpcs:ignore
declare(strict_types=1);

namespace MagicAssistant\Utils;

/**
 * Class FrameworkExtractor
 *
 * Detects which CSS framework is installed (AutomaticCSS, CoreFramework, or native Bricks)
 * and provides framework-specific data extraction.
 *
 * @package MagicAssistant\Utils
 */
class FrameworkExtractor {

	const FRAMEWORK_ACSS = 'automatic_css';
	const FRAMEWORK_CORE = 'core_framework';
	const FRAMEWORK_BRICKS_NATIVE = 'bricks_native';

	/**
	 * Detect which CSS framework is installed
	 *
	 * @return string One of: automatic_css, core_framework, bricks_native
	 */
	public static function detect_framework(): string {
		// Check for ACSS first (has automatic_css_settings option)
		$acss_settings = get_option( 'automatic_css_settings', null );
		if ( $acss_settings !== null && ! empty( $acss_settings ) ) {
			return self::FRAMEWORK_ACSS;
		}

		// Check for Core Framework (variables typically have --cf- or specific naming patterns)
		$global_vars = get_option( 'bricks_global_variables', array() );
		if ( self::is_core_framework_variables( $global_vars ) ) {
			return self::FRAMEWORK_CORE;
		}

		// Default to Bricks native
		return self::FRAMEWORK_BRICKS_NATIVE;
	}

	/**
	 * Check if variables appear to be from Core Framework
	 *
	 * @param array $vars Array of Bricks global variables.
	 * @return bool
	 */
	private static function is_core_framework_variables( array $vars ): bool {
		// Core Framework typically has variables with specific naming patterns
		$cf_patterns = array( '--cf-', '--core-', 'coreframework' );

		foreach ( $vars as $var ) {
			$name = $var['name'] ?? '';
			foreach ( $cf_patterns as $pattern ) {
				if ( stripos( $name, $pattern ) !== false ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Get framework display label
	 *
	 * @param string $framework Framework identifier.
	 * @return string Human-readable framework name.
	 */
	public static function get_framework_label( string $framework ): string {
		switch ( $framework ) {
			case self::FRAMEWORK_ACSS:
				return 'AutomaticCSS';
			case self::FRAMEWORK_CORE:
				return 'CoreFramework';
			default:
				return 'Bricks Native';
		}
	}
}
