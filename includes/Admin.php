<?php
/**
 * Admin functionality for MagicAssistant
 *
 * @package MagicAssistant
 */

namespace MagicAssistant;

if (!defined('ABSPATH')) exit;

class Admin {
  
  private $created_toplevel_menu = false;
  
  public function __construct() {
    add_action('admin_menu', array($this, 'add_admin_menu'));
    // Add landing page submenu with lower priority to ensure it's last
    add_action('admin_menu', array($this, 'add_landing_submenu'), 999);
    // Apply custom submenu ordering after all plugins have added their items
    add_action('admin_menu', array($this, 'apply_submenu_ordering'), 9999);
    
    // Add admin scripts enqueuing
    add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    
    // Add AJAX handlers
    add_action('wp_ajax_mat_save_theme_mode', array($this, 'save_theme_mode'));
    add_action('wp_ajax_mat_mark_tour_completed', array($this, 'mark_tour_completed'));
    add_action('wp_ajax_mat_reset_tour', array($this, 'reset_tour'));
    add_action('wp_ajax_mat_mark_tour_triggered', array($this, 'mark_tour_triggered'));
    add_action('wp_ajax_mat_dismiss_tour_permanently', array($this, 'dismiss_tour_permanently'));
    add_action('wp_ajax_mat_mark_first_visit_complete', array($this, 'mark_first_visit_complete'));
    add_action('wp_ajax_mat_reset_all_tours', array($this, 'reset_all_tours'));
    add_action('wp_ajax_mat_reenable_tours', array($this, 'reenable_tours'));
  }
  
