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
        // Decide whether we're in development mode.
        // 1. Respect explicit override via constant first.
        if ( $this->is_dev_mode_forced() ) {
            $this->is_dev_mode = (bool) MAT_DEV_MODE;
        } else {
            // 2. Otherwise auto-detect by pinging the dev-server (only when useful).
            $this->is_dev_mode = $this->is_vite_dev_server_running();
        }
        
        // If in dev mode, inject React Refresh preamble into head for HMR support
        if ( $this->is_dev_mode ) {
            add_action( 'admin_head', array( $this, 'vite_refresh_preamble' ) );
            add_action( 'wp_head', array( $this, 'vite_refresh_preamble' ) );
        }
        
        // Hook into WordPress enqueue system
        add_action( 'admin_enqueue_scripts', array( $this, 'maybe_enqueue_react_scripts' ), 10 );
        add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_react_scripts' ), 10 );
        
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
                    // Load public React app for floating components on other admin pages
                    $this->enqueue_public_scripts( $hook );
                }
            } else {
                // Load public React app for floating components
                $this->enqueue_public_scripts( $hook );
            }
        } else {
            // Load public React app on frontend
            $this->enqueue_public_scripts( $hook );
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
      // Add public root element on frontend pages
      echo '<div id="mat-public-root"></div>';
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
          // Other admin pages - add public root for floating components
          echo '<div id="mat-public-root"></div>';
        }
      } else {
        // Fallback - add public root
        echo '<div id="mat-public-root"></div>';
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
}
