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
        
        // Set headers
        header('Content-Type: text/html; charset=utf-8');
        
        // Output the HTML
        echo $this->generate_shared_page_html($conversation); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- All variables escaped in generate_shared_page_html
    }
    
    /**
     * Generate HTML for shared conversation page
     */
    private function generate_shared_page_html($conversation) {
        $site_name = esc_html(get_bloginfo('name'));
        $site_url = esc_url(home_url());
        $title = esc_html($conversation['title']);
        $view_count = intval($conversation['view_count']);
        $created_date = esc_html(wp_date('F j, Y', strtotime($conversation['created_at'])));
        $html_content = wp_kses_post($conversation['html_content']);
        
        // Prepare meta tags for social sharing
        $description = esc_attr(wp_trim_words(wp_strip_all_tags($conversation['formatted_content']), 30));
        $og_image = esc_url(MAGIC_ASSISTANT_PLUGIN_URL . 'assets/magicassistant-social.png'); // You might want to create this
        $canonical_url = esc_url(home_url("/magicassistant/shared/{$conversation['share_id']}"));

        // Powered-by credit (filterable so site owners can remove it)
        $powered_by_html = '';
        if ( apply_filters( 'magicassistant_show_credits', true ) ) {
            $powered_by_html = '<div class="footer"><div class="powered-by">Powered by <strong><a href="https://magicplugins.io" target="_blank" style="color: #6366f1; text-decoration: none;">MagicAssistant</a></strong> - AI-Powered WordPress Assistant</div></div>';
        }

        // phpcs:ignore PluginCheck.CodeAnalysis.Heredoc.NotAllowed -- large HTML template; every interpolated value is escaped at assignment above
        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$title} - {$site_name}</title>
    <meta name="description" content="{$description}">
    <link rel="canonical" href="{$canonical_url}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{$canonical_url}">
    <meta property="og:title" content="{$title}">
    <meta property="og:description" content="{$description}">
    <meta property="og:image" content="{$og_image}">
    <meta property="og:site_name" content="{$site_name}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="{$canonical_url}">
    <meta property="twitter:title" content="{$title}">
    <meta property="twitter:description" content="{$description}">
    <meta property="twitter:image" content="{$og_image}">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8fafc;
            min-height: 100vh;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            background: #fff;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            border-left: 4px solid #6366f1;
        }
        
        .header h1 {
            color: #1f2937;
            margin-bottom: 1rem;
            font-size: 2rem;
            font-weight: 700;
        }
        
        .meta {
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 1rem;
        }
        
        .meta span {
            margin-right: 1rem;
        }
        
        .site-link {
            color: #6366f1;
            text-decoration: none;
            font-weight: 500;
        }
        
        .site-link:hover {
            text-decoration: underline;
        }
        
        .content {
            background: #fff;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            margin-bottom: 2rem;
        }
        
        .content h1 {
            color: #6366f1;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.75rem;
            margin-bottom: 1rem;
            font-size: 1.75rem;
        }
        
        .content h2 {
            color: #1f2937;
            margin: 1.5rem 0 0.75rem 0;
            font-size: 1.5rem;
        }
        
        .content h3 {
            color: #374151;
            margin: 1rem 0 0.5rem 0;
            font-size: 1.25rem;
        }
        
        .content p {
            margin-bottom: 0.75rem;
        }
        
        .content strong {
            font-weight: 600;
            color: #1f2937;
        }
        
        .content em {
            font-style: italic;
            color: #4b5563;
        }
        
        .content hr {
            border: none;
            height: 1px;
            background: #e5e7eb;
            margin: 0;
        }
        
        .content pre {
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
            margin: 0.75rem 0;
        }
        
        .content code {
            background: #f3f4f6;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
        }
        
        .content blockquote {
            border-left: 4px solid #e5e7eb;
            margin: 0.75rem 0;
            padding-left: 1rem;
            color: #6b7280;
            font-style: italic;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #6b7280;
            font-size: 0.875rem;
        }
        
        .powered-by {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        
        .powered-by img {
            width: 20px;
            height: 20px;
        }
        
        @media (max-width: 640px) {
            .container {
                padding: 1rem;
            }
            
            .header, .content {
                padding: 1.5rem;
                border-radius: 8px;
            }
            
            .header h1 {
                font-size: 1.5rem;
            }
        }
        
        @media (prefers-color-scheme: dark) {
            body {
                background: #0f172a;
                color: #f1f5f9;
            }
            
            .header, .content {
                background: #1e293b;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }
            
            .header h1, .content h2 {
                color: #f1f5f9;
            }
            
            .content h1 {
                color: #60a5fa;
                border-bottom-color: #374151;
            }
            
            .content h3 {
                color: #d1d5db;
            }
            
            .content strong {
                color: #f1f5f9;
            }
            
            .content em {
                color: #9ca3af;
            }
            
            .content hr {
                background: #374151;
            }
            
            .content pre, .content code {
                background: #374151;
                color: #f1f5f9;
            }
            
            .content blockquote {
                border-left-color: #4b5563;
                color: #9ca3af;
            }
            
            .meta {
                color: #9ca3af;
            }
            
            .footer {
                color: #9ca3af;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{$title}</h1>
            <div class="meta">
                <span>📅 Shared on {$created_date}</span>
                <span>👁️ {$view_count} views</span>
            </div>
            <p>An AI conversation shared from <a href="{$site_url}" class="site-link">{$site_name}</a></p>
        </div>
        
        <div class="content">
            {$html_content}
        </div>
        
        {$powered_by_html}
    </div>
</body>
</html>
HTML;
    }
    
    /**
     * Flush rewrite rules
     */
    public function flush_rewrite_rules() {
        $this->add_rewrite_rules();
        flush_rewrite_rules();
    }
}
