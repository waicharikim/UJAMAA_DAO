"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

// Prevent static prerendering — avoids a Turbopack module-init ordering issue
// where React context APIs are null when the SSR bundle is evaluated for
// special Next.js routes like /_global-error.
export const dynamic = "force-dynamic"

// Root-level error boundary — renders WITHOUT the root layout (no Providers).
// Must include its own <html> and <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#F7F2E8", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <h2 style={{ color: "#142F22", fontSize: "1.5rem", marginBottom: "8px" }}>Something went wrong</h2>
          <p style={{ color: "#6B7280", marginBottom: "24px" }}>An unexpected error occurred. Please try again.</p>
          <button
            onClick={reset}
            style={{ background: "#D4911E", color: "#142F22", border: "none", borderRadius: "50px", padding: "12px 32px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
