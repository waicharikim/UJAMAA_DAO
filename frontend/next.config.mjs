import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { withSentryConfig } from "@sentry/nextjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Explicit runtime caching. The default next-pwa cache can serve a stale HTML
// shell on slow networks, which then points at JS chunks that no longer exist
// after a deploy → blank screen. The fix: the HTML document and RSC data are
// NETWORK FIRST (always try fresh, fall back to cache only if the network is
// slow/offline), while content-hashed /_next/static/ chunks stay CacheFirst —
// their filename hash changes every build, so they can never go stale.
const runtimeCaching = [
  // Google Fonts stylesheets — refresh in the background.
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "google-fonts-stylesheets",
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // Google Fonts webfont files — immutable.
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "google-fonts-webfonts",
      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // Content-hashed Next static assets (JS/CSS chunks, local fonts) — safe to
  // cache hard; the hash changes whenever the content changes.
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "next-static",
      expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
  // Images — serve from cache, refresh in background.
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|avif)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "static-images",
      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
  // Next RSC / data payloads — network first.
  {
    urlPattern: /\/_next\/data\/.*/i,
    handler: "NetworkFirst",
    options: { cacheName: "next-data", networkTimeoutSeconds: 10 },
  },
  // HTML document / page navigations — NETWORK FIRST so we never boot a stale
  // shell. Short timeout keeps slow networks usable via the cache fallback.
  {
    urlPattern: ({ request }) => request.mode === "navigate",
    handler: "NetworkFirst",
    options: {
      cacheName: "html-pages",
      networkTimeoutSeconds: 5,
      expiration: { maxEntries: 50 },
    },
  },
  // API calls — never cache dynamic data.
  {
    urlPattern: /\/api\/.*/i,
    handler: "NetworkOnly",
  },
]

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Purge precaches from previous builds so an installed PWA can't serve a
  // stale HTML shell that points at JS chunks that no longer exist (which boots
  // to a blank/black screen after a deploy). Pairs with the ChunkLoadError
  // reload guard mounted in app/layout.tsx.
  cleanupOutdatedCaches: true,
  runtimeCaching,
  customWorkerSrc: "worker",
  customWorkerDest: "public",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
}

export default withSentryConfig(withPWA(nextConfig), {
  org: "ujamaa-6p",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
})
