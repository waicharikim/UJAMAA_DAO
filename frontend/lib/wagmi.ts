import { http, createConfig } from "wagmi"
import { baseSepolia } from "wagmi/chains"
import { coinbaseWallet } from "wagmi/connectors"

// Coinbase Smart Wallet — passkey-secured self-custody smart account.
// `preference: "smartWalletOnly"` forces the passkey smart-wallet flow (no
// browser-extension / EOA path), which is the trustless, mobile-native account
// we want: the signer is a device passkey, so the platform can never sign for
// the user. Gasless sponsorship (Pimlico paymaster) is wired at the call site
// via EIP-5792 capabilities in a later step.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: "UjamaaDAO",
      preference: "smartWalletOnly",
    }),
  ],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://sepolia.base.org",
    ),
  },
})

export const ACTIVE_CHAIN = baseSepolia
