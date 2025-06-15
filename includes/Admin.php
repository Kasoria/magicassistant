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
        __( 'MagicPlugins', 'magic-assistant' ),
        __( 'MagicPlugins', 'magic-assistant' ),
        'manage_options',
        'magic_plugins',
        array( $this, 'magic_plugins_landing_page' ),
        'dashicons-admin-plugins',
        $menu_position
      );
      
      // Mark that we created the top-level menu
      $this->created_toplevel_menu = true;
    }

    // Finally, add MagicAssistant as a submenu of MagicPlugins
    add_submenu_page(
      'magic_plugins',
      __( 'MagicAssistant', 'magic-assistant' ),
      __( 'MagicAssistant', 'magic-assistant' ),
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
      'savedTheme' => MATDB() ? MATDB()->get_user_setting('theme', $current_user->ID, 'light') : 'light',
      'isAdmin' => current_user_can('manage_options'),
      'isDev' => defined('WP_DEBUG') && WP_DEBUG,
      'pluginUrl' => MAGIC_ASSISTANT_PLUGIN_URL,
      'adminUrl' => admin_url(),
      'dashboardUrl' => admin_url('index.php'),
      'currentPage' => $this->get_current_page($hook),
      'initialTab' => $this->get_initial_tab(),
      'i18n' => array(
        'loading' => __('Loading...', 'magic-assistant'),
        'error' => __('An error occurred', 'magic-assistant'),
        'save' => __('Save', 'magic-assistant'),
        'cancel' => __('Cancel', 'magic-assistant'),
        'delete' => __('Delete', 'magic-assistant'),
        'edit' => __('Edit', 'magic-assistant'),
        'success' => __('Success!', 'magic-assistant'),
        'confirmDelete' => __('Are you sure you want to delete this item?', 'magic-assistant'),
      )
    );
    
    // Localize the script - this will be picked up by the React dev class
    wp_localize_script('mat-react-admin-dev', 'matAdminData', $admin_data);
    wp_localize_script('mat-react-admin', 'matAdminData', $admin_data);
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
    $tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'dashboard';
    $view = isset($_GET['view']) ? sanitize_text_field($_GET['view']) : '';
    
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
      echo '<div class="notice notice-success"><p>' . __('Settings saved successfully!', 'magic-assistant') . '</p></div>';
    }

    $settings = $this->get_shared_settings();
    ?>
    <div class="wrap">
      <h1><?php echo esc_html__( 'MagicPlugins Settings', 'magic-assistant' ); ?></h1>
      <p><?php echo esc_html__( 'Configure shared settings for all Magic plugins.', 'magic-assistant' ); ?></p>
      
      <form method="post" action="">
        <?php wp_nonce_field('magic_plugins_settings', 'magic_plugins_nonce'); ?>
        
        <table class="form-table">
          <tr>
            <th scope="row"><?php esc_html_e('Menu Position', 'magic-assistant'); ?></th>
            <td>
              <?php $this->render_menu_position_field($settings); ?>
            </td>
          </tr>
          
          <tr>
            <th scope="row"><?php esc_html_e('Date & Time Format', 'magic-assistant'); ?></th>
            <td>
              <?php $this->render_date_format_field($settings); ?>
            </td>
          </tr>
          
          <tr>
            <th scope="row"><?php esc_html_e('Submenu Items Order', 'magic-assistant'); ?></th>
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
          $title = strip_tags($item[0]);
          $menu_items[$item[2]] = $title;
        }
      }
    }
    ?>
    <select name="menu_position_type" id="menu-position-type">
      <option value="default" <?php selected($position_type, 'default'); ?>><?php esc_html_e('Default Position', 'magic-assistant'); ?></option>
      <option value="relative" <?php selected($position_type, 'relative'); ?>><?php esc_html_e('Relative to Another Menu Item', 'magic-assistant'); ?></option>
      <option value="custom" <?php selected($position_type, 'custom'); ?>><?php esc_html_e('Custom Position (1-99)', 'magic-assistant'); ?></option>
    </select>

    <div id="relative-position-wrapper" style="<?php echo $position_type === 'relative' ? '' : 'display: none;'; ?>">
      <select name="menu_position">
        <option value="after" <?php selected($position, 'after'); ?>><?php esc_html_e('After', 'magic-assistant'); ?></option>
        <option value="before" <?php selected($position, 'before'); ?>><?php esc_html_e('Before', 'magic-assistant'); ?></option>
      </select>
      <select name="menu_position_relative_to">
        <option value=""><?php esc_html_e('Select Menu Item', 'magic-assistant'); ?></option>
        <?php foreach ($menu_items as $slug => $title): ?>
          <option value="<?php echo esc_attr($slug); ?>" <?php selected($relative_to, $slug); ?>><?php echo esc_html($title); ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div id="custom-position-wrapper" style="<?php echo $position_type === 'custom' ? '' : 'display: none;'; ?>">
      <input type="number" name="custom_position" value="<?php echo esc_attr($custom_position); ?>" min="1" max="99" class="small-text">
    </div>

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
      'us' => array('label' => __('US Format (MM/DD/YYYY)', 'magic-assistant'), 'example' => '03/15/2024 2:30 PM'),
      'eu' => array('label' => __('European Format (DD/MM/YYYY)', 'magic-assistant'), 'example' => '15/03/2024 14:30'),
      'iso' => array('label' => __('ISO Format (YYYY-MM-DD)', 'magic-assistant'), 'example' => '2024-03-15 14:30'),
      'compact' => array('label' => __('Compact Format (DD MMM YYYY)', 'magic-assistant'), 'example' => '15 Mar 2024 14:30'),
      'long' => array('label' => __('Long Format (Month DD, YYYY)', 'magic-assistant'), 'example' => 'March 15, 2024 2:30 PM')
    );
    ?>
    <select name="date_format" class="regular-text">
      <?php foreach ($format_options as $key => $format): ?>
        <option value="<?php echo esc_attr($key); ?>" <?php selected($date_format, $key); ?>>
          <?php echo esc_html($format['label']); ?> - <?php echo esc_html($format['example']); ?>
        </option>
      <?php endforeach; ?>
    </select>
    <p class="description"><?php esc_html_e('Choose how dates and times should be displayed throughout Magic plugins.', 'magic-assistant'); ?></p>
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
      <p class="description"><?php esc_html_e('Drag and drop to reorder Magic plugin submenu items.', 'magic-assistant'); ?></p>
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
            <?php echo esc_html(strip_tags($title)); ?>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>

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
        __( 'MagicPlugins', 'magic-assistant' ),
        __( 'MagicPlugins', 'magic-assistant' ),
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
        'data' => __('Security check failed.', 'magic-assistant')
      )));
    }
    
    // Check user permissions
    if (!current_user_can('manage_options')) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('You do not have permission to perform this action.', 'magic-assistant')
      )));
    }
    
    $mode = sanitize_text_field($_POST['mode']);
    
    if (!in_array($mode, array('light', 'dark'))) {
      wp_die(json_encode(array(
        'success' => false,
        'data' => __('Invalid theme mode.', 'magic-assistant')
      )));
    }
    
    // Save the theme preference
    $user_id = get_current_user_id();
    if (MATDB()) {
      MATDB()->save_user_setting('theme', $mode, $user_id);
    } else {
      update_user_meta($user_id, 'mat_theme', $mode);
    }
    
    wp_die(json_encode(array(
      'success' => true,
      'data' => array(
        'mode' => $mode,
        'message' => __('Theme preference saved successfully.', 'magic-assistant')
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
    return date($date_format, $timestamp);
  }
} 