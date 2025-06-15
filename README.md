# MagicAssistant WordPress Plugin

Your personal AI assistant for WordPress websites.

## Development Setup

This plugin uses React + Vite + Flowbite for the frontend with PHP backend integration.

### Prerequisites

- Node.js 18+
- npm or yarn
- WordPress development environment
- PHP 7.4+

### Installation

1. Clone or download the plugin to your WordPress plugins directory
2. Install dependencies:

```bash
npm install
```

### Development

1. Start the Vite development server:

```bash
npm run dev
```

This will start the dev server at `http://localhost:3000` with Hot Module Replacement (HMR).

2. In your WordPress `wp-config.php`, you can optionally add:

```php
// Force development mode (optional)
define('MAT_DEV_MODE', true);

// Enable debugging (recommended for development)
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

3. Activate the plugin in WordPress admin
4. Navigate to the MagicAssistant admin page to see your React app

### Building for Production

```bash
npm run build
```

This creates optimized bundles in the `dist/` directory.

### Development Features

- **Hot Module Replacement**: Changes to React components are reflected instantly
- **Automatic Dev Server Detection**: The plugin automatically detects if Vite dev server is running
- **CSS Isolation**: Tailwind styles are scoped to plugin components using PostCSS prefixwrap
- **Dual Entry Points**: Separate React apps for admin (`admin.jsx`) and public (`main.jsx`) areas
- **Flowbite Integration**: Pre-configured with Flowbite React components
- **Theme Support**: Light/dark mode switching built-in

### Project Structure

```
magicassistant/
├── src/
│   ├── components/
│   │   ├── AdminApp.jsx       # Admin dashboard React app
│   │   └── PublicApp.jsx      # Public-facing React app
│   ├── admin.jsx              # Admin entry point
│   ├── main.jsx               # Public entry point
│   └── index.css              # Main styles with Tailwind
├── includes/
│   └── class-mat-react-dev.php # PHP React development handler
├── dist/                      # Production build output
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── magicassistant.php         # Main plugin file
```

### WordPress Integration

The plugin provides:

- **PHP Class `MAT_React_Dev`**: Handles asset loading and WordPress integration
- **Nonces**: Automatic AJAX nonce generation for secure requests
- **Localized Data**: WordPress data available in React via `window.matAdminData` and `window.matPublicData`
- **REST API Ready**: Pre-configured REST endpoints structure
- **Admin Pages**: WordPress admin menu integration

### Customization

- **DOM Elements**: React apps mount to `#mat-admin-root` and `#mat-public-root`
- **CSS Prefix**: All styles are prefixed to avoid conflicts (configured in PostCSS)
- **Tailwind Theme**: Brand colors and spacing configured in `tailwind.config.js`
- **Build Optimization**: Vendor chunks and code splitting configured in Vite

## License

GPL v2 or later 