<?php //phpcs:ignore
declare(strict_types=1);

namespace MagicAssistant\Utils;

/**
 * Class GeneralSiteInfo
 *
 * Utility class for retrieving WordPress site information.
 * Provides access to site details, plugins, themes, and user information.
 *
 * @package MagicAssistant\Utils
 */
class GeneralSiteInfo {

	/**
	 * Get the site info.
	 *
	 * @param array $params Optional parameters to filter the response.
	 *
	 * @return array
	 */
	public static function get_site_info( array $params = array() ): array {

		$site_info = array(
			'site_name'         => get_bloginfo( 'name' ),
			'site_url'          => get_bloginfo( 'url' ),
			'site_description'  => get_bloginfo( 'description' ),
			'site_admin_email'  => get_bloginfo( 'admin_email' ),
			'wordpress_version' => get_bloginfo( 'version' ),
			'language'          => get_bloginfo( 'language' ),
			'timezone'          => wp_timezone_string(),
			'php_version'       => phpversion(),
			'mysql_version'     => self::get_mysql_version(),
			'server_info'       => self::get_server_info(),
			'active_plugins'    => get_option( 'active_plugins' ),
			'all_plugins'       => get_plugins(),
			'all_themes'        => wp_get_themes(),
			'active_theme'      => wp_get_theme(),
			'users_count'       => self::get_users_count(),
			'content_stats'     => self::get_content_stats(),
			'multisite'         => is_multisite(),
			'debug_mode'        => defined( 'WP_DEBUG' ) && WP_DEBUG,
			'memory_limit'      => ini_get( 'memory_limit' ),
			'max_execution_time' => ini_get( 'max_execution_time' ),
			'upload_max_filesize' => ini_get( 'upload_max_filesize' ),
			'post_max_size'     => ini_get( 'post_max_size' ),
		);

		return $site_info;
	}

	/**
	 * Get MySQL version.
	 *
	 * @return string
	 */
	private static function get_mysql_version(): string {
		global $wpdb;
		return $wpdb->db_version();
	}

	/**
	 * Get server information.
	 *
	 * @return array
	 */
	private static function get_server_info(): array {
		return array(
			'software'    => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
			'php_version' => phpversion(),
			'os'          => php_uname( 's' ),
			'architecture' => php_uname( 'm' ),
		);
	}

	/**
	 * Get users count by role.
	 *
	 * @return array
	 */
	private static function get_users_count(): array {
		$users = get_users();
		$total = count( $users );
		
		$roles = array();
		foreach ( $users as $user ) {
			$user_roles = $user->roles;
			if ( !empty( $user_roles ) && isset( $user_roles[0] ) ) {
				$primary_role = $user_roles[0];
				if ( !isset( $roles[ $primary_role ] ) ) {
					$roles[ $primary_role ] = 0;
				}
				$roles[ $primary_role ]++;
			}
		}

		return array(
			'total' => $total,
			'roles' => $roles,
		);
	}

	/**
	 * Get content statistics.
	 *
	 * @return array
	 */
	private static function get_content_stats(): array {
		$posts = wp_count_posts( 'post' );
		$pages = wp_count_posts( 'page' );
		$comments = wp_count_comments();
		$media = wp_count_posts( 'attachment' );

		return array(
			'posts' => array(
				'total'     => $posts->publish + $posts->draft + $posts->pending + $posts->private,
				'published' => $posts->publish,
				'draft'     => $posts->draft,
				'pending'   => $posts->pending,
				'private'   => $posts->private,
			),
			'pages' => array(
				'total'     => $pages->publish + $pages->draft + $pages->pending + $pages->private,
				'published' => $pages->publish,
				'draft'     => $pages->draft,
				'pending'   => $pages->pending,
				'private'   => $pages->private,
			),
			'comments' => array(
				'total'    => $comments->total_comments,
				'approved' => $comments->approved,
				'pending'  => $comments->moderated,
				'spam'     => $comments->spam,
				'trash'    => $comments->trash,
			),
			'media' => array(
				'total' => $media->inherit,
			),
		);
	}

	/**
	 * Get simplified site overview.
	 *
	 * @return array
	 */
	public static function get_site_overview(): array {
		$full_info = self::get_site_info();
		
		return array(
			'site_name'         => $full_info['site_name'],
			'site_url'          => $full_info['site_url'],
			'wordpress_version' => $full_info['wordpress_version'],
			'php_version'       => $full_info['php_version'],
			'active_theme'      => array(
				'name'    => $full_info['active_theme']->get( 'Name' ),
				'version' => $full_info['active_theme']->get( 'Version' ),
			),
			'plugins_count'     => array(
				'total'  => count( $full_info['all_plugins'] ),
				'active' => count( $full_info['active_plugins'] ),
			),
			'users_count'       => $full_info['users_count']['total'],
			'content_summary'   => array(
				'posts'    => $full_info['content_stats']['posts']['total'],
				'pages'    => $full_info['content_stats']['pages']['total'],
				'comments' => $full_info['content_stats']['comments']['total'],
			),
		);
	}

	/**
	 * Get system requirements check.
	 *
	 * @return array
	 */
	public static function get_system_requirements(): array {
		$php_version = phpversion();
		$wp_version = get_bloginfo( 'version' );
		$memory_limit = ini_get( 'memory_limit' );
		$max_execution_time = ini_get( 'max_execution_time' );
		$upload_max_filesize = ini_get( 'upload_max_filesize' );

		return array(
			'php' => array(
				'current'     => $php_version,
				'recommended' => '8.0+',
				'meets_req'   => version_compare( $php_version, '7.4', '>=' ),
			),
			'wordpress' => array(
				'current' => $wp_version,
				'latest'  => self::get_latest_wp_version(),
			),
			'memory' => array(
				'current'     => $memory_limit,
				'recommended' => '256M',
				'meets_req'   => self::convert_to_bytes( $memory_limit ) >= self::convert_to_bytes( '128M' ),
			),
			'execution_time' => array(
				'current'     => $max_execution_time,
				'recommended' => '300',
				'meets_req'   => intval( $max_execution_time ) >= 30 || $max_execution_time === '0',
			),
			'upload_size' => array(
				'current'     => $upload_max_filesize,
				'recommended' => '32M',
				'meets_req'   => self::convert_to_bytes( $upload_max_filesize ) >= self::convert_to_bytes( '2M' ),
			),
		);
	}

	/**
	 * Get latest WordPress version (simplified check).
	 *
	 * @return string
	 */
	private static function get_latest_wp_version(): string {
		$updates = get_core_updates();
		if ( !empty( $updates ) && isset( $updates[0]->version ) ) {
			return $updates[0]->version;
		}
		return get_bloginfo( 'version' ); // Fallback to current version
	}

	/**
	 * Convert size string to bytes.
	 *
	 * @param string $size Size string (e.g., '256M', '1G').
	 * @return int
	 */
	private static function convert_to_bytes( string $size ): int {
		$size = trim( $size );
		$last = strtolower( $size[ strlen( $size ) - 1 ] );
		$size = (int) $size;

		switch ( $last ) {
			case 'g':
				$size *= 1024;
				// Fall through.
			case 'm':
				$size *= 1024;
				// Fall through.
			case 'k':
				$size *= 1024;
		}

		return $size;
	}
} 