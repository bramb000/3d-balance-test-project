import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@balance/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["mjswan"],
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 30000,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
