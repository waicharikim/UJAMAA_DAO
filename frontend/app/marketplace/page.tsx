"use client"

import { Store, Search, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function MarketplacePage() {
  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-display font-bold text-3xl text-[#0E0B08]">Marketplace</h2>
        <p className="text-sm text-[#0E0B08]/50 mt-1">Discover goods and services offered by ward members.</p>
      </div>

      <Card
        className="border-0 shadow-card text-center py-16 px-8"
        style={{ background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)" }}
      >
        <CardContent>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(201,146,42,0.12)" }}
          >
            <Store className="h-7 w-7" style={{ color: "#C9922A" }} />
          </div>

          <h3 className="font-display font-bold text-2xl text-[#0E0B08] mb-3">Coming Soon</h3>

          <p className="text-sm text-[#0E0B08]/60 mb-6 max-w-sm mx-auto leading-relaxed">
            The Marketplace is a discovery platform for ward members to find skills, goods, and services offered by
            their neighbours.
          </p>

          <div className="flex flex-col gap-3 text-left max-w-sm mx-auto">
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(201,146,42,0.06)" }}>
              <Search className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#C9922A" }} />
              <div>
                <p className="text-xs font-semibold text-[#0E0B08]">Discovery Only</p>
                <p className="text-xs text-[#0E0B08]/55 mt-0.5">
                  Find services and connect directly. No payments processed here.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(30,61,47,0.06)" }}>
              <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#1E3D2F" }} />
              <div>
                <p className="text-xs font-semibold text-[#0E0B08]">Ward Verified Members</p>
                <p className="text-xs text-[#0E0B08]/55 mt-0.5">
                  All listings come from verified ward community members.
                </p>
              </div>
            </div>
          </div>

          <Badge
            className="mt-6 text-xs font-semibold px-3 py-1"
            style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A", border: "1px solid rgba(201,146,42,0.25)" }}
          >
            Available when community module launches
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