  public function add_admin_menu() {
    // Get shared settings for menu positioning
    $shared_settings = get_option('magic_plugins_settings', array());
    $position_type = isset($shared_settings['menu_position_type']) ? $shared_settings['menu_position_type'] : 'default';
    
    // Default position is 30
    $menu_position = 30;
    
    if ($position_type === 'custom') {
      $menu_position = isset($shared_settings['custom_position']) ? 
        intval($shared_settings['custom_position']) : $menu_position;
      $menu_position = max(1, min(99, $menu_position));
      
      // If position is taken, find next available
      global $menu;
      $original_position = $menu_position;
      while (isset($menu[$menu_position])) {
        $menu_position++;
        if ($menu_position > 99) {
          $menu_position = $original_position;
          break;
        }
      }
    } elseif ($position_type === 'relative') {
      $relative_to = isset($shared_settings['menu_position_relative_to']) ? $shared_settings['menu_position_relative_to'] : '';
      $position = isset($shared_settings['menu_position']) ? $shared_settings['menu_position'] : 'after';
      
      if (!empty($relative_to)) {
        global $menu;
        
        // Find the reference menu item position
        foreach ($menu as $priority => $item) {
          if (!empty($item[2]) && $item[2] === $relative_to) {
            $requested_position = $position === 'after' ? $priority + 1 : $priority - 1;
            $menu_position = max(2, min(99, $requested_position));
            
            // Find next available position
            $iteration_count = 0;
            $max_iterations = 98;
            
            while (isset($menu[$menu_position])) {
              $menu_position = $position === 'after' ? $menu_position + 1 : $menu_position - 1;
              $menu_position = max(2, min(99, $menu_position));
              
              $iteration_count++;
              if ($iteration_count >= $max_iterations) {
                $menu_position = 30; // fallback
                break;
              }
            }
            break;
          }
        }
      }
    }

    // Check if the global "MagicPlugins" top-level menu already exists
    global $menu;
    $magic_plugins_exists = false;
    if ( is_array( $menu ) ) {
      foreach ( $menu as $item ) {
        if ( ! empty( $item[2] ) && $item[2] === 'magic_plugins' ) {
          $magic_plugins_exists = true;
          break;
        }
      }
    }

    // If it does not exist, create it first
    if ( ! $magic_plugins_exists ) {
    add_menu_page(
        __( 'MagicPlugins', 'magicassistant' ),
        __( 'MagicPlugins', 'magicassistant' ),
        'manage_options',
        'magic_plugins',
        array( $this, 'magic_plugins_landing_page' ),
        'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="74.5428mm" height="51.5909mm" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 7454 5159" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"><![CDATA[.fil0]]></style></defs><g id="Layer_x0020_1"><metadata id="CorelCorpID_0Corel-Layer"/><g id="_2008538046704"><path class="fil0" d="M1951 891c21,0 40,14 47,35l29 91c1,3 4,4 6,4 3,0 5,-1 6,-4l30 -91c6,-21 25,-35 47,-35l96 0c3,0 5,-1 6,-4 1,-2 0,-5 -2,-7l-78 -56c-18,-13 -25,-35 -18,-56l30 -91c0,-3 0,-5 -3,-7 -2,-2 -5,-2 -7,0 -26,19 -55,39 -81,59 -16,11 -36,12 -52,0 -27,-19 -54,-39 -81,-59 -2,-1 -5,-1 -7,0 -2,2 -3,5 -2,7l30 91c6,21 -1,43 -18,56l-78 56c-2,2 -3,5 -2,7 0,3 3,4 5,4l97 0zm-1110 596c466,0 841,176 844,357 2,145 -240,208 -575,228 4,-39 8,-77 12,-115 141,-10 233,-34 232,-96 -2,-97 -229,-167 -512,-167 -283,0 -511,72 -511,175 0,65 92,85 232,91 4,38 8,76 13,114 -336,-13 -576,-63 -576,-215 0,-191 375,-372 841,-372zm-560 -801c291,-168 832,-168 1123,0 16,9 25,27 23,46l-81 805c-9,-3 -17,-6 -26,-9l14 -136c-327,-73 -657,-76 -983,0l14 138c-9,2 -17,5 -26,8l-81 -806c-2,-19 7,-37 23,-46zm697 -48c128,12 256,27 381,84 11,5 17,15 16,27l-23 266c-12,-109 -21,-199 -25,-241 -1,-9 -6,-16 -14,-20 -99,-54 -219,-83 -335,-116zm1137 -320c14,0 26,9 31,22l18 59c1,2 2,3 4,3 2,0 3,-1 4,-3l19 -59c4,-13 16,-22 30,-22l62 0c2,0 3,-1 4,-2 0,-2 0,-4 -2,-5l-50 -36c-11,-8 -16,-22 -11,-35l19 -59c0,-2 0,-3 -2,-4 -1,-1 -3,-2 -4,-1 -17,13 -36,25 -52,38 -10,8 -24,8 -34,1 -17,-13 -34,-26 -51,-38 -2,-2 -4,-2 -6,0 -1,1 -2,3 -1,5l21 66c5,15 0,31 -13,40l-57 41c-1,2 -2,4 -1,5 0,2 2,4 4,4l70 -1z"/><path class="fil0" d="M1749 5159c-3,-1 -7,-8 -9,-12 -35,-67 -70,-365 360,-1664 240,-724 508,-1407 511,-1414l-118 -64c-4,6 -417,581 -893,1149 -824,982 -1151,1128 -1272,1128l0 0c-7,0 -12,0 -18,-1 -22,-3 -55,-14 -85,-66 -144,-250 80,-1392 295,-2118 21,1 39,2 55,2 7,1 14,-2 19,-8 5,-5 7,-12 6,-19 -4,-38 -8,-76 -12,-114 -1,-11 -9,-19 -19,-22 25,-76 49,-144 72,-204 67,-10 137,-13 201,-13 102,0 217,8 318,35 -8,59 -17,118 -27,177l-12 1c-12,1 -22,10 -23,22 -5,38 -9,77 -13,115 -1,8 1,15 7,20 3,4 7,6 11,7 -47,258 -103,503 -147,669l122 54c4,-7 439,-670 964,-1325 674,-841 1208,-1304 1504,-1304 82,0 143,35 192,110 20,31 71,193 -114,1007 -101,445 -224,867 -225,871l114 66c5,-6 550,-571 1194,-1129 843,-729 1470,-1115 1812,-1115 109,0 256,33 288,321 67,619 -400,1507 -776,2220 -349,664 -625,1189 -476,1436 53,88 154,134 300,134 49,0 104,-5 165,-15 565,-92 1079,-365 1434,-598 -474,514 -1300,1275 -2039,1275 -197,0 -378,-55 -539,-164 -497,-336 124,-2056 406,-2690l-112 -73c-8,8 -764,843 -1565,1666 -470,483 -863,868 -1169,1143 -517,468 -655,504 -685,504 -1,0 -1,0 -2,0z"/></g></g></svg>' ),
        $menu_position
      );
      
      // Mark that we created the top-level menu
      $this->created_toplevel_menu = true;
    }

