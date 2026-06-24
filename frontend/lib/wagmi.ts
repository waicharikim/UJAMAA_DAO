import { http, createConfig } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { coinbaseWallet } from "wagmi/connectors"

// Active chain is env-selectable so we can flip dev (Base Sepolia) → prod
// (Base mainnet) without code changes. Set NEXT_PUBLIC_CHAIN=base for mainnet;
// anything else (or unset) stays on Base Sepolia. The backend paymaster proxy
// maps the same chainId (8453 / 84532) to the right Pimlico endpoint.
const ACTIVE_CHAIN = process.env.NEXT_PUBLIC_CHAIN === "base" ? base : baseSepolia

// Coinbase Smart Wallet — passkey-secured self-custody smart account.
// `preference: "smartWalletOnly"` forces the passkey smart-wallet flow (no
// browser-extension / EOA path), which is the trustless, mobile-native account
// we want: the signer is a device passkey, so the platform can never sign for
// the user. Gasless sponsorship (Pimlico via our backend proxy) is wired at the
// call site via EIP-5792 capabilities.
export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  connectors: [
    coinbaseWallet({
      appName: "UjamaaDAO",
      preference: "smartWalletOnly",
    }),
  ],
  transports: {
    [ACTIVE_CHAIN.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
        ACTIVE_CHAIN.rpcUrls.default.http[0],
    ),
  },
})

export { ACTIVE_CHAIN }
