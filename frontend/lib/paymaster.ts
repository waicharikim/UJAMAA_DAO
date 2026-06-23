// Pimlico paymaster (EIP-5792 paymasterService) for gasless Coinbase Smart
// Wallet transactions on Base Sepolia.
//
// TESTNET: the key is read client-side. That's acceptable on testnet (sponsors
// only test gas). BEFORE MAINNET this MUST move behind a backend proxy + a
// Pimlico sponsorship policy (allowlisted contracts, spend caps) so the key is
// never exposed and gas can't be drained — tracked in the Phase 5 security pass.
const PIMLICO_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY

export const PIMLICO_PAYMASTER_URL: string | undefined = PIMLICO_KEY
  ? `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_KEY}`
  : undefined

/** EIP-5792 capabilities object that routes sponsorship through Pimlico. */
export function paymasterCapabilities():
  | { paymasterService: { url: string } }
  | undefined {
  return PIMLICO_PAYMASTER_URL
    ? { paymasterService: { url: PIMLICO_PAYMASTER_URL } }
    : undefined
}
