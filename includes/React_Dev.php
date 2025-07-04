<?php

namespace MagicAssistant;

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

/**
 * React Development Environment Handler for MagicAssistant
 * 
 * This class handles loading React components in both development and production modes.
 * It manages the connection between WordPress backend and React frontend, including
 * AJAX nonces, localized data, and asset loading.
 * 
 * @since 1.0.0
 */
class React_Dev {
    
    private $vite_dev_server = 'http://localhost:3000';
    public $is_dev_mode = false;
    
    /**
     * Allows developers to explicitly turn dev-mode on or off by defining the
     * `MAT_DEV_MODE` constant in wp-config.php. If the constant is defined
     * the plugin will never perform the localhost availability check – this
     * avoids unnecessary requests on production while still giving full
     * control in local environments.
     */
    private function is_dev_mode_forced() {
        return defined( 'MAT_DEV_MODE' );
    }
    
    public function __construct() {
        if ( $this->is_dev_mode_forced() ) {
            $this->is_dev_mode = (bool) MAT_DEV_MODE;
        } else {
            $this->is_dev_mode = false;
        }
        
        // If in dev mode, inject React Refresh preamble into head for HMR support
        if ( $this->is_dev_mode ) {
            add_action( 'admin_head', array( $this, 'vite_refresh_preamble' ) );
            add_action( 'wp_head', array( $this, 'vite_refresh_preamble' ) );
        }
        
        // Hook into WordPress enqueue system
        add_action( 'admin_enqueue_scripts', array( $this, 'maybe_enqueue_react_scripts' ), 10 );
        add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_react_scripts' ), 10 );
        
        // Enqueue Bricks integration script
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_bricks_scripts' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_bricks_scripts' ) );
        
        // Add React root elements to both frontend and admin
        add_action( 'wp_footer', array( $this, 'add_react_root_elements' ) );
        add_action( 'admin_footer', array( $this, 'add_react_root_elements' ) );
        
        add_action( 'admin_head', array( $this, 'add_admin_styles' ) );
    }
    
    /**
     * Check if Vite dev server is running by making a test request
     */
    public function is_vite_dev_server_running() {
        // If the developer forced dev-mode explicitly, never probe the server.
        if ( $this->is_dev_mode_forced() ) {
            return (bool) MAT_DEV_MODE;
        }

        // Only check in development/staging environments
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            /*
             * Use WordPress HTTP API for the availability check instead of
             * file_get_contents(). The HTTP API will return a WP_Error on
             * failure instead of triggering the PHP warning:
             *   "file_get_contents(...): Failed to open stream: Connection refused".
             * This keeps the admin UI clean while still accurately detecting
             * whether the Vite dev-server is running.
             */

            $response = wp_remote_get( $this->vite_dev_server, [
                'timeout' => 1,
                'redirection' => 0,
                'blocking' => true,
                'sslverify' => false, // Local dev server is usually http
                'headers' => [],
            ] );

            // If we didn't get a WP_Error back, the dev-server accepted the
            // connection – even when it responds with 404 for the root path.
            // That is enough to know that the server is running.

            return ! is_wp_error( $response );
        }
        
        return false;
    }
    
    /**
     * Conditionally enqueue React scripts based on context
     */
    public function maybe_enqueue_react_scripts( $hook ) {
        // Determine which React app to load based on context
        if ( is_admin() ) {
            // Check if this is a plugin admin page
            $screen = get_current_screen();
            if ( $screen ) {
                $plugin_pages = array(
                    'toplevel_page_magic_plugins',            // MagicPlugins landing page
                    'magicplugins_page_magicassistant',       // Main MagicAssistant page
                );
                
                if ( in_array( $screen->id, $plugin_pages ) ) {
                    // Load admin React app
                    $this->enqueue_admin_scripts( $hook );
                } else {
                    // Check floating chat settings before loading public React app on admin pages
                    if ( $this->should_show_floating_chat() ) {
                        $this->enqueue_public_scripts( $hook );
                    }
                }
            } else {
                // Check floating chat settings before loading public React app
                if ( $this->should_show_floating_chat() ) {
                    $this->enqueue_public_scripts( $hook );
                }
            }
        } else {
            // Check floating chat settings before loading public React app on frontend
            if ( $this->should_show_floating_chat() ) {
                $this->enqueue_public_scripts( $hook );
            }
        }
    }

    /**
     * Enqueue admin React scripts
     */
    private function enqueue_admin_scripts( $hook ) {
        if ( $this->is_dev_mode ) {
            $this->enqueue_admin_dev_scripts( $hook );
        } else {
            $this->enqueue_admin_prod_scripts( $hook );
        }
        $this->localize_admin_data();
    }

    /**
     * Enqueue public React scripts  
     */
    private function enqueue_public_scripts( $hook ) {
        if ( $this->is_dev_mode ) {
            $this->enqueue_public_dev_scripts( $hook );
        } else {
            $this->enqueue_public_prod_scripts( $hook );
        }
        $this->localize_public_data();
    }
    
    /**
     * Enqueue admin development scripts from Vite dev server
     */
    private function enqueue_admin_dev_scripts( $hook ) {
        // Vite client for HMR
        wp_enqueue_script(
            'vite-client',
            $this->vite_dev_server . '/@vite/client',
            array(),
            null,
            false
        );
        
        // Add type="module" to Vite client
        add_filter( 'script_loader_tag', function( $tag, $handle ) {
            if ( $handle === 'vite-client' ) {
                return str_replace( ' src=', ' type="module" src=', $tag );
            }
            return $tag;
        }, 10, 2 );
        
        // Admin React app from Vite dev server
        wp_enqueue_script(
            'mat-react-admin-dev',
            $this->vite_dev_server . '/src/admin.jsx',
            array( 'vite-client' ),
            null,
            true
        );
        
        add_filter( 'script_loader_tag', function( $tag, $handle ) {
            if ( $handle === 'mat-react-admin-dev' ) {
                return str_replace( ' src=', ' type="module" src=', $tag );
            }
            return $tag;
        }, 10, 2 );
    }
    
    /**
     * Enqueue public development scripts from Vite dev server
     */
    private function enqueue_public_dev_scripts( $hook ) {
        // Check if we're loading both admin and public on the same page
        $is_plugin_page = is_admin() && $this->is_plugin_admin_page();
        $public_handle_suffix = $is_plugin_page ? '-floating' : '';
        
        // Vite client for HMR - only enqueue if not already enqueued
        if ( ! wp_script_is( 'vite-client', 'enqueued' ) ) {
            wp_enqueue_script(
                'vite-client',
                $this->vite_dev_server . '/@vite/client',
                array(),
                null,
                false
            );
            
            // Add type="module" to Vite client
            add_filter( 'script_loader_tag', function( $tag, $handle ) {
                if ( $handle === 'vite-client' ) {
                    return str_replace( ' src=', ' type="module" src=', $tag );
                }
                return $tag;
            }, 10, 2 );
        }
        
        // Public React app from Vite dev server
        wp_enqueue_script(
            'mat-react-public-dev' . $public_handle_suffix,
            $this->vite_dev_server . '/src/main.jsx',
            array( 'vite-client' ),
            null,
            true
        );
        
        add_filter( 'script_loader_tag', function( $tag, $handle ) use ( $public_handle_suffix ) {
            if ( $handle === 'mat-react-public-dev' . $public_handle_suffix ) {
                return str_replace( ' src=', ' type="module" src=', $tag );
            }
            return $tag;
        }, 10, 2 );
    }
    
    /**
     * Enqueue admin production built scripts
     */
    private function enqueue_admin_prod_scripts( $hook ) {
        $dist_path = MAGIC_ASSISTANT_PLUGIN_PATH . 'dist/';
        $dist_url = MAGIC_ASSISTANT_PLUGIN_URL . 'dist/';
        
        // Load vendor chunks first
        $vendor_handles = $this->enqueue_vendor_chunks( $dist_path, $dist_url );
        
        // Load the main CSS file (Vite generates styles-[hash].css)
        $this->enqueue_main_css( $dist_path, $dist_url );
        
        // Admin React app
        if ( file_exists( $dist_path . 'admin.js' ) ) {
            wp_enqueue_script(
                'mat-react-admin',
                $dist_url . 'admin.js',
                $vendor_handles,
                MAGIC_ASSISTANT_VERSION,
                true
            );
            
            // Add type="module" to admin script
            add_filter( 'script_loader_tag', function( $tag, $handle ) {
                if ( $handle === 'mat-react-admin' ) {
                    return str_replace( ' src=', ' type="module" src=', $tag );
                }
                return $tag;
            }, 10, 2 );
        }
    }
    
    /**
     * Enqueue public production built scripts
     */
    private function enqueue_public_prod_scripts( $hook ) {
        $dist_path = MAGIC_ASSISTANT_PLUGIN_PATH . 'dist/';
        $dist_url = MAGIC_ASSISTANT_PLUGIN_URL . 'dist/';
        
        // Check if we're loading both admin and public on the same page
        $is_plugin_page = $this->is_plugin_admin_page();
        $public_handle_suffix = $is_plugin_page ? '-floating' : '';
        
        // Load vendor chunks first
        $vendor_handles = $this->enqueue_vendor_chunks( $dist_path, $dist_url );
        
        // Load the main CSS file (Vite generates styles-[hash].css)
        $this->enqueue_main_css( $dist_path, $dist_url );
        
        // Public React app
        if ( file_exists( $dist_path . 'main.js' ) ) {
            wp_enqueue_script(
                'mat-react-public' . $public_handle_suffix,
                $dist_url . 'main.js',
                $vendor_handles,
                MAGIC_ASSISTANT_VERSION,
                true
            );
            
            // Add type="module" to public script
            add_filter( 'script_loader_tag', function( $tag, $handle ) use ( $public_handle_suffix ) {
                if ( $handle === 'mat-react-public' . $public_handle_suffix ) {
                    return str_replace( ' src=', ' type="module" src=', $tag );
                }
                return $tag;
            }, 10, 2 );
        }
    }
    
    /**
     * Enqueue the main CSS file generated by Vite
     */
    private function enqueue_main_css( $dist_path, $dist_url ) {
        // Only enqueue CSS once if not already enqueued
        if ( wp_style_is( 'mat-react-styles', 'enqueued' ) ) {
            return;
        }
        
        // Vite generates CSS files as styles-[hash].css in the assets folder
        $css_files = glob( $dist_path . 'assets/styles-*.css' );
        
        if ( ! empty( $css_files ) ) {
            $css_file = str_replace( $dist_path, '', $css_files[0] );
            wp_enqueue_style(
                'mat-react-styles',
                $dist_url . $css_file,
                array(),
                MAGIC_ASSISTANT_VERSION
            );
        }
    }
    
    /**
     * Enqueue vendor chunks for optimized loading
     * @return array Array of vendor handle names
     */
    private function enqueue_vendor_chunks( $dist_path, $dist_url ) {
        $vendor_handles = array();
        
        // Load vendor chunk (React, ReactDOM) - only enqueue if not already enqueued
        $vendor_files = glob( $dist_path . 'vendor-*.js' );
        if ( ! empty( $vendor_files ) && ! wp_script_is( 'mat-vendor-chunk', 'enqueued' ) ) {
            $vendor_file = str_replace( $dist_path, '', $vendor_files[0] );
            wp_enqueue_script(
                'mat-vendor-chunk',
                $dist_url . $vendor_file,
                array(),
                MAGIC_ASSISTANT_VERSION,
                true
            );
            
            add_filter( 'script_loader_tag', function( $tag, $handle ) {
                if ( $handle === 'mat-vendor-chunk' ) {
                    return str_replace( ' src=', ' type="module" src=', $tag );
                }
                return $tag;
            }, 10, 2 );
        }
        
        if ( wp_script_is( 'mat-vendor-chunk', 'enqueued' ) || wp_script_is( 'mat-vendor-chunk', 'done' ) ) {
            $vendor_handles[] = 'mat-vendor-chunk';
        }
        
        // Load Flowbite chunk - only enqueue if not already enqueued
        $flowbite_files = glob( $dist_path . 'flowbite-*.js' );
        if ( ! empty( $flowbite_files ) && ! wp_script_is( 'mat-flowbite-chunk', 'enqueued' ) ) {
            $flowbite_file = str_replace( $dist_path, '', $flowbite_files[0] );
            wp_enqueue_script(
                'mat-flowbite-chunk',
                $dist_url . $flowbite_file,
                array( 'mat-vendor-chunk' ),
                MAGIC_ASSISTANT_VERSION,
                true
            );
            
            add_filter( 'script_loader_tag', function( $tag, $handle ) {
                if ( $handle === 'mat-flowbite-chunk' ) {
                    return str_replace( ' src=', ' type="module" src=', $tag );
                }
                return $tag;
            }, 10, 2 );
        }
        
        if ( wp_script_is( 'mat-flowbite-chunk', 'enqueued' ) || wp_script_is( 'mat-flowbite-chunk', 'done' ) ) {
            $vendor_handles[] = 'mat-flowbite-chunk';
        }
        
        // Load utils chunk - only enqueue if not already enqueued
        $utils_files = glob( $dist_path . 'utils-*.js' );
        if ( ! empty( $utils_files ) && ! wp_script_is( 'mat-utils-chunk', 'enqueued' ) ) {
            $utils_file = str_replace( $dist_path, '', $utils_files[0] );
            wp_enqueue_script(
                'mat-utils-chunk',
                $dist_url . $utils_file,
                array( 'mat-vendor-chunk' ),
                MAGIC_ASSISTANT_VERSION,
                true
            );
            
            add_filter( 'script_loader_tag', function( $tag, $handle ) {
                if ( $handle === 'mat-utils-chunk' ) {
                    return str_replace( ' src=', ' type="module" src=', $tag );
                }
                return $tag;
            }, 10, 2 );
        }
        
        if ( wp_script_is( 'mat-utils-chunk', 'enqueued' ) || wp_script_is( 'mat-utils-chunk', 'done' ) ) {
            $vendor_handles[] = 'mat-utils-chunk';
        }
        
        return $vendor_handles;
    }
    
    /**
     * Enqueue Bricks integration scripts if Bricks editor is active
     */
    public function enqueue_bricks_scripts() {
        if ( isset( $_GET['bricks'] ) && $_GET['bricks'] === 'run' ) {
            $this->enqueue_bricks_integration_scripts();
        }
    }

    /**
     * Enqueue the bricks.js for Bricks Builder integration
     */
    private function enqueue_bricks_integration_scripts() {
        $handle = 'mat-bricks-integration';
        $src = MAGIC_ASSISTANT_PLUGIN_URL . 'assets/js/bricks.js';
        $deps = array('jquery'); 
        $version = MAGIC_ASSISTANT_VERSION;
        $in_footer = true;
    
        wp_enqueue_script($handle, $src, $deps, $version, $in_footer);
    }
    
    /**
     * Localize data for admin React apps
     */
    private function localize_admin_data() {
        // Only localize if the script hasn't been localized yet by the admin class
        $handle = $this->is_dev_mode ? 'mat-react-admin-dev' : 'mat-react-admin';
        
        // Check if already localized by checking if the global variable exists
        if (wp_script_is($handle, 'enqueued') && !wp_script_is($handle, 'done') && empty(wp_scripts()->get_data($handle, 'data'))) {
          wp_localize_script( $handle, 'matAdminData', array(
            'ajaxurl' => admin_url( 'admin-ajax.php' ),
            'restUrl' => rest_url( 'magicassistant/v1/' ),
            'nonces' => array(
              'wp_rest' => wp_create_nonce( 'wp_rest' ),
              'mat_admin' => wp_create_nonce( 'mat_admin_nonce' ),
              'mat_ajax' => wp_create_nonce( 'mat_ajax_nonce' ),
            ),
            'currentUser' => wp_get_current_user()->ID,
            'savedTheme' => get_user_meta( get_current_user_id(), 'mat_theme', true ),
            'isAdmin' => is_admin(),
            'isDev' => $this->is_dev_mode,
            'pluginUrl' => MAGIC_ASSISTANT_PLUGIN_URL,
            'admin_url' => admin_url(),
            'dashboard_url' => admin_url('index.php'),
            'i18n' => array(
              'loading' => __( 'Loading...', 'magic-assistant' ),
              'error' => __( 'An error occurred', 'magic-assistant' ),
              'save' => __( 'Save', 'magic-assistant' ),
              'cancel' => __( 'Cancel', 'magic-assistant' ),
              'delete' => __( 'Delete', 'magic-assistant' ),
              'edit' => __( 'Edit', 'magic-assistant' ),
            )
          ));
        }
    }
    
    /**
     * Localize data for public React apps
     */
    private function localize_public_data( $public_handle_suffix = '' ) {
        $handle = $this->is_dev_mode ? 'mat-react-public-dev' . $public_handle_suffix : 'mat-react-public' . $public_handle_suffix;
        
        // Get current page/post information
        $current_post_info = $this->get_current_post_info();
        
        // Fetch plugin settings for default button customization
        $settings = array();
        if ( function_exists( 'MATDB' ) && MATDB() ) {
            $settings = MATDB()->get_all_settings();
        }
        
        wp_localize_script( $handle, 'matPublicData', array(
            'ajaxurl' => admin_url( 'admin-ajax.php' ),
            'restUrl' => rest_url( 'magicassistant/v1/' ),
            'nonces' => array(
                'wp_rest' => wp_create_nonce( 'wp_rest' ),
                'mat_ajax' => wp_create_nonce( 'mat_ajax_nonce' ),
                'mat_ajax_nopriv' => wp_create_nonce( 'mat_ajax_nopriv_nonce' ),
            ),
            'currentUser' => wp_get_current_user()->ID,
            'isLoggedIn' => is_user_logged_in(),
            'isAdmin' => current_user_can( 'manage_options' ),
            'isDev' => $this->is_dev_mode,
            'pluginUrl' => MAGIC_ASSISTANT_PLUGIN_URL,
            'currentPost' => $current_post_info,
            // Floating chat default customization coming from server-side settings
            'floatingChatButtonColor' => isset( $settings['floating_chat_button_color'] ) ? $settings['floating_chat_button_color'] : 'blue',
            'floatingChatButtonIcon'  => isset( $settings['floating_chat_button_icon'] )  ? $settings['floating_chat_button_icon']  : 'chat',
            'i18n' => array(
                'loading' => __( 'Loading...', 'magic-assistant' ),
                'error' => __( 'An error occurred', 'magic-assistant' ),
                'save' => __( 'Save', 'magic-assistant' ),
                'cancel' => __( 'Cancel', 'magic-assistant' ),
                'delete' => __( 'Delete', 'magic-assistant' ),
                'edit' => __( 'Edit', 'magic-assistant' ),
            )
        ));
    }
    
    /**
     * Get current page/post information for the AI context
     */
    private function get_current_post_info() {
        global $wp_query;
        
        $info = array(
            'id' => null,
            'type' => null,
            'title' => '',
            'url' => '',
            'is_front_page' => false,
            'is_home' => false,
            'is_archive' => false,
            'is_search' => false,
            'is_404' => false,
            'context' => 'unknown'
        );
        
        // Get current URL
        $info['url'] = home_url(add_query_arg(null, null));
        
        if (is_front_page()) {
            $info['is_front_page'] = true;
            $info['context'] = 'front_page';
            $info['title'] = get_bloginfo('name');
            
            // Check if front page is a static page
            $page_on_front = get_option('page_on_front');
            if ($page_on_front) {
                $info['id'] = intval($page_on_front);
                $info['type'] = 'page';
            }
        } elseif (is_home()) {
            $info['is_home'] = true;
            $info['context'] = 'blog_home';
            $info['title'] = 'Blog';
            
            // Check if blog page is set to a static page
            $page_for_posts = get_option('page_for_posts');
            if ($page_for_posts) {
                $info['id'] = intval($page_for_posts);
                $info['type'] = 'page';
                $info['title'] = get_the_title($page_for_posts);
            }
        } elseif (is_singular()) {
            global $post;
            if ($post) {
                $info['id'] = $post->ID;
                $info['type'] = $post->post_type;
                $info['title'] = get_the_title($post);
                $info['context'] = 'singular_' . $post->post_type;
            }
        } elseif (is_category()) {
            $category = get_queried_object();
            if ($category) {
                $info['id'] = $category->term_id;
                $info['type'] = 'category';
                $info['title'] = $category->name;
                $info['context'] = 'category_archive';
            }
        } elseif (is_tag()) {
            $tag = get_queried_object();
            if ($tag) {
                $info['id'] = $tag->term_id;
                $info['type'] = 'tag';
                $info['title'] = $tag->name;
                $info['context'] = 'tag_archive';
            }
        } elseif (is_tax()) {
            $term = get_queried_object();
            if ($term) {
                $info['id'] = $term->term_id;
                $info['type'] = 'taxonomy';
                $info['title'] = $term->name;
                $info['context'] = 'taxonomy_archive';
            }
        } elseif (is_author()) {
            $author = get_queried_object();
            if ($author) {
                $info['id'] = $author->ID;
                $info['type'] = 'author';
                $info['title'] = $author->display_name;
                $info['context'] = 'author_archive';
            }
        } elseif (is_date()) {
            $info['context'] = 'date_archive';
            $info['title'] = 'Date Archive';
        } elseif (is_search()) {
            $info['is_search'] = true;
            $info['context'] = 'search';
            $info['title'] = 'Search Results';
        } elseif (is_404()) {
            $info['is_404'] = true;
            $info['context'] = '404';
            $info['title'] = '404 Not Found';
        } elseif (is_archive()) {
            $info['is_archive'] = true;
            $info['context'] = 'archive';
            $info['title'] = 'Archive';
        }
        
        // In admin area, try to detect the current post being edited
        if (is_admin()) {
            global $pagenow, $post;
            
            if (in_array($pagenow, array('post.php', 'post-new.php'))) {
                if (isset($_GET['post']) && is_numeric($_GET['post'])) {
                    $post_id = intval($_GET['post']);
                    $post_obj = get_post($post_id);
                    if ($post_obj) {
                        $info['id'] = $post_id;
                        $info['type'] = $post_obj->post_type;
                        $info['title'] = $post_obj->post_title;
                        $info['context'] = 'admin_edit_' . $post_obj->post_type;
                    }
                } elseif ($post && is_object($post)) {
                    $info['id'] = $post->ID;
                    $info['type'] = $post->post_type;
                    $info['title'] = $post->post_title;
                    $info['context'] = 'admin_edit_' . $post->post_type;
                }
            } elseif ($pagenow === 'term.php' && isset($_GET['tag_ID'])) {
                $term_id = intval($_GET['tag_ID']);
                $term = get_term($term_id);
                if ($term && !is_wp_error($term)) {
                    $info['id'] = $term_id;
                    $info['type'] = 'term';
                    $info['title'] = $term->name;
                    $info['context'] = 'admin_edit_term';
                }
            } elseif ($pagenow === 'user-edit.php' && isset($_GET['user_id'])) {
                $user_id = intval($_GET['user_id']);
                $user = get_user_by('id', $user_id);
                if ($user) {
                    $info['id'] = $user_id;
                    $info['type'] = 'user';
                    $info['title'] = $user->display_name;
                    $info['context'] = 'admin_edit_user';
                }
            } else {
                $info['context'] = 'admin_' . $pagenow;
                $info['title'] = 'WordPress Admin';
            }
        }
        
        return $info;
    }
    
    /**
     * Get development status
     */
    public function is_development_mode() {
        return $this->is_dev_mode;
    }
    
    /**
     * Output the Vite React Refresh preamble snippet for HMR
     */
    public function vite_refresh_preamble() {
        // HMR preamble required by @vitejs/plugin-react
        echo '<script type="module">';
        echo 'import RefreshRuntime from "' . esc_url( $this->vite_dev_server ) . '/@react-refresh";';
        echo 'RefreshRuntime.injectIntoGlobalHook(window);';
        echo 'window.$RefreshReg$ = () => {};';
        echo 'window.$RefreshSig$ = () => type => type;';
        echo '</script>';
    }
    
    /**
     * Add React root element to the DOM
     */
    public function add_react_root_elements() {
        if ( ! is_admin() ) {
            // Add public root element on frontend pages only if floating chat should be shown
            if ( $this->should_show_floating_chat() ) {
                echo '<div id="mat-public-root"></div>';
            }
        } else {
            // Check if this is a plugin admin page
            $screen = get_current_screen();
            if ( $screen ) {
                $plugin_pages = array(
                    'toplevel_page_magic_plugins',            // MagicPlugins landing page
                    'magicplugins_page_magicassistant',       // Main MagicAssistant page
                );
                
                if ( in_array( $screen->id, $plugin_pages ) ) {
                    // These are our main plugin admin pages - they need the admin root
                    // The admin root is already added by the admin_page() method in MAT_Admin class
                    // Don't add any additional roots here to avoid conflicts
                } else {
                    // Other admin pages - add public root for floating components only if should be shown
                    if ( $this->should_show_floating_chat() ) {
                        echo '<div id="mat-public-root"></div>';
                    }
                }
            } else {
                // Fallback - add public root only if should be shown
                if ( $this->should_show_floating_chat() ) {
                    echo '<div id="mat-public-root"></div>';
                }
            }
        }
    }
    
    /**
     * Add admin styles for React integration
     */
    public function add_admin_styles() {
        // Only add styles on plugin pages
        $screen = get_current_screen();
        if ( ! $screen ) {
            return;
        }
        
        $plugin_pages = array(
            'toplevel_page_magic_plugins',            // MagicPlugins landing page
            'magicplugins_page_magicassistant',       // Main MagicAssistant page
        );
        
        if ( ! in_array( $screen->id, $plugin_pages ) ) {
            return;
        }
        
        ?>
        <style>
        #mat-admin-root {
            width: 100%;
            min-height: 100%;
            margin: 0;
            padding: 0;
            background: transparent;
        }

        .wrap #mat-admin-root {
            margin: 0;
        }

        @media screen and (max-width: 782px) {
            #mat-admin-root {
                min-height: calc(100vh - 46px);
            }
        }

        #wpfooter {
            display: none !important;
        }

        #wpcontent {
            padding: 0 !important;
        }
        #wpbody-content {
            padding-bottom: 0 !important;
        }
        /* Theme-based WP admin background color overrides */
        html:not(.dark) body,
        html:not(.dark) #wpwrap {
            background-color: #f4f4f4 !important;
        }
        html.dark body,
        html.dark #wpwrap {
            background-color: #011326 !important;
        }
        </style>
        <?php
    }

    /**
     * Check if current admin page is a plugin admin page
     */
    private function is_plugin_admin_page() {
        if ( ! is_admin() ) {
            return false;
        }
        
        $screen = get_current_screen();
        if ( ! $screen ) {
            return false;
        }
        
        $plugin_pages = array(
            'toplevel_page_magic_plugins',            // MagicPlugins landing page
            'magicplugins_page_magicassistant',       // Main MagicAssistant page
        );
        
        return in_array( $screen->id, $plugin_pages );
    }

    /**
     * Check if floating chat should be shown based on settings and conditions
     */
    private function should_show_floating_chat() {
        // Get floating chat settings from database
        if (!function_exists('MATDB') || !MATDB()) {
            // If database not available, default to showing (fallback)
            return true;
        }

        $db = MATDB();
        $settings = $db->get_all_settings();

        // If floating chat is disabled, don't show it
        if (!isset($settings['floating_chat_enabled']) || !$settings['floating_chat_enabled']) {
            return false;
        }

        $condition = $settings['floating_chat_conditions'] ?? 'everywhere';
        $is_admin = is_admin();
        $is_logged_in = is_user_logged_in();

        switch ($condition) {
            case 'everywhere':
                return true;
                
            case 'frontend_only':
                if ($is_admin) {
                    return false;
                }
                return $this->check_frontend_page_restrictions($settings);
                
            case 'admin_only':
                if (!$is_admin) {
                    return false;
                }
                return $this->check_admin_page_restrictions($settings);
                
            case 'logged_in_only':
                if (!$is_logged_in) {
                    return false;
                }
                return $this->check_user_restrictions($settings);
                
            default:
                return true;
        }
    }
    
    /**
     * Check user role and ID restrictions for logged-in users
     */
    private function check_user_restrictions($settings) {
        $current_user = wp_get_current_user();
        
        // Get role restrictions
        $allowed_roles = isset($settings['floating_chat_user_roles']) ? json_decode($settings['floating_chat_user_roles'], true) : [];
        if (!is_array($allowed_roles)) {
            $allowed_roles = [];
        }
        
        // Get specific user restrictions
        $allowed_users = isset($settings['floating_chat_specific_users']) ? json_decode($settings['floating_chat_specific_users'], true) : [];
        if (!is_array($allowed_users)) {
            $allowed_users = [];
        }
        
        // If no restrictions are set, allow all logged-in users
        if (empty($allowed_roles) && empty($allowed_users)) {
            return true;
        }
        
        // Check if user ID is specifically allowed
        if (!empty($allowed_users) && in_array($current_user->ID, $allowed_users)) {
            return true;
        }
        
        // Check if user has an allowed role
        if (!empty($allowed_roles)) {
            $user_roles = $current_user->roles;
            if (array_intersect($user_roles, $allowed_roles)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check frontend page restrictions
     */
    private function check_frontend_page_restrictions($settings) {
        $frontend_pages = $settings['floating_chat_frontend_pages'] ?? 'all';
        
        if ($frontend_pages === 'all') {
            return true;
        }
        
        if ($frontend_pages === 'specific') {
            $url_patterns = $settings['floating_chat_frontend_urls'] ?? '';
            if (empty($url_patterns)) {
                return false; // No patterns specified, don't show
            }
            
            $current_url = $_SERVER['REQUEST_URI'] ?? '';
            $patterns = array_filter(array_map('trim', explode("\n", $url_patterns)));
            
            foreach ($patterns as $pattern) {
                if ($this->match_url_pattern($current_url, $pattern)) {
                    return true;
                }
            }
            
            return false;
        }
        
        return false;
    }
    
    /**
     * Check admin page restrictions
     */
    private function check_admin_page_restrictions($settings) {
        $admin_pages = $settings['floating_chat_admin_pages'] ?? 'all';
        
        if ($admin_pages === 'all') {
            return true;
        }
        
        if ($admin_pages === 'specific') {
            $allowed_pages = isset($settings['floating_chat_specific_admin_pages']) ? json_decode($settings['floating_chat_specific_admin_pages'], true) : [];
            if (!is_array($allowed_pages) || empty($allowed_pages)) {
                return false;
            }
            
            global $pagenow;
            $current_page = $this->get_admin_page_type($pagenow);
            
            return in_array($current_page, $allowed_pages);
        }
        
        return false;
    }
    
    /**
     * Match URL pattern with wildcards
     */
    private function match_url_pattern($url, $pattern) {
        // Convert pattern to regex
        $regex_pattern = str_replace(['*', '/'], ['.*', '\/'], $pattern);
        $regex_pattern = '/^' . $regex_pattern . '$/i';
        
        return preg_match($regex_pattern, $url);
    }
    
    /**
     * Get admin page type from pagenow
     */
    private function get_admin_page_type($pagenow) {
        $page_map = [
            'index.php' => 'dashboard',
            'edit.php' => 'posts',
            'post.php' => 'posts',
            'post-new.php' => 'posts',
            'edit-pages.php' => 'pages',
            'page.php' => 'pages',
            'page-new.php' => 'pages',
            'upload.php' => 'media',
            'media-new.php' => 'media',
            'edit-comments.php' => 'comments',
            'comment.php' => 'comments',
            'themes.php' => 'appearance',
            'customize.php' => 'appearance',
            'widgets.php' => 'appearance',
            'nav-menus.php' => 'appearance',
            'theme-editor.php' => 'appearance',
            'plugins.php' => 'plugins',
            'plugin-install.php' => 'plugins',
            'plugin-editor.php' => 'plugins',
            'users.php' => 'users',
            'user-new.php' => 'users',
            'profile.php' => 'users',
            'user-edit.php' => 'users',
            'tools.php' => 'tools',
            'import.php' => 'tools',
            'export.php' => 'tools',
            'options-general.php' => 'settings',
            'options-writing.php' => 'settings',
            'options-reading.php' => 'settings',
            'options-discussion.php' => 'settings',
            'options-media.php' => 'settings',
            'options-permalink.php' => 'settings'
        ];
        
        // Check for WooCommerce pages
        if (strpos($pagenow, 'wc-') === 0 || isset($_GET['page']) && strpos($_GET['page'], 'wc-') === 0) {
            return 'woocommerce';
        }
        
        return $page_map[$pagenow] ?? 'unknown';
    }
}
