<?php
/**
 * Public sharing functionality for MagicAssistant
 *
 * @package MagicAssistant
 */

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

class Public_Share {

    private $db;

    public function __construct() {
        add_action('init', array($this, 'add_rewrite_rules'));
        add_action('template_redirect', array($this, 'handle_shared_conversation'));
        add_filter('query_vars', array($this, 'add_query_vars'));

        // Flush rewrite rules on activation
        register_activation_hook(MAGIC_ASSISTANT_PLUGIN_FILE, array($this, 'flush_rewrite_rules'));
    }

    public function set_db($db) {
        $this->db = $db;
    }

    /**
     * Add rewrite rules for shared conversations
     */
    public function add_rewrite_rules() {
        // Add rewrite rule for shared conversations
        add_rewrite_rule(
            '^magicassistant/shared/([a-zA-Z0-9]+)/?$',
            'index.php?magicassistant_shared=$matches[1]',
            'top'
        );
    }

    /**
     * Add custom query variables
     */
    public function add_query_vars($vars) {
        $vars[] = 'magicassistant_shared';
        return $vars;
    }

    /**
     * Handle shared conversation display
     */
    public function handle_shared_conversation() {
        $share_id = get_query_var('magicassistant_shared');

        if (!empty($share_id)) {
            $this->display_shared_conversation($share_id);
            exit;
        }
    }

    /**
     * Display shared conversation
     */
    private function display_shared_conversation($share_id) {
        if (!$this->db) {
            wp_die(esc_html__('Service not available', 'magicassistant'), 503);
        }

        $conversation = $this->db->get_shared_conversation($share_id);

        if (!$conversation) {
            wp_die(esc_html__('Shared conversation not found or has expired', 'magicassistant'), 404);
        }

        // Register and enqueue the stylesheet for the standalone shared page.
        wp_register_style(
            'magicassistant-public-share',
            MAGIC_ASSISTANT_PLUGIN_URL . 'assets/css/public-share.css',
            array(),
            MAGIC_ASSISTANT_VERSION
        );
        wp_enqueue_style('magicassistant-public-share');

        // Set headers
        header('Content-Type: text/html; charset=utf-8');

        // Output the HTML
        echo $this->generate_shared_page_html($conversation); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- All variables escaped in generate_shared_page_html
    }

    /**
     * Generate HTML for shared conversation page.
     *
     * Uses output buffering instead of HEREDOC. Every interpolated value is
     * escaped at assignment time below, and the stylesheet is enqueued and
     * printed via wp_print_styles() rather than an inline <style> block.
     */
    private function generate_shared_page_html($conversation) {
        $site_name = get_bloginfo('name');
        $site_url = home_url();
        $title = $conversation['title'];
        $view_count = intval($conversation['view_count']);
        $created_date = wp_date('F j, Y', strtotime($conversation['created_at']));
        $html_content = wp_kses_post($conversation['html_content']);

        // Prepare meta tags for social sharing
        $description = wp_trim_words(wp_strip_all_tags($conversation['formatted_content']), 30);
        $og_image = MAGIC_ASSISTANT_PLUGIN_URL . 'assets/magicassistant-social.png';
        $canonical_url = home_url("/magicassistant/shared/{$conversation['share_id']}");

        ob_start();
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo esc_html($title); ?> - <?php echo esc_html($site_name); ?></title>
    <meta name="description" content="<?php echo esc_attr($description); ?>">
    <link rel="canonical" href="<?php echo esc_url($canonical_url); ?>">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="<?php echo esc_url($canonical_url); ?>">
    <meta property="og:title" content="<?php echo esc_attr($title); ?>">
    <meta property="og:description" content="<?php echo esc_attr($description); ?>">
    <meta property="og:image" content="<?php echo esc_url($og_image); ?>">
    <meta property="og:site_name" content="<?php echo esc_attr($site_name); ?>">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="<?php echo esc_url($canonical_url); ?>">
    <meta property="twitter:title" content="<?php echo esc_attr($title); ?>">
    <meta property="twitter:description" content="<?php echo esc_attr($description); ?>">
    <meta property="twitter:image" content="<?php echo esc_url($og_image); ?>">

    <?php wp_print_styles('magicassistant-public-share'); ?>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><?php echo esc_html($title); ?></h1>
            <div class="meta">
                <span>📅 <?php echo esc_html__('Shared on', 'magicassistant'); ?> <?php echo esc_html($created_date); ?></span>
                <span>👁️ <?php echo esc_html($view_count); ?> <?php echo esc_html__('views', 'magicassistant'); ?></span>
            </div>
            <p><?php echo esc_html__('An AI conversation shared from', 'magicassistant'); ?> <a href="<?php echo esc_url($site_url); ?>" class="site-link"><?php echo esc_html($site_name); ?></a></p>
        </div>

        <div class="content">
            <?php echo $html_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- sanitized with wp_kses_post above ?>
        </div>
    </div>
</body>
</html>
        <?php
        return ob_get_clean();
    }

    /**
     * Flush rewrite rules
     */
    public function flush_rewrite_rules() {
        $this->add_rewrite_rules();
        flush_rewrite_rules();
    }
}
