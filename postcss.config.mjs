const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Skip Lightning CSS minification — it produces output that PostCSS
      // can't re-parse (the plugin re-parses its own output after
      // optimization).  General optimization (tree-shaking, merging) still
      // runs via the `{ minify: false }` flag.
      optimize: { minify: false },
    },
  },
};

export default config;