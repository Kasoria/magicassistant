<?php
namespace MagicAssistant;

/**
 * Track successful and failed login events and maintain last login timestamps.
 */
class Login_Tracker {

    /**
     * Register WordPress hooks to capture login activity.
     */
    public static function register() {
        add_action('wp_login', [__CLASS__, 'track_login_success'], 10, 2);
        add_action('wp_login_failed', [__CLASS__, 'track_login_failed']);
    }

    /**
     * Handle successful login events.
     *
     * @param string   $user_login Username.
     * @param \WP_User $user       User object.
     */
    public static function track_login_success($user_login, $user) {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '';
        $events = get_option('magicassistant_login_events', []);
        array_unshift($events, [
            'type' => 'success',
            'user' => $user_login,
            'time' => time(),
            'ip'   => $ip,
        ]);
        // Keep only the latest 100 events
        $events = array_slice($events, 0, 100);
        update_option('magicassistant_login_events', $events, false);

        // Store last login for admin audit tool
        update_user_meta($user->ID, 'magicassistant_last_login', time());
    }

    /**
     * Handle failed login attempts.
     *
     * @param string $username Attempted username.
     */
    public static function track_login_failed($username) {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '';
        $events = get_option('magicassistant_login_events', []);
        array_unshift($events, [
            'type' => 'failure',
            'user' => $username,
            'time' => time(),
            'ip'   => $ip,
        ]);
        $events = array_slice($events, 0, 100);
        update_option('magicassistant_login_events', $events, false);
    }
} 