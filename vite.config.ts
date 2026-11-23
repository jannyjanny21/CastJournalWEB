import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline (F-13). The service worker caches the app itself, fonts, map tiles
    // and photos you've viewed. API data for offline viewing is kept per user in IndexedDB
    // (src/offline), so it can be cleared on logout.
    VitePWA({
      registerType: "prompt", // ask before reloading, so an update never wipes a half-filled form
      includeAssets: ["logo-icon.svg", "apple-touch-icon.png", "favicon-192.png"],
      manifest: {
        name: "CastJournal",
        short_name: "CastJournal",
        description: "Your fishing log: trips, catches, spots and conditions — even offline.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F1FAF6",
        theme_color: "#0F3D2E",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Leaflet's bundle and charts push the main chunk past the 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map tiles of areas you've looked at, so the map still draws offline.
            urlPattern: /^https:\/\/[a-c]?\.?tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 14, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Photos you've viewed (videos are streamed with range requests, so they aren't cached).
            urlPattern: /\/uploads\/.*\.(?:jpe?g|png|webp|gif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "photos",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false }, // test offline with `npm run build && npm run preview`
    }),
  ],
  resolve: {
    alias: {
      // shadcn components import from "@/..." — this makes that resolve to src/
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
