// Force dynamic rendering — prevents Turbopack from statically pre-rendering
// this page during `next build`, which avoids a module-init ordering issue
// where React is null when Providers is evaluated for special Next.js routes.
export const dynamic = "force-dynamic"

import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F7F2E8" }}>
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-6xl font-bold" style={{ color: "#142F22" }}>404</h1>
        <h2 className="text-xl font-semibold" style={{ color: "#142F22" }}>Page not found</h2>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#D4911E",
            color: "#142F22",
            borderRadius: "50px",
            padding: "10px 28px",
            fontWeight: 700,
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
