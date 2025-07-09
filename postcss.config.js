import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import prefixwrap from 'postcss-prefixwrap';

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
    prefixwrap(':is(#mat-admin-root, #mat-public-root)', {
      // Exclude driver.js styles from scoping since they're injected into document.body
      ignoredSelectors: [
        /^\.driver-/,  // Regex to match all driver.js classes
        /^@keyframes animate-fade-in$/,  // Driver.js animation
        /^\.driver-popover/,
        /^\.driver-overlay/,
        /^\.driver-active/,
        /^\.driver-fade/,
        /^\.driver-no-interaction/,
        /^\.driver-popover-title/,
        /^\.driver-popover-description/,
        /^\.driver-popover-footer/,
        /^\.driver-popover-close-btn/,
        /^\.driver-popover-navigation-btns/,
        /^\.driver-popover-progress-text/,
        /^\.driver-popover-arrow/,
        /^\.driver-popover-btn-disabled/,
        /^\.driver-active-element/,
      ]
    })
  ]
} 