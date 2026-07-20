import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

// Beacon sink for the inline early-error boot script (see
// components/system/early-error-boot.tsx). Old / in-app-browser engines that
// can't parse the main JS bundle crash BEFORE the Sentry browser SDK loads, so
// they can never self-report — the app just white-screens and Sentry stays
// blind. The boot script catches that failure pre-bundle and POSTs here, where
// the Sentry *server* SDK (initialised via instrumentation.ts) is alive and can
// forward it as a real production event, tagged so we can find these devices.
//
// Same-origin on ujamaadao.org → served by Next (the backend lives on the
// api.ujamaadao.org host), so no CORS and no collision with the backend API.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX = 2000

function clamp(v: unknown, n = MAX): string {
  if (v == null) return ""
  return String(v).slice(0, n)
}

export async function POST(req: Request) {
  try {
    const data = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const ua = clamp(data.ua || req.headers.get("user-agent") || "unknown", 500)
    const kind = clamp(data.kind || "early-error", 40)
    const message = clamp(data.message || "unknown", 500)

    Sentry.captureMessage(`[client-boot] ${kind}: ${message}`, {
      level: "error",
      tags: { clientBoot: true, kind },
      extra: {
        userAgent: ua,
        source: clamp(data.source, 500),
        lineno: typeof data.lineno === "number" ? data.lineno : 0,
        colno: typeof data.colno === "number" ? data.colno : 0,
        stack: clamp(data.stack),
        href: clamp(data.href, 500),
      },
    })
  } catch {
    // Telemetry must never throw or affect the client.
  }
  // 204 + no body — the browser used sendBeacon and isn't reading a response.
  return new NextResponse(null, { status: 204 })
}
