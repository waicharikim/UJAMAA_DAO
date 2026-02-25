"use client"

import { Landmark, Lock, BarChart3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function TreasuryPage() {
  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-display font-bold text-3xl text-[#0E0B08]">Ward Treasury</h2>
        <p className="text-sm text-[#0E0B08]/50 mt-1">On-chain fund management for your ward.</p>
      </div>

      <Card
        className="border-0 shadow-card text-center py-16 px-8"
        style={{ background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)" }}
      >
        <CardContent>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(30,61,47,0.1)" }}
          >
            <Landmark className="h-7 w-7" style={{ color: "#1E3D2F" }} />
          </div>

          <h3 className="font-display font-bold text-2xl text-[#0E0B08] mb-3">Treasury Coming Soon</h3>

          <p className="text-sm text-[#0E0B08]/60 mb-6 max-w-sm mx-auto leading-relaxed">
            The Ward Treasury manages collective funds on-chain, with M-Pesa dues contributing to project budgets
            tracked transparently on Base.
          </p>

          <div className="flex flex-col gap-3 text-left max-w-sm mx-auto">
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(30,61,47,0.06)" }}>
              <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#1E3D2F" }} />
              <div>
                <p className="text-xs font-semibold text-[#0E0B08]">M-Pesa to Platform Accounts</p>
                <p className="text-xs text-[#0E0B08]/55 mt-0.5">
                  All real money flows through platform-controlled M-Pesa accounts. Never P2P.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(201,146,42,0.06)" }}>
              <BarChart3 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#C9922A" }} />
              <div>
                <p className="text-xs font-semibold text-[#0E0B08]">On-Chain Transparency</p>
                <p className="text-xs text-[#0E0B08]/55 mt-0.5">
                  Every allocation and disbursement recorded on Base — verifiable by any ward member.
                </p>
              </div>
            </div>
          </div>

          <Badge
            className="mt-6 text-xs font-semibold px-3 py-1"
            style={{ background: "rgba(30,61,47,0.1)", color: "#1E3D2F", border: "1px solid rgba(30,61,47,0.2)" }}
          >
            Available when treasury module launches
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
