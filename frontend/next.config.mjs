import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const webpack = require("webpack")

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Turbopack equivalents of the webpack stubs below (used by `next dev --turbopack`)
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

export default nextConfig
