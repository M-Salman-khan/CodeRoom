import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/ws": { target: "ws://localhost:3000", ws: true },
      "/yjs": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          monaco: ["monaco-editor", "@monaco-editor/react"],
          yjs: ["yjs", "y-websocket"],
        },
      },
    },
  },
});
