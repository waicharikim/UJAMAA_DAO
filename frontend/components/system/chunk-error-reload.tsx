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

// A plain window.location.reload() does NOT bypass a controlling service
// worker — it re-serves the same stale HTML shell from the SW cache, which
// references the same now-missing chunks, so the page goes blank again. The
// one-time guard then blocks any further attempt and the device is wedged on a
// permanent white screen. To actually recover we must tear down the SW + all
// caches first, so the reload is forced to pull a fresh shell + chunks from the
// network.
async function purgeServiceWorkerAndCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* ignore — fall through to cache purge + reload */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
  } catch {
    // sessionStorage unavailable — fall through and reload anyway.
  }
  // Purge the SW + caches first, then hard-navigate with a cache-busting param
  // so even an HTTP-cached navigation is re-fetched from the origin.
  void purgeServiceWorkerAndCaches().finally(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("_fresh", Date.now().toString())
    window.location.replace(url.toString())
  })
}

export function ChunkErrorReload() {
  useEffect(() => {
    // Signal the inline boot watchdog (early-error-boot.tsx) that React has
    // mounted, so it never shows the "could not load" fallback on a page that
    // actually rendered.
    ;(window as unknown as { __UJAMAA_APP_MOUNTED?: boolean }).__UJAMAA_APP_MOUNTED = true

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
