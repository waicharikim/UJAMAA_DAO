"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { userApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, ChevronRight, Loader2, Clock, CheckCircle2 } from "lucide-react"

export function ResidenceChangeCard() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [countyId, setCountyId] = useState("")
  const [constituencyId, setConstituencyId] = useState("")
  const [wardId, setWardId] = useState("")
  const [reason, setReason] = useState("")
  const [proofUrl, setProofUrl] = useState("")

  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn:  () => userApi.getCounties(),
    staleTime: Infinity,
  })

  const { data: constituencies = [] } = useQuery({
    queryKey: ["constituencies", countyId],
    queryFn:  () => userApi.getConstituencies(countyId),
    enabled:  !!countyId,
    staleTime: Infinity,
  })

  const { data: wards = [] } = useQuery({
    queryKey: ["wards", constituencyId],
    queryFn:  () => userApi.getWards(constituencyId),
    enabled:  !!constituencyId,
    staleTime: Infinity,
  })

  const { data: pending = [] } = useQuery({
    queryKey: ["residence-change-requests"],
    queryFn:  () => userApi.getResidenceChangeRequests(),
    staleTime: 60_000,
  })

  const mut = useMutation({
    mutationFn: () =>
      userApi.requestResidenceChange({
        newPrimaryWardId: wardId,
        reason:  reason.trim() || undefined,
        proofUrl: proofUrl.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Residence change requested", description: "An admin will review your request." })
      setOpen(false)
      setCountyId(""); setConstituencyId(""); setWardId("")
      setReason(""); setProofUrl("")
    },
    onError: (e: any) => toast({ title: "Request failed", description: e?.message, variant: "destructive" }),
  })

  const hasPending = pending.some((r: any) => r.status === "PENDING")

  return (
    <Card className="rounded-2xl border-0 shadow-sm" style={{ background: "#fff" }}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#0E0B08]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(42,107,124,0.10)" }}
          >
            <MapPin className="h-3.5 w-3.5" style={{ color: "#2A6B7C" }} />
          </div>
          Change of Residence
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {hasPending && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
            style={{ background: "rgba(201,146,42,0.08)", color: "#C9922A" }}
          >
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            You have a pending residence change request under review.
          </div>
        )}

        {!hasPending && !open && (
          <div className="space-y-2">
            <p className="text-xs text-[#0E0B08]/55 leading-relaxed">
              Moving to a new ward? Submit a change request. Costs <strong>50 PR</strong> and has a 6-month cooldown.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#2A6B7C" }}
            >
              Request change <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!hasPending && open && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#0E0B08]/60 uppercase tracking-wider">County</label>
              <select
                value={countyId}
                onChange={(e) => { setCountyId(e.target.value); setConstituencyId(""); setWardId("") }}
                className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6B7C]/30"
              >
                <option value="">Select county…</option>
                {counties.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {countyId && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[#0E0B08]/60 uppercase tracking-wider">Constituency</label>
                <select
                  value={constituencyId}
                  onChange={(e) => { setConstituencyId(e.target.value); setWardId("") }}
                  className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6B7C]/30"
                >
                  <option value="">Select constituency…</option>
                  {constituencies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {constituencyId && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[#0E0B08]/60 uppercase tracking-wider">New Ward</label>
                <select
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6B7C]/30"
                >
                  <option value="">Select ward…</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#0E0B08]/60 uppercase tracking-wider">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you moving?"
                rows={2}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6B7C]/30 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#0E0B08]/60 uppercase tracking-wider">Proof URL (optional)</label>
              <input
                type="url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="Link to utility bill, lease agreement…"
                className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6B7C]/30"
              />
            </div>

            <div
              className="rounded-xl px-3 py-2.5 text-[11px]"
              style={{ background: "rgba(201,146,42,0.07)", color: "#7A4F1E" }}
            >
              This request deducts <strong>50 PR</strong> from your balance and cannot be reversed. There is a <strong>6-month cooldown</strong> between changes.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(0,0,0,0.05)", color: "#0E0B08" }}
              >
                Cancel
              </button>
              <button
                onClick={() => mut.mutate()}
                disabled={!wardId || mut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#2A6B7C", color: "#fff" }}
              >
                {mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        )}

        {pending.filter((r: any) => r.status !== "PENDING").slice(0, 3).map((r: any) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]"
            style={{ background: "rgba(0,0,0,0.03)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: r.status === "APPROVED" ? "#1D4731" : "#B03A1E" }} />
            <span className="text-[#0E0B08]/60 flex-1">{r.newWard?.name ?? "Ward change"}</span>
            <span
              className="font-semibold"
              style={{ color: r.status === "APPROVED" ? "#1D4731" : "#B03A1E" }}
            >
              {r.status.toLowerCase()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
