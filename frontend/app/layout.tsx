// Force dynamic rendering for all pages — avoids a Next.js 16 Turbopack build
// issue where React is null during static pre-rendering of client components.
export const dynamic = "force-dynamic"

import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import "../styles/globals.css"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/toaster"
import { ChunkErrorReload } from "@/components/system/chunk-error-reload"
import { EarlyErrorBoot } from "@/components/system/early-error-boot"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
  adjustFontFallback: true,
})

export const viewport: Viewport = {
  themeColor: "#1D4731",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
}

const SITE_URL = "https://ujamaadao.org"
const OG_TITLE = "UjamaaDAO — Ward Sovereignty Platform"
const OG_DESC  = "Cooperative governance, community projects, and economic sovereignty for Kenyan wards."

export const metadata: Metadata = {
  title: {
    default: OG_TITLE,
    template: "%s | UjamaaDAO",
  },
  description: OG_DESC,
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.json",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: SITE_URL,
    siteName: "UjamaaDAO",
    title: OG_TITLE,
    description: OG_DESC,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
    images: ["/opengraph-image"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UjamaaDAO",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/icon-maskable.svg", color: "#1D4731" },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        {/* First in <head>: catches bundle parse/load failures on old engines
            before the Sentry browser SDK can load, and shows a fallback instead
            of a white screen. */}
        <EarlyErrorBoot />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        <ChunkErrorReload />
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
