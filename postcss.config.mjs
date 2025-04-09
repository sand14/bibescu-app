/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}, // Use the new PostCSS plugin
    autoprefixer: {},
  },
};

export default config;