    // Finally, add MagicAssistant as a submenu of MagicPlugins
    add_submenu_page(
      'magic_plugins',
      __( 'MagicAssistant', 'magicassistant' ),
      __( 'MagicAssistant', 'magicassistant' ),
      'manage_options',
      'magicassistant',
      array( $this, 'admin_page' )
    );
  }
  
  public function enqueue_admin_scripts($hook) {
    // Only enqueue on our plugin pages
    $plugin_pages = array(
      'toplevel_page_magic_plugins',
      'magicplugins_page_magicassistant',
    );
    
    if (!in_array($hook, $plugin_pages)) {
      return;
    }
    
    // The React dev class will handle the actual script enqueuing
    // We just need to localize admin-specific data here
    $this->localize_admin_data($hook);
  }
  
  private function localize_admin_data($hook) {
    // Get the current user
    $current_user = wp_get_current_user();
    
    // Get current page/post information (reuse the method from React_Dev)
    $current_post_info = $this->get_current_post_info();
    
    // Prepare admin data
    $admin_data = array(
      'ajaxurl' => admin_url('admin-ajax.php'),
      'restUrl' => rest_url('magicassistant/v1/'),
      'nonces' => array(
        'wp_rest' => wp_create_nonce('wp_rest'),
        'mat_admin' => wp_create_nonce('mat_admin_nonce'),
        'mat_ajax' => wp_create_nonce('mat_ajax_nonce'),
        'save_theme_mode' => wp_create_nonce('mat_save_theme_mode'),
      ),
      'currentUser' => array(
        'id' => $current_user->ID,
        'name' => $current_user->display_name,
        'email' => $current_user->user_email,
        'avatar' => get_avatar_url($current_user->ID),
      ),
      'savedTheme' => get_user_meta($current_user->ID, 'mat_theme', true) ?: 'light',
      'isAdmin' => current_user_can('manage_options'),
      'isDev' => defined('WP_DEBUG') && WP_DEBUG,
      'pluginUrl' => MAGIC_ASSISTANT_PLUGIN_URL,
      'adminUrl' => admin_url(),
      'dashboardUrl' => admin_url('index.php'),
      'currentPage' => $this->get_current_page($hook),
      'currentPost' => $current_post_info,
      'initialTab' => $this->get_initial_tab(),
      'tourCompleted' => array(
        'dashboard' => (bool) get_user_meta(get_current_user_id(), 'mat_tour_completed_dashboard', true),
        'settings' => (bool) get_user_meta(get_current_user_id(), 'mat_tour_completed_settings', true),
        'firstVisit' => (bool) get_user_meta(get_current_user_id(), 'mat_tour_first_visit_complete', true)
      ),
      'tourDismissed' => array(
        'permanently' => (bool) get_user_meta(get_current_user_id(), 'mat_tour_dismissed_permanently', true)
      ),
      'toursGloballyDisabled' => (bool) get_option('mat_tours_globally_disabled', false),
      'i18n' => array(
        'loading' => __('Loading...', 'magicassistant'),
        'error' => __('An error occurred', 'magicassistant'),
        'save' => __('Save', 'magicassistant'),
        'cancel' => __('Cancel', 'magicassistant'),
        'delete' => __('Delete', 'magicassistant'),
        'edit' => __('Edit', 'magicassistant'),
        'success' => __('Success!', 'magicassistant'),
        'confirmDelete' => __('Are you sure you want to delete this item?', 'magicassistant'),
      )
    );
    
    // Localize the script - this will be picked up by the React dev class
    wp_localize_script('mat-react-admin-dev', 'matAdminData', $admin_data);
    wp_localize_script('mat-react-admin', 'matAdminData', $admin_data);
  }
  
  /**
   * Get current page/post information for the AI context
   * This is a copy of the method from React_Dev.php to avoid dependencies
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
      
      // phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only detection of the current admin screen; no form data is processed
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
      // phpcs:enable WordPress.Security.NonceVerification.Recommended
    }
    
    return $info;
  }
  
  private function get_current_page($hook) {
    if ($hook === 'toplevel_page_magic_plugins') {
      return 'magic_plugins_landing';
    } elseif ($hook === 'magicplugins_page_magicassistant') {
      return 'magicassistant';
    }
    return 'unknown';
  }
  
  private function get_initial_tab() {
    // Check URL parameters for initial tab
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only UI navigation state, not form processing
    $tab = isset($_GET['tab']) ? sanitize_text_field(wp_unslash($_GET['tab'])) : 'dashboard';
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only UI navigation state, not form processing
    $view = isset($_GET['view']) ? sanitize_text_field(wp_unslash($_GET['view'])) : '';
    
    if (!empty($view)) {
      return $view;
    }
    
    return $tab;
  }
  
  // Landing page used when this plugin creates the top-level MagicPlugins menu
  public function magic_plugins_landing_page() {
    // Handle form submission
    if (isset($_POST['submit']) && check_admin_referer('magic_plugins_settings', 'magic_plugins_nonce')) {
      $this->save_shared_settings($_POST);
      echo '<div class="notice notice-success"><p>' . esc_html__('Settings saved successfully!', 'magicassistant') . '</p></div>';
    }

    $settings = $this->get_shared_settings();
    ?>
    <div class="wrap">
      <h1><?php echo esc_html__( 'MagicPlugins Settings', 'magicassistant' ); ?></h1>
      <p><?php echo esc_html__( 'Configure shared settings for all Magic plugins.', 'magicassistant' ); ?></p>
      
      <form method="post" action="">
        <?php wp_nonce_field('magic_plugins_settings', 'magic_plugins_nonce'); ?>
        
        <table class="form-table">
          <tr>
            <th scope="row"><?php esc_html_e('Menu Position', 'magicassistant'); ?></th>
            <td>
              <?php $this->render_menu_position_field($settings); ?>
            </td>
          </tr>
          
          <tr>
            <th scope="row"><?php esc_html_e('Date & Time Format', 'magicassistant'); ?></th>
            <td>
              <?php $this->render_date_format_field($settings); ?>
            </td>
          </tr>
          
          <tr>
            <th scope="row"><?php esc_html_e('Submenu Items Order', 'magicassistant'); ?></th>
            <td>
              <?php $this->render_submenu_order_field($settings); ?>
            </td>
          </tr>
        </table>
        
        <?php submit_button(); ?>
      </form>
    </div>
    <?php
  }
  
  private function get_shared_settings() {
    $defaults = array(
      'menu_position_type' => 'default',
      'menu_position_relative_to' => '',
      'menu_position' => 'after',
      'custom_position' => 30,
      'date_format' => 'us',
      'submenu_order' => array()
    );
    
    $settings = get_option('magic_plugins_settings', array());
    return array_merge($defaults, $settings);
  }
  
  private function save_shared_settings($post_data) {
    $settings = array();
    
    // Menu position settings
    $settings['menu_position_type'] = sanitize_text_field($post_data['menu_position_type']);
    if ($settings['menu_position_type'] === 'relative') {
      $settings['menu_position_relative_to'] = sanitize_text_field($post_data['menu_position_relative_to']);
      $settings['menu_position'] = in_array($post_data['menu_position'], ['before', 'after']) ? $post_data['menu_position'] : 'after';
    } elseif ($settings['menu_position_type'] === 'custom') {
      $settings['custom_position'] = max(1, min(99, intval($post_data['custom_position'])));
    }
    
    // Date format
    $allowed_formats = array('us', 'eu', 'iso', 'compact', 'long');
    $settings['date_format'] = in_array($post_data['date_format'], $allowed_formats) ? $post_data['date_format'] : 'us';
    
    // Submenu order
    if (isset($post_data['submenu_order']) && is_array($post_data['submenu_order'])) {
      $settings['submenu_order'] = array_map('sanitize_text_field', $post_data['submenu_order']);
    }
    
    update_option('magic_plugins_settings', $settings);
  }
  
  private function render_menu_position_field($settings) {
    $position_type = $settings['menu_position_type'];
    $relative_to = $settings['menu_position_relative_to'];
    $position = $settings['menu_position'];
    $custom_position = $settings['custom_position'];
    
    // Get all admin menu items
    global $menu;
    $menu_items = array();
    if (is_array($menu)) {
      foreach ($menu as $item) {
        if (!empty($item[0]) && !empty($item[2])) {
          $title = wp_strip_all_tags($item[0]);
          $menu_items[$item[2]] = $title;
        }
      }
    }
    ?>
    <select name="menu_position_type" id="menu-position-type">
      <option value="default" <?php selected($position_type, 'default'); ?>><?php esc_html_e('Default Position', 'magicassistant'); ?></option>
      <option value="relative" <?php selected($position_type, 'relative'); ?>><?php esc_html_e('Relative to Another Menu Item', 'magicassistant'); ?></option>
      <option value="custom" <?php selected($position_type, 'custom'); ?>><?php esc_html_e('Custom Position (1-99)', 'magicassistant'); ?></option>
    </select>

    <div id="relative-position-wrapper" style="<?php echo esc_attr($position_type === 'relative' ? '' : 'display: none;'); ?>">
      <select name="menu_position">
        <option value="after" <?php selected($position, 'after'); ?>><?php esc_html_e('After', 'magicassistant'); ?></option>
        <option value="before" <?php selected($position, 'before'); ?>><?php esc_html_e('Before', 'magicassistant'); ?></option>
      </select>
      <select name="menu_position_relative_to">
        <option value=""><?php esc_html_e('Select Menu Item', 'magicassistant'); ?></option>
        <?php foreach ($menu_items as $slug => $title): ?>
          <option value="<?php echo esc_attr($slug); ?>" <?php selected($relative_to, $slug); ?>><?php echo esc_html($title); ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div id="custom-position-wrapper" style="<?php echo esc_attr($position_type === 'custom' ? '' : 'display: none;'); ?>">
      <input type="number" name="custom_position" value="<?php echo esc_attr($custom_position); ?>" min="1" max="99" class="small-text">
    </div>

    <?php // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- Small inline settings toggle ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      const positionType = document.getElementById('menu-position-type');
      const relativeWrapper = document.getElementById('relative-position-wrapper');
      const customWrapper = document.getElementById('custom-position-wrapper');
      
      positionType.addEventListener('change', function() {
        relativeWrapper.style.display = this.value === 'relative' ? 'block' : 'none';
        customWrapper.style.display = this.value === 'custom' ? 'block' : 'none';
      });
    });
    </script>
    <?php
  }
  
  private function render_date_format_field($settings) {
    $date_format = $settings['date_format'];
    $format_options = array(
      'us' => array('label' => __('US Format (MM/DD/YYYY)', 'magicassistant'), 'example' => '03/15/2024 2:30 PM'),
      'eu' => array('label' => __('European Format (DD/MM/YYYY)', 'magicassistant'), 'example' => '15/03/2024 14:30'),
      'iso' => array('label' => __('ISO Format (YYYY-MM-DD)', 'magicassistant'), 'example' => '2024-03-15 14:30'),
      'compact' => array('label' => __('Compact Format (DD MMM YYYY)', 'magicassistant'), 'example' => '15 Mar 2024 14:30'),
      'long' => array('label' => __('Long Format (Month DD, YYYY)', 'magicassistant'), 'example' => 'March 15, 2024 2:30 PM')
    );
    ?>
    <select name="date_format" class="regular-text">
      <?php foreach ($format_options as $key => $format): ?>
        <option value="<?php echo esc_attr($key); ?>" <?php selected($date_format, $key); ?>>
          <?php echo esc_html($format['label']); ?> - <?php echo esc_html($format['example']); ?>
        </option>
      <?php endforeach; ?>
    </select>
    <p class="description"><?php esc_html_e('Choose how dates and times should be displayed throughout Magic plugins.', 'magicassistant'); ?></p>
    <?php
  }
  
  private function render_submenu_order_field($settings) {
    $submenu_order = $settings['submenu_order'];
    
    // Get current Magic plugin submenu items
    global $submenu;
    $magic_submenus = array();
    if (isset($submenu['magic_plugins']) && is_array($submenu['magic_plugins'])) {
      foreach ($submenu['magic_plugins'] as $sub) {
        if (isset($sub[2]) && $sub[2] !== 'magic_plugins_landing') {
          $magic_submenus[$sub[2]] = $sub[0];
        }
      }
    }
    ?>
    <div id="submenu-order-container">
      <p class="description"><?php esc_html_e('Drag and drop to reorder Magic plugin submenu items.', 'magicassistant'); ?></p>
      <ul id="submenu-sortable" style="list-style: none; padding: 0;">
        <?php 
        // Order items based on saved order, then add any new ones
        $ordered_items = array();
        foreach ($submenu_order as $slug) {
          if (isset($magic_submenus[$slug])) {
            $ordered_items[$slug] = $magic_submenus[$slug];
            unset($magic_submenus[$slug]);
          }
        }
        // Add any remaining items
        $ordered_items = array_merge($ordered_items, $magic_submenus);
        
        foreach ($ordered_items as $slug => $title): ?>
          <li style="background: #f1f1f1; padding: 10px; margin: 5px 0; cursor: move; border: 1px solid #ddd;">
            <input type="hidden" name="submenu_order[]" value="<?php echo esc_attr($slug); ?>">
            <?php echo esc_html(wp_strip_all_tags($title)); ?>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>

    <?php // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- Small inline drag-and-drop script ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Simple drag and drop implementation
      const sortable = document.getElementById('submenu-sortable');
      if (sortable) {
        let draggedElement = null;
        
        sortable.addEventListener('dragstart', function(e) {
          draggedElement = e.target;
          e.target.style.opacity = '0.5';
        });
        
        sortable.addEventListener('dragend', function(e) {
          e.target.style.opacity = '';
          draggedElement = null;
        });
        
        sortable.addEventListener('dragover', function(e) {
          e.preventDefault();
        });
        
        sortable.addEventListener('drop', function(e) {
          e.preventDefault();
          if (draggedElement && e.target !== draggedElement && e.target.tagName === 'LI') {
            const rect = e.target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            sortable.insertBefore(draggedElement, next ? e.target.nextSibling : e.target);
          }
        });
        
        // Make items draggable
        const items = sortable.querySelectorAll('li');
        items.forEach(item => {
          item.draggable = true;
        });
      }
    });
    </script>
    <?php
  }
  
  public function admin_page() {
    ?>
      <div id="mat-admin-root"></div>
    <?php
  }

  // Add landing submenu with high priority to ensure it appears last
  public function add_landing_submenu() {
    // If we created the top-level menu, remove the automatic duplicate first
    if ( $this->created_toplevel_menu ) {
      remove_submenu_page( 'magic_plugins', 'magic_plugins' );
    }

    // Ensure there is exactly one MagicPlugins landing submenu (last position)
    global $submenu;
    $landing_exists = false;
    if ( isset( $submenu['magic_plugins'] ) && is_array( $submenu['magic_plugins'] ) ) {
      foreach ( $submenu['magic_plugins'] as $sub ) {
        if ( isset( $sub[2] ) && $sub[2] === 'magic_plugins_landing' ) {
          $landing_exists = true;
          break;
        }
      }
    }

    if ( ! $landing_exists ) {
      add_submenu_page(
        'magic_plugins',
        __( 'MagicPlugins', 'magicassistant' ),
        __( 'MagicPlugins', 'magicassistant' ),
        'manage_options',
        'magic_plugins_landing',
        array( $this, 'magic_plugins_landing_page' )
      );
    }
  }

  // Apply custom submenu ordering after all plugins have added their items
  public function apply_submenu_ordering() {
    global $submenu;
    
    if (!isset($submenu['magic_plugins']) || !is_array($submenu['magic_plugins'])) {
      return;
    }
    
    // Get saved submenu order
    $settings = $this->get_shared_settings();
    $submenu_order = $settings['submenu_order'];
    
    if (empty($submenu_order)) {
      return; // No custom order set
    }
    
    // Store original submenu items (excluding landing page)
    $original_items = array();
    $landing_item = null;
    
    foreach ($submenu['magic_plugins'] as $item) {
      if (isset($item[2])) {
        if ($item[2] === 'magic_plugins_landing') {
          $landing_item = $item; // Save landing page for last
        } else {
          $original_items[$item[2]] = $item;
        }
      }
    }
    
    // Rebuild submenu in custom order
    $new_submenu = array();
    
    // Add items in custom order
    foreach ($submenu_order as $slug) {
      if (isset($original_items[$slug])) {
        $new_submenu[] = $original_items[$slug];
        unset($original_items[$slug]);
      }
    }
    
    // Add any remaining items that weren't in the custom order
    foreach ($original_items as $item) {
      $new_submenu[] = $item;
    }
    
    // Add landing page at the end
    if ($landing_item) {
      $new_submenu[] = $landing_item;
    }
    
    // Replace the submenu
    $submenu['magic_plugins'] = $new_submenu;
  }
  
  // AJAX handler for saving theme mode
  public function save_theme_mode() {
    // Verify nonce
    if (!check_ajax_referer('mat_save_theme_mode', '_ajax_nonce', false)) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Security check failed.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to change theme preferences.', 'magicassistant')
      )));
    }
    
    $mode = isset($_POST['mode']) ? sanitize_text_field(wp_unslash($_POST['mode'])) : '';
    
    if (!in_array($mode, array('light', 'dark'))) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid theme mode.', 'magicassistant')
      )));
    }
    
    // Save the theme preference to WordPress user meta
    $user_id = get_current_user_id();
    update_user_meta($user_id, 'mat_theme', $mode);
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'mode' => $mode,
        'message' => __('Theme preference saved successfully.', 'magicassistant')
      )
    )));
  }

  // Utility method to get shared date format setting
  public static function get_shared_date_format() {
    $settings = get_option('magic_plugins_settings', array());
    return isset($settings['date_format']) ? $settings['date_format'] : 'us';
  }

  // Utility method to format date according to shared setting
  public static function format_date($timestamp, $include_time = true) {
    $format = self::get_shared_date_format();
    
    $formats = array(
      'us' => $include_time ? 'm/d/Y g:i A' : 'm/d/Y',
      'eu' => $include_time ? 'd/m/Y H:i' : 'd/m/Y', 
      'iso' => $include_time ? 'Y-m-d H:i' : 'Y-m-d',
      'compact' => $include_time ? 'd M Y H:i' : 'd M Y',
      'long' => $include_time ? 'F j, Y g:i A' : 'F j, Y'
    );
    
    $date_format = isset($formats[$format]) ? $formats[$format] : $formats['us'];
    return wp_date($date_format, $timestamp);
  }

  /**
   * AJAX handler to mark tour as completed
   */
  public function mark_tour_completed() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to save tour completion.', 'magicassistant')
      )));
    }
    
    $tour_type = isset($_POST['tour_type']) ? sanitize_text_field(wp_unslash($_POST['tour_type'])) : '';
    
    if (!in_array($tour_type, array('license', 'dashboard', 'settings'))) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid tour type.', 'magicassistant')
      )));
    }
    
    // Save the tour completion to WordPress user meta
    $user_id = get_current_user_id();
    $meta_key = 'mat_tour_completed_' . $tour_type;
    update_user_meta($user_id, $meta_key, true);
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'tour_type' => $tour_type,
        'message' => __('Tour completion saved successfully.', 'magicassistant')
      )
    )));
  }

  /**
   * AJAX handler to reset tour completion
   */
  public function reset_tour() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to reset tour.', 'magicassistant')
      )));
    }
    
    $tour_type = isset($_POST['tour_type']) ? sanitize_text_field(wp_unslash($_POST['tour_type'])) : '';
    
    if (!in_array($tour_type, array('license', 'dashboard', 'settings'))) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid tour type.', 'magicassistant')
      )));
    }
    
    // Remove the tour completion from WordPress user meta
    $user_id = get_current_user_id();
    $meta_key = 'mat_tour_completed_' . $tour_type;
    delete_user_meta($user_id, $meta_key);
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'tour_type' => $tour_type,
        'message' => __('Tour reset successfully.', 'magicassistant')
      )
    )));
  }

  /**
   * AJAX handler to mark tour as triggered
   */
  public function mark_tour_triggered() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to mark tour as triggered.', 'magicassistant')
      )));
    }
    
    $tour_type = isset($_POST['tour_type']) ? sanitize_text_field(wp_unslash($_POST['tour_type'])) : '';
    
    if (!in_array($tour_type, array('license', 'dashboard', 'settings'))) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid tour type.', 'magicassistant')
      )));
    }
    
    // Save the tour trigger timestamp to WordPress user meta
    $user_id = get_current_user_id();
    $meta_key = 'mat_tour_triggered_' . $tour_type;
    update_user_meta($user_id, $meta_key, current_time('timestamp'));
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'tour_type' => $tour_type,
        'message' => __('Tour marked as triggered successfully.', 'magicassistant')
      )
    )));
  }

  /**
   * AJAX handler to dismiss tours permanently
   */
  public function dismiss_tour_permanently() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to dismiss tours.', 'magicassistant')
      )));
    }
    
    // Mark tours as permanently dismissed for this user
    $user_id = get_current_user_id();
    update_user_meta($user_id, 'mat_tour_dismissed_permanently', true);
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'message' => __('Tours dismissed permanently.', 'magicassistant')
      )
    )));
  }

  /**
   * AJAX handler to mark first visit as complete
   */
  public function mark_first_visit_complete() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to mark first visit.', 'magicassistant')
      )));
    }
    
    // Mark first visit as complete for this user
    $user_id = get_current_user_id();
    update_user_meta($user_id, 'mat_tour_first_visit_complete', true);
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'message' => __('First visit marked as complete.', 'magicassistant')
      )
    )));
  }

  /**
   * AJAX handler to reset all tours for current user
   */
  public function reset_all_tours() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to reset tours.', 'magicassistant')
      )));
    }
    
    // Reset all tour-related user meta
    $user_id = get_current_user_id();
    delete_user_meta($user_id, 'mat_tour_completed_license');
    delete_user_meta($user_id, 'mat_tour_completed_dashboard');
    delete_user_meta($user_id, 'mat_tour_completed_settings');
    delete_user_meta($user_id, 'mat_tour_dismissed_permanently');
    delete_user_meta($user_id, 'mat_tour_first_visit_complete');
    delete_user_meta($user_id, 'mat_tour_triggered_license');
    delete_user_meta($user_id, 'mat_tour_triggered_dashboard');
    delete_user_meta($user_id, 'mat_tour_triggered_settings');
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'message' => __('All tours reset successfully.', 'magicassistant')
      )
    )));
  }

  /**
   * AJAX handler to re-enable tours for current user
   */
  public function reenable_tours() {
    // Check nonce for security
    if (!isset($_POST['_ajax_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_ajax_nonce'])), 'mat_ajax_nonce')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid nonce.', 'magicassistant')
      )));
    }
    
    // Check if user is logged in
    if (!is_user_logged_in()) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You must be logged in to re-enable tours.', 'magicassistant')
      )));
    }
    
    // Remove permanently dismissed flag for this user
    $user_id = get_current_user_id();
    delete_user_meta($user_id, 'mat_tour_dismissed_permanently');
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'message' => __('Tours re-enabled successfully.', 'magicassistant')
      )
    )));
  }
} 