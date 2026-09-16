import { UserConfig } from "vite";

import react from "@vitejs/plugin-react";

export default (): UserConfig => ({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 5000,
    outDir: "_dist",
    assetsDir: "",
    rollupOptions: {
      output: {
        // [QW-9 legacy-handoff] Restore vendor code-splitting (was forced into one 1.56 MB chunk).
        manualChunks(id: string) {
          if (id.includes("node_modules/echarts")) return "echarts";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  root: "src",
  server: {
    port: 1234,
    strictPort: true,
  },
});
