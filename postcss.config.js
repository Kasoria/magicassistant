import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import prefixwrap from 'postcss-prefixwrap';

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
    prefixwrap(':is(#mat-admin-root, #mat-public-root)')
  ]
} 