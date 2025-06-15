<?php //phpcs:ignore
declare(strict_types=1);

namespace MagicAssistant\Utils;

/**
 * Class UserInfo
 *
 * Utility class for retrieving information about WordPress users.
 * Provides detailed information about registered users and their roles.
 *
 * @package MagicAssistant\Utils
 */
class UserInfo {

	/**
	 * Get information about WordPress users.
	 *
	 * @param array $params Optional parameters to filter the response.
	 *
	 * @return array
	 */
	public static function get_user_info( array $params = array() ): array {
		$users = get_users();
		$user_data = array();
		$role_counts = array();
		$total_users = count( $users );

		foreach ( $users as $user ) {
			$user_roles = $user->roles;
			$primary_role = !empty( $user_roles ) ? $user_roles[0] : 'no_role';
			
			// Count roles
			if ( !isset( $role_counts[ $primary_role ] ) ) {
				$role_counts[ $primary_role ] = 0;
			}
			$role_counts[ $primary_role ]++;

			// Get user meta
			$user_meta = get_user_meta( $user->ID );
			
			$user_data[] = array(
				'id'              => $user->ID,
				'username'        => $user->user_login,
				'email'           => $user->user_email,
				'display_name'    => $user->display_name,
				'first_name'      => $user->first_name,
				'last_name'       => $user->last_name,
				'nickname'        => $user->nickname,
				'description'     => $user->description,
				'user_url'        => $user->user_url,
				'registered'      => $user->user_registered,
				'status'          => $user->user_status,
				'roles'           => $user_roles,
				'primary_role'    => $primary_role,
				'capabilities'    => $user->allcaps,
				'post_count'      => count_user_posts( $user->ID ),
				'avatar_url'      => get_avatar_url( $user->ID ),
				'last_login'      => get_user_meta( $user->ID, 'last_login', true ),
				'locale'          => get_user_meta( $user->ID, 'locale', true ),
			);
		}

		// Get role information
		$wp_roles = wp_roles();
		$available_roles = array();
		
		foreach ( $wp_roles->roles as $role_key => $role_info ) {
			$available_roles[ $role_key ] = array(
				'name'         => $role_info['name'],
				'capabilities' => $role_info['capabilities'],
				'user_count'   => isset( $role_counts[ $role_key ] ) ? $role_counts[ $role_key ] : 0,
			);
		}

		return array(
			'users'           => $user_data,
			'total_users'     => $total_users,
			'role_counts'     => $role_counts,
			'available_roles' => $available_roles,
			'current_user_id' => get_current_user_id(),
		);
	}

	/**
	 * Get user statistics summary.
	 *
	 * @return array
	 */
	public static function get_user_statistics(): array {
		$users = get_users();
		$total_users = count( $users );
		$role_counts = array();
		$recent_registrations = 0;
		$active_users = 0;
		
		// Calculate cutoff date for recent registrations (last 30 days)
		$recent_cutoff = date( 'Y-m-d H:i:s', strtotime( '-30 days' ) );
		
		foreach ( $users as $user ) {
			$user_roles = $user->roles;
			$primary_role = !empty( $user_roles ) ? $user_roles[0] : 'no_role';
			
			// Count roles
			if ( !isset( $role_counts[ $primary_role ] ) ) {
				$role_counts[ $primary_role ] = 0;
			}
			$role_counts[ $primary_role ]++;
			
			// Count recent registrations
			if ( $user->user_registered >= $recent_cutoff ) {
				$recent_registrations++;
			}
			
			// Count active users (have posts or recent login)
			$post_count = count_user_posts( $user->ID );
			$last_login = get_user_meta( $user->ID, 'last_login', true );
			
			if ( $post_count > 0 || ( $last_login && $last_login >= $recent_cutoff ) ) {
				$active_users++;
			}
		}

		return array(
			'total_users'          => $total_users,
			'role_distribution'    => $role_counts,
			'recent_registrations' => $recent_registrations,
			'active_users'         => $active_users,
			'inactive_users'       => $total_users - $active_users,
		);
	}

	/**
	 * Get detailed information about a specific user.
	 *
	 * @param int $user_id The user ID.
	 *
	 * @return array|null User information or null if user not found.
	 */
	public static function get_single_user_info( int $user_id ): ?array {
		$user = get_user_by( 'ID', $user_id );
		
		if ( !$user ) {
			return null;
		}

		$user_roles = $user->roles;
		$primary_role = !empty( $user_roles ) ? $user_roles[0] : 'no_role';
		
		// Get user meta
		$user_meta = get_user_meta( $user_id );
		
		// Get user's posts by type
		$post_counts = array();
		$post_types = get_post_types( array( 'public' => true ), 'names' );
		
		foreach ( $post_types as $post_type ) {
			$post_counts[ $post_type ] = count_user_posts( $user_id, $post_type );
		}

		return array(
			'id'              => $user->ID,
			'username'        => $user->user_login,
			'email'           => $user->user_email,
			'display_name'    => $user->display_name,
			'first_name'      => $user->first_name,
			'last_name'       => $user->last_name,
			'nickname'        => $user->nickname,
			'description'     => $user->description,
			'user_url'        => $user->user_url,
			'registered'      => $user->user_registered,
			'status'          => $user->user_status,
			'roles'           => $user_roles,
			'primary_role'    => $primary_role,
			'capabilities'    => $user->allcaps,
			'post_counts'     => $post_counts,
			'total_posts'     => array_sum( $post_counts ),
			'avatar_url'      => get_avatar_url( $user_id ),
			'last_login'      => get_user_meta( $user_id, 'last_login', true ),
			'locale'          => get_user_meta( $user_id, 'locale', true ),
			'user_meta'       => $user_meta,
		);
	}

	/**
	 * Get role capabilities information.
	 *
	 * @return array
	 */
	public static function get_role_capabilities(): array {
		$wp_roles = wp_roles();
		$roles_info = array();
		
		foreach ( $wp_roles->roles as $role_key => $role_info ) {
			$capabilities = array_keys( array_filter( $role_info['capabilities'] ) );
			
			$roles_info[ $role_key ] = array(
				'name'               => $role_info['name'],
				'capabilities'       => $capabilities,
				'capability_count'   => count( $capabilities ),
				'can_edit_posts'     => in_array( 'edit_posts', $capabilities ),
				'can_publish_posts'  => in_array( 'publish_posts', $capabilities ),
				'can_manage_options' => in_array( 'manage_options', $capabilities ),
				'can_edit_users'     => in_array( 'edit_users', $capabilities ),
			);
		}

		return $roles_info;
	}

	/**
	 * Get role statistics (efficient version).
	 * 
	 * This method provides a more efficient way to get role statistics
	 * without loading all user data, similar to the original UsersInfo class.
	 *
	 * @return array
	 */
	public static function get_role_stats(): array {
		// Get all available roles.
		$wp_roles  = wp_roles();
		$all_roles = $wp_roles->get_names();

		// Get role statistics.
		$role_stats = array();
		foreach ( $all_roles as $role_slug => $role_name ) {
			$role_users               = get_users( array( 'role' => $role_slug ) );
			$role_stats[ $role_slug ] = array(
				'name'  => $role_name,
				'count' => count( $role_users ),
			);
		}

		return array(
			'role_stats' => $role_stats,
		);
	}

	/**
	 * Get simplified user info (compatible with original UsersInfo class).
	 *
	 * @return array
	 */
	public static function get_simple_user_info(): array {
		return self::get_role_stats();
	}
} 