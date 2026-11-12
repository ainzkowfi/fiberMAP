import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "fiberMAP",
        short_name: "fiberMAP",
        description:
          "Offline fiber line mapping, cut & repair tracking, Line Stats analytics, and OTDR locator for Agusan del Sur.",
        theme_color: "#0A7C8C",
        background_color: "#F4F6F7",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The province basemap is in the precache on purpose: a crew who
        // installs the app has the whole province offline before they walk to
        // the first pole. The shell is 1.5 MB and the archive 9.2 MB.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,pmtiles}"],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Runtime cache for map tiles / any CDN asset; everything else is precached.
        runtimeCaching: [
          {
            urlPattern: /\/maps\/.*\.pmtiles$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fibermap-basemap",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\.(?:pmtiles|mvt|pbf|json|woff2)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fibermap-tiles",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
