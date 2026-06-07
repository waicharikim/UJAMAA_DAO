"use client"

import { useEffect } from "react"

// Self-heal stale-deploy chunk failures.
//
// When a new version is deployed, an installed PWA (or a long-open tab) can hold
// an HTML shell that references JS chunks whose hashes changed. Requesting a
// now-missing chunk throws a ChunkLoadError / "Loading chunk … failed" /
// "error loading dynamically imported module" — and because it happens outside
// React render, no error boundary catches it; the app just goes blank.
//
// This listener detects that specific failure and does a ONE-TIME hard reload
// (guarded via sessionStorage so we never loop) to pull the fresh shell + chunks.
const RELOAD_GUARD_KEY = "ujamaa_chunk_reload"

function isChunkLoadError(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
  } catch {
    // sessionStorage unavailable — fall through and reload anyway.
  }
  window.location.reload()
}

export function ChunkErrorReload() {
  useEffect(() => {
    // A successful load means we're on fresh chunks — clear the guard so a
    // future stale deploy can reload again.
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY)
    } catch {
      /* ignore */
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.message ?? "")) reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        typeof reason === "string" ? reason : (reason?.message ?? reason?.name ?? "")
      if (isChunkLoadError(String(message))) reloadOnce()
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
