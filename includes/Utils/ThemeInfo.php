<?php //phpcs:ignore
declare(strict_types=1);

namespace MagicAssistant\Utils;

/**
 * Class ThemeInfo
 *
 * Utility class for retrieving information about WordPress themes.
 *
 * @package MagicAssistant\Utils
 */
class ThemeInfo {

	/**
	 * Get information about the active theme.
	 *
	 * @param array $params Optional parameters to filter the response.
	 *
	 * @return array
	 */
	public static function get_theme_info( array $params = array() ): array {
		$active_theme = wp_get_theme();
		$parent_theme = $active_theme->parent() ? wp_get_theme( $active_theme->get_template() ) : null;

		// Get theme update information.
		$theme_update_info = self::get_theme_update_info( $active_theme->get_stylesheet() );

		$theme_info = array(
			'active_theme' => array(
				'name'             => $active_theme->get( 'Name' ),
				'theme_uri'        => $active_theme->get( 'ThemeURI' ),
				'description'      => $active_theme->get( 'Description' ),
				'author'           => $active_theme->get( 'Author' ),
				'author_uri'       => $active_theme->get( 'AuthorURI' ),
				'version'          => $active_theme->get( 'Version' ),
				'license'          => $active_theme->get( 'License' ),
				'license_uri'      => $active_theme->get( 'LicenseURI' ),
				'text_domain'      => $active_theme->get( 'TextDomain' ),
				'domain_path'      => $active_theme->get( 'DomainPath' ),
				'requires_php'     => $active_theme->get( 'RequiresPHP' ),
				'requires_wp'      => $active_theme->get( 'RequiresWP' ),
				'status'           => $active_theme->get( 'Status' ),
				'tags'             => $active_theme->get( 'Tags' ),
				'template'         => $active_theme->get_template(),
				'stylesheet'       => $active_theme->get_stylesheet(),
				'screenshot'       => $active_theme->get_screenshot( 'relative' ),
				'update_available' => isset( $theme_update_info['update_available'] ) ? $theme_update_info['update_available'] : false,
				'latest_version'   => isset( $theme_update_info['latest_version'] ) ? $theme_update_info['latest_version'] : '',
				'last_updated'     => isset( $theme_update_info['last_updated'] ) ? $theme_update_info['last_updated'] : '',
			),
		);

		// Add parent theme information if it exists.
		if ( $parent_theme ) {
			$theme_info['parent_theme'] = array(
				'name'         => $parent_theme->get( 'Name' ),
				'theme_uri'    => $parent_theme->get( 'ThemeURI' ),
				'description'  => $parent_theme->get( 'Description' ),
				'author'       => $parent_theme->get( 'Author' ),
				'author_uri'   => $parent_theme->get( 'AuthorURI' ),
				'version'      => $parent_theme->get( 'Version' ),
				'license'      => $parent_theme->get( 'License' ),
				'license_uri'  => $parent_theme->get( 'LicenseURI' ),
				'text_domain'  => $parent_theme->get( 'TextDomain' ),
				'domain_path'  => $parent_theme->get( 'DomainPath' ),
				'requires_php' => $parent_theme->get( 'RequiresPHP' ),
				'requires_wp'  => $parent_theme->get( 'RequiresWP' ),
				'status'       => $parent_theme->get( 'Status' ),
				'tags'         => $parent_theme->get( 'Tags' ),
				'template'     => $parent_theme->get_template(),
				'stylesheet'   => $parent_theme->get_stylesheet(),
				'screenshot'   => $parent_theme->get_screenshot( 'relative' ),
			);
		}

		// Add theme support information.
		$theme_info['theme_supports'] = array(
			'post_thumbnails'      => current_theme_supports( 'post-thumbnails' ),
			'post_formats'         => current_theme_supports( 'post-formats' ),
			'custom_background'    => current_theme_supports( 'custom-background' ),
			'custom_header'        => current_theme_supports( 'custom-header' ),
			'custom_logo'          => current_theme_supports( 'custom-logo' ),
			'automatic_feed_links' => current_theme_supports( 'automatic-feed-links' ),
			'html5'                => current_theme_supports( 'html5' ),
			'title_tag'            => current_theme_supports( 'title-tag' ),
			'customize_selective_refresh_widgets' => current_theme_supports( 'customize-selective-refresh-widgets' ),
			'widgets'              => current_theme_supports( 'widgets' ),
			'menus'                => current_theme_supports( 'menus' ),
			'editor_styles'        => current_theme_supports( 'editor-styles' ),
			'wp_block_styles'      => current_theme_supports( 'wp-block-styles' ),
			'align_wide'           => current_theme_supports( 'align-wide' ),
			'responsive_embeds'    => current_theme_supports( 'responsive-embeds' ),
		);

		// Add theme mods information.
		$theme_info['theme_mods'] = get_theme_mods();

		// Add customizer information
		$theme_info['customizer'] = array(
			'has_custom_logo' => has_custom_logo(),
			'custom_logo_id' => get_theme_mod( 'custom_logo' ),
			'site_icon_id' => get_option( 'site_icon' ),
		);

		return $theme_info;
	}

