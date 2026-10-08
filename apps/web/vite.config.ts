import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@logoshome/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@logoshome/bible": path.resolve(__dirname, "../../packages/bible/src/index.ts"),
      "@logoshome/crypto": path.resolve(__dirname, "../../packages/crypto/src/index.ts"),
      "@logoshome/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
      // Node-native Signal bindings must never enter the browser graph.
      "@signalapp/libsignal-client": path.resolve(__dirname, "src/shims/empty-libsignal.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@signalapp/libsignal-client"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "LogosHome 圣言家",
        short_name: "圣言家",
        description: "Bible reading, devotion, and secure church community",
        theme_color: "#0f6b5c",
        background_color: "#f3efe6",
        display: "standalone",
        lang: "zh-CN",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:8787",
        ws: true,
        changeOrigin: true,
      },
      "/health": "http://127.0.0.1:8787",
    },
  },
});
