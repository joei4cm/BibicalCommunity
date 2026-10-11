import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const openE2eeRoot = path.dirname(
  require.resolve("@open-e2ee/signal-protocol-sdk/package.json"),
);

export default defineConfig({
  resolve: {
    conditions: ["browser", "module", "import"],
    alias: {
      "@logoshome/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@logoshome/bible": path.resolve(__dirname, "../../packages/bible/src/index.ts"),
      "@logoshome/crypto": path.resolve(__dirname, "../../packages/crypto/src/index.ts"),
      "@logoshome/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
      // Node-native Signal bindings must never enter the browser graph.
      "@signalapp/libsignal-client": path.resolve(__dirname, "src/shims/empty-libsignal.ts"),
      // Deep OpenE2EE internals (not in package exports) for browser mutual-ECDH.
      "@open-e2ee/signal-protocol-sdk/dist/internal/crypto/ec/index.js": path.join(
        openE2eeRoot,
        "dist/internal/crypto/ec/index.js",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@signalapp/libsignal-client"],
    include: ["@noble/curves"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icons/*.png"],
      manifest: {
        id: "/",
        name: "圣言家 LogosHome",
        short_name: "圣言家",
        description: "读经 · 灵修 · 家 — 端到端加密的圣经与教会社区应用",
        theme_color: "#0f6b5c",
        background_color: "#f3efe6",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait-primary",
        lang: "zh-CN",
        dir: "ltr",
        start_url: "/app/",
        scope: "/",
        categories: ["books", "lifestyle", "social"],
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
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
