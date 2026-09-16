import { UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default (): UserConfig => ({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 8000,
    outDir: "_dist",
    assetsDir: "",
    rollupOptions: {
      output: {
        manualChunks: () => "index.js",
      },
    },
  },
  root: "src",
  server: {
    port: 1235,
    strictPort: true,
    fs: {
      // Allow serving files from the parent src/ directory (production Dashboard)
      allow: [".."],
    },
  },
  resolve: {
    // Use array form so more-specific entries are matched first
    alias: [
      {
        find: "@tago-io/custom-widget/dist/custom-widget.css",
        replacement: resolve(__dirname, "src/mock/empty.css"),
      },
      {
        find: "@tago-io/custom-widget",
        replacement: resolve(__dirname, "src/mock/custom-widget-shim.ts"),
      },
      {
        find: "@dashboard-src",
        replacement: resolve(__dirname, "../src"),
      },
    ],
  },
});
