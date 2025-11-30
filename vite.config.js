import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import flowbiteReact from "flowbite-react/plugin/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), flowbiteReact()],
  server: {
    port: 3000,
    cors: true,
    origin: 'http://localhost:3000',
    // Add this to help with WordPress integration
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: './src/main.jsx',
        admin: './src/admin.jsx',
        debug: path.resolve(__dirname, 'src/debug.jsx'),
        mediaLibrary: './src/media-library.jsx',
        imageEditor: './src/image-editor.jsx',
        bricksTextEnhancer: './src/bricks-text-enhancer.jsx'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Handle special case for media-library (keep it as media-library.js instead of camelCase)
          if (chunkInfo.name === 'mediaLibrary') {
            return 'media-library.js';
          }
          // Handle special case for image-editor (keep it as image-editor.js instead of camelCase)
          if (chunkInfo.name === 'imageEditor') {
            return 'image-editor.js';
          }
          // Handle special case for bricks-text-enhancer
          if (chunkInfo.name === 'bricksTextEnhancer') {
            return 'bricks-text-enhancer.js';
          }
          return '[name].js';
        },
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep font files at root level
          if (assetInfo.name && assetInfo.name.endsWith('.woff2')) {
            return '[name].[ext]'
          }
          // Keep CSS files in assets with descriptive names
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/styles-[hash].css'
          }
          return 'assets/[name]-[hash].[ext]'
        },
        // Optimize chunking
        manualChunks: {
          // Separate vendor chunks
          vendor: ['react', 'react-dom'],
          flowbite: ['flowbite', 'flowbite-react'],
          utils: ['@hello-pangea/dnd', 'react-select', 'react-tooltip'],
          tour: ['driver.js']
        }
      }
    },
    // Enable source maps for debugging in production
    sourcemap: false,
    // Optimize build
    minify: 'esbuild',
    target: 'es2015'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'flowbite', 'flowbite-react'],
    force: true
  },
  resolve: {
    dedupe: ['@emotion/react'],
    alias: {
      '@emotion/react': path.resolve('./node_modules/@emotion/react')
    }
  },
  css: {
    postcss: './postcss.config.js'
  }
}) 