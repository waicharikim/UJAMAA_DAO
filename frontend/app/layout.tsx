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
}

export const metadata: Metadata = {
  title: "UjamaaDAO — Ward Sovereignty Platform",
  description: "Cooperative governance, community projects, and economic sovereignty for Kenyan wards.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UjamaaDAO",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="font-sans bg-background text-foreground antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