	/**
	 * Get information about all available themes.
	 *
	 * @param array $params Optional parameters to filter the response.
	 *
	 * @return array
	 */
	public static function get_all_themes_info( array $params = array() ): array {
		$all_themes = wp_get_themes();
		$active_theme_slug = get_option( 'stylesheet' );
		$themes_data = array();

		foreach ( $all_themes as $theme_slug => $theme ) {
			$is_active = ( $theme_slug === $active_theme_slug );
			$update_info = self::get_theme_update_info( $theme_slug );

			$themes_data[] = array(
				'name'             => $theme->get( 'Name' ),
				'theme_uri'        => $theme->get( 'ThemeURI' ),
				'description'      => $theme->get( 'Description' ),
				'author'           => $theme->get( 'Author' ),
				'author_uri'       => $theme->get( 'AuthorURI' ),
				'version'          => $theme->get( 'Version' ),
				'license'          => $theme->get( 'License' ),
				'license_uri'      => $theme->get( 'LicenseURI' ),
				'text_domain'      => $theme->get( 'TextDomain' ),
				'domain_path'      => $theme->get( 'DomainPath' ),
				'requires_php'     => $theme->get( 'RequiresPHP' ),
				'requires_wp'      => $theme->get( 'RequiresWP' ),
				'status'           => $theme->get( 'Status' ),
				'tags'             => $theme->get( 'Tags' ),
				'template'         => $theme->get_template(),
				'stylesheet'       => $theme->get_stylesheet(),
				'screenshot'       => $theme->get_screenshot( 'relative' ),
				'is_active'        => $is_active,
				'update_available' => $update_info['update_available'],
				'latest_version'   => $update_info['latest_version'],
				'last_updated'     => $update_info['last_updated'],
				'theme_slug'       => $theme_slug,
			);
		}

		return array(
			'themes' => $themes_data,
			'total_count' => count( $themes_data ),
			'active_theme' => $active_theme_slug,
		);
	}

	/**
	 * Get update information for a theme.
	 *
	 * @param string $theme_slug The theme slug.
	 *
	 * @return array Update information for the theme.
	 */
	private static function get_theme_update_info( string $theme_slug ): array {
		$update_info = array(
			'update_available' => false,
			'latest_version'   => '',
			'last_updated'     => '',
		);

		// Check if there are updates available.
		$update_themes = get_site_transient( 'update_themes' );

		if ( $update_themes && isset( $update_themes->response ) ) {
			foreach ( $update_themes->response as $theme_name => $theme_data ) {
				if ( $theme_name === $theme_slug ) {
					$update_info['update_available'] = true;
					$update_info['latest_version']   = isset( $theme_data['new_version'] ) ? $theme_data['new_version'] : '';
					$update_info['last_updated']     = isset( $theme_data['last_updated'] ) ? $theme_data['last_updated'] : '';
					break;
				}
			}
		}

		return $update_info;
	}
} 