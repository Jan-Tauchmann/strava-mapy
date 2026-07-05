import { defineConfig } from "vite";

export default defineConfig({
  // If you deploy to a subpath, adjust base.
  // For root domain (https://strava-mapy.com), keep "/"
  // For subpath (https://example.com/mapy/), use "/mapy/"
  base: "/",

  build: {
    outDir: "dist",     // output folder
    assetsDir: "assets", // keeps CSS/images cleanly in /assets
    sourcemap: true,     // useful for debugging
    rollupOptions: {
      output: {
        // Ensures hashed filenames for cache busting in CloudFront
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },

  server: {
    port: 5173,
    strictPort: true, // fails fast if port taken
    open: true        // auto-open browser
  },

  preview: {
    port: 8080, // preview built app with `npm run preview`
  }
});
