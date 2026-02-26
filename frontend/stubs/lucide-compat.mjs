// ESM compatibility shim for lucide-react.
// Our pinned version (0.294.0) is missing icons added in later releases.
// This shim re-exports every real icon and stubs any icons that Privy (or other
// deps) import but that don't exist yet in our pinned version.
//
// NOTE: "export *" does NOT re-export `default`.  lucide-react's ESM dist uses
// only named exports, so this is fine.
export * from "../node_modules/lucide-react/dist/esm/lucide-react.js"

// CloudUpload — added ~0.355, used by @privy-io/react-auth DelegatedActionsConsentScreen.
// We don't use delegated actions, so a null component is fine.
export function CloudUpload() { return null }
CloudUpload.displayName = "CloudUpload"
