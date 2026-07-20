// Gasless sponsorship for Coinbase Smart Wallet votes (EIP-5792 paymasterService).
//
// The paymaster API key is NO LONGER in the browser. Sponsorship is routed
// through our backend proxy (`/governance/paymaster`), which enforces a strict
// allowlist (only `castVote` to the GovernanceVoting contract) and forwards to
// Pimlico with a server-held key + sponsorship policy. This is mainnet-safe:
// the key can't leak and the sponsorship balance can't be drained on arbitrary
// transactions. See backend `modules/governance/services/paymaster.service.ts`.
const API_BASE = process.env.NEXT_PUBLIC_API_URL // e.g. http://localhost:4000/api/v1

// Coinbase Smart Wallet REQUIRES the paymasterService URL to be HTTPS. In prod
// the derived URL is already https (api.ujamaadao.org). On local dev the API is
// http://localhost, which Coinbase rejects — set NEXT_PUBLIC_PAYMASTER_URL to an
// https proxy (e.g. the deployed one) to test gasless votes from dev.
const PAYMASTER_OVERRIDE = process.env.NEXT_PUBLIC_PAYMASTER_URL

export const PAYMASTER_PROXY_URL: string | undefined =
  PAYMASTER_OVERRIDE ||
  (API_BASE ? `${API_BASE.replace(/\/$/, "")}/governance/paymaster` : undefined)

/** EIP-5792 capabilities object that routes sponsorship through our proxy. */
export function paymasterCapabilities():
  | { paymasterService: { url: string } }
  | undefined {
  return PAYMASTER_PROXY_URL
    ? { paymasterService: { url: PAYMASTER_PROXY_URL } }
    : undefined
}
