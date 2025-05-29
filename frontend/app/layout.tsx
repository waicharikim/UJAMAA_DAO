import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "../styles/globals.css"
import { Providers } from "@/components/providers"
import { Navigation } from "@/components/layout/navigation"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Web3 Governance Platform",
  description: "Decentralized governance and community management platform",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <Navigation />
            <main className="pt-16">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
