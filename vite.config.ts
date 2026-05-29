import { defineConfig } from "vite";

// Relative base so the build works both on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) and when self-hosted / embedded on
// portals such as CrazyGames or itch.io.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    assetsInlineLimit: 4096,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
});
