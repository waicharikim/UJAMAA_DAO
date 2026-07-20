"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function Error({
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
    <div
      className="min-h-[60vh] flex items-center justify-center px-4"
      style={{ background: "#F7F2E8" }}
    >
      <div className="text-center space-y-5 max-w-sm w-full">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "rgba(176,58,30,0.10)" }}
        >
          <AlertTriangle className="h-7 w-7" style={{ color: "#B03A1E" }} />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold" style={{ color: "#142F22" }}>
            Something went wrong
          </h2>
          <p className="text-sm" style={{ color: "rgba(14,11,8,0.5)" }}>
            An unexpected error occurred on this page.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono mt-1" style={{ color: "rgba(14,11,8,0.3)" }}>
              ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#1D4731", color: "#fff" }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(14,11,8,0.07)", color: "#0E0B08" }}
          >
            <Home className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
