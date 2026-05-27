import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { withSentryConfig } from "@sentry/nextjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const webpack = require("webpack")
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  customWorkerSrc: "worker",
  customWorkerDest: "public",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // Prevent @privy-io/react-auth (browser-only) from being bundled server-side.
  // Components that use it are all "use client" + ssr:false, so this package
  // is never actually executed on the server — but Turbopack's static analysis
  // still tries to initialise it, triggering "Cannot read properties of null
  // (reading 'useContext')". Marking it external skips that initialisation.
  serverExternalPackages: ["@privy-io/react-auth"],
  // Turbopack equivalents of the webpack stubs below (used by `next dev --turbopack`)
  // NOTE: modularizeImports for lucide-react was removed — Privy imports icons
  // (e.g. FingerprintIcon) that don't exist in our pinned lucide-react v0.294,
  // causing "module not found" errors when the path transform is applied.
  turbopack: {
    resolveAlias: {
      unstorage: "./stubs/empty.js",
      "x402/client": "./stubs/empty.js",
      "@base-org/account": "./stubs/empty.js",
    },
  },
  webpack: (config) => {
    // Stub missing optional transitive deps from @privy-io/react-auth:
    //
    //   - unstorage: used by @walletconnect/core for KV storage (not needed)
    //   - x402/client: Privy payment-protocol feature (not used)
    //   - @base-org/account: Privy Coinbase smart-wallet; its viem dep fails ESM resolution
    //
    config.resolve.alias = {
      ...config.resolve.alias,
      unstorage: path.resolve(__dirname, "stubs/empty.js"),
      "x402/client": path.resolve(__dirname, "stubs/empty.js"),
      "@base-org/account": path.resolve(__dirname, "stubs/empty.js"),
    }

    // DelegatedActionsConsentScreen is a Privy UI component that imports
    // `CloudUpload` from lucide-react.  That icon was added ~v0.355 but our
    // pinned version is 0.294.  We never use delegated-actions, so stub the
    // whole component to prevent the missing-export compile error.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /DelegatedActionsConsentScreen/,
        path.resolve(__dirname, "stubs/empty.js"),
      ),
    )

    return config
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
