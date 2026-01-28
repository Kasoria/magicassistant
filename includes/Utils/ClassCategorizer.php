<?php //phpcs:ignore
declare(strict_types=1);

namespace MagicAssistant\Utils;

/**
 * Class ClassCategorizer
 *
 * Intelligently categorizes and filters CSS utility classes to extract the most
 * relevant ones for AI design context, instead of arbitrarily taking the first N classes.
 * Supports filtering by CSS framework category (acss, corefrm, or none).
 *
 * @package MagicAssistant\Utils
 */
class ClassCategorizer {

	/**
	 * Framework identifiers (matches user selection)
	 */
	const FRAMEWORK_ACSS = 'acss';
	const FRAMEWORK_CORE = 'coreframework';
	const FRAMEWORK_NONE = 'none';

	/**
	 * Framework category values as stored in Bricks
	 */
	const FRAMEWORK_CATEGORIES = array(
		self::FRAMEWORK_ACSS => 'acss',
		self::FRAMEWORK_CORE => 'corefrm',
	);

	/**
	 * Category definitions with patterns and limits
	 * Priority order matters - classes matched first won't be re-matched
	 */
	const CATEGORIES = array(
		'colors'     => array(
			'patterns' => array( 'bg-', 'background-', 'text-color', 'color-', 'primary', 'secondary', 'accent', 'neutral', 'shade', 'white', 'black', 'light', 'dark' ),
			'limit'    => 25,
		),
		'spacing'    => array(
			'patterns' => array( 'space-', 'gap-', 'pad-', 'mar-', 'padding-', 'margin-', '-xs', '-s', '-m', '-l', '-xl', '-xxl', 'section-space' ),
			'limit'    => 20,
		),
		'typography' => array(
			'patterns' => array( 'text-', 'font-', 'heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', 'body-', 'lead', 'fs-', 'line-height', 'letter-' ),
			'limit'    => 20,
		),
		'layout'     => array(
			'patterns' => array( 'container', 'section', 'grid', 'flex', 'wrapper', 'row', 'col-', 'column', 'sidebar', 'content-', 'width-' ),
			'limit'    => 15,
		),
		'buttons'    => array(
			'patterns' => array( 'btn', 'button', 'cta', 'link-' ),
			'limit'    => 10,
		),
		'borders'    => array(
			'patterns' => array( 'border-', 'radius-', 'rounded', 'shadow', 'outline' ),
			'limit'    => 10,
		),
		'utilities'  => array(
			'patterns' => array( 'hidden', 'visible', 'relative', 'absolute', 'fixed', 'sticky', 'overflow', 'z-', 'opacity', 'transition' ),
			'limit'    => 10,
		),
	);

	/**
	 * Check if a class belongs to a specific framework by category field
	 *
	 * @param array  $class     The class array with 'category' field.
	 * @param string $framework The framework identifier.
	 * @return bool Whether the class belongs to the framework.
	 */
	private static function belongs_to_framework( array $class, string $framework ): bool {
		if ( $framework === self::FRAMEWORK_NONE ) {
			return true; // No filtering - all classes pass
		}

		// Get the expected category value for this framework
		$expected_category = self::FRAMEWORK_CATEGORIES[ $framework ] ?? null;
		if ( ! $expected_category ) {
			return true; // Unknown framework, don't filter
		}

		// Check the class's category field
		$class_category = $class['category'] ?? '';

		return strtolower( $class_category ) === strtolower( $expected_category );
	}

	/**
	 * Categorize classes and return the most important ones
	 *
	 * @param array  $all_classes Array of class objects with 'name' and 'category' keys from Bricks.
	 * @param string $framework   Optional framework filter (acss, coreframework, or none).
	 * @return array Categorized classes organized by category.
	 */
	public static function filter_classes( array $all_classes, string $framework = self::FRAMEWORK_NONE ): array {
		$categorized  = array();
		$used_classes = array();

		// Initialize categories
		foreach ( self::CATEGORIES as $category => $config ) {
			$categorized[ $category ] = array();
		}
		$categorized['other'] = array();

		// First pass: categorize each class
		foreach ( $all_classes as $class ) {
			$name = $class['name'] ?? '';
			if ( empty( $name ) || in_array( $name, $used_classes, true ) ) {
				continue;
			}

			// Skip if doesn't belong to selected framework (by category field)
			if ( ! self::belongs_to_framework( $class, $framework ) ) {
				continue;
			}

			// Clean up the class name
			$clean_name = ltrim( $name, '.' );

			$matched = false;
			foreach ( self::CATEGORIES as $category => $config ) {
				if ( count( $categorized[ $category ] ) >= $config['limit'] ) {
					continue; // Category is full
				}

				foreach ( $config['patterns'] as $pattern ) {
					if ( stripos( $clean_name, $pattern ) !== false ) {
						$categorized[ $category ][] = $clean_name;
						$used_classes[]             = $name;
						$matched                    = true;
						break 2; // Break out of both loops
					}
				}
			}

			// If no category matched and we have room in 'other'
			if ( ! $matched && count( $categorized['other'] ) < 10 ) {
				$categorized['other'][] = $clean_name;
				$used_classes[]         = $name;
			}
		}

		// Remove empty categories
		return array_filter(
			$categorized,
			function ( $classes ) {
				return ! empty( $classes );
			}
		);
	}

	/**
	 * Get total count of filtered classes
	 *
	 * @param array $categorized The categorized classes array.
	 * @return int Total number of classes across all categories.
	 */
	public static function get_total_count( array $categorized ): int {
		$total = 0;
		foreach ( $categorized as $classes ) {
			$total += count( $classes );
		}
		return $total;
	}

	/**
	 * Format categorized classes for compact output
	 *
	 * @param array $categorized The categorized classes array.
	 * @return string Formatted string for AI consumption.
	 */
	public static function format_for_output( array $categorized ): string {
		$lines = array();

		foreach ( $categorized as $category => $classes ) {
			if ( empty( $classes ) ) {
				continue;
			}

			// Format: "category: .class1, .class2, .class3"
			$class_list = array_map(
				function ( $c ) {
					return '.' . ltrim( $c, '.' );
				},
				$classes
			);
			$lines[]    = $category . ': ' . implode( ', ', $class_list );
		}

		return implode( "\n", $lines );
	}

	/**
	 * Get available framework options
	 *
	 * @return array Array of framework options with id and label.
	 */
	public static function get_framework_options(): array {
		return array(
			array(
				'id'    => self::FRAMEWORK_NONE,
				'label' => 'No Framework (show all classes)',
			),
			array(
				'id'    => self::FRAMEWORK_ACSS,
				'label' => 'AutomaticCSS',
			),
			array(
				'id'    => self::FRAMEWORK_CORE,
				'label' => 'CoreFramework',
			),
		);
	}
}
