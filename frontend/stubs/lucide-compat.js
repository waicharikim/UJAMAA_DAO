// Polyfill shim for lucide-react.
// Our pinned version (0.294.0) is missing icons added in later releases.
// @privy-io/react-auth imports `CloudUpload` (added ~0.355) from its
// DelegatedActionsConsentScreen component.  We don't use delegated actions,
// so a no-op stub is fine.  All real icons are passed through unchanged.
const lucide = require("../node_modules/lucide-react/dist/cjs/lucide-react.js")

// Stub any missing icons with a visually-similar fallback or null component.
const CloudUpload = lucide.CloudUpload || lucide.Cloud || function CloudUpload() { return null }

module.exports = { ...lucide, CloudUpload }
