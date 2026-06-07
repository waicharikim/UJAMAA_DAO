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
  // Purge precaches from previous builds so an installed PWA can't serve a
  // stale HTML shell that points at JS chunks that no longer exist (which boots
  // to a blank/black screen after a deploy). Pairs with the ChunkLoadError
  // reload guard mounted in app/layout.tsx.
  cleanupOutdatedCaches: true,
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
      // NOTE: `unstorage` is NOT stubbed — it's a real (installed) dependency of
      // @walletconnect/keyvaluestorage. Stubbing it with an empty object made
      // `createStorage` undefined, so WalletConnect's storage threw on init and
      // fell back to a degraded path — breaking MetaMask / WalletConnect connect
      // in the installed PWA (black screen). Let the real module resolve.
      "x402/client": "./stubs/empty.js",
      "@base-org/account": "./stubs/empty.js",
    },
  },
  webpack: (config) => {
    // Stub optional transitive deps from @privy-io/react-auth that we don't use:
    //
    //   - x402/client: Privy payment-protocol feature (not used)
    //   - @base-org/account: Privy Coinbase smart-wallet; its viem dep fails ESM resolution
    //
    // `unstorage` is deliberately NOT stubbed — WalletConnect needs its real
    // `createStorage` (see the turbopack block above).
    config.resolve.alias = {
      ...config.resolve.alias,
      "x402/client": path.resolve(__dirname, "stubs/empty.js"),
      "@base-org/account": path.resolve(__dirname, "stubs/empty.js"),
    }

    // DelegatedActionsConsentScreen is a Privy UI component that imports
    // `CloudUpload` from lucide-react.  That icon was added ~v0.355 but our
    // pinned version is 0.294.  We never use delegated-actions, so stub it.
    // NOTE: stub with a real no-op *component* (renders null), NOT an empty
    // object — Privy renders this in its modal portal, and an empty object
    // throws "Element type is invalid", crashing the modal and leaving a stuck
    // dark backdrop over the app (black screen).
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /DelegatedActionsConsentScreen/,
        path.resolve(__dirname, "stubs/noop-component.js"),
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
