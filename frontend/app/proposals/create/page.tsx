"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { communityApi, governanceApi } from "@/lib/api"
import { ArrowLeft, Loader2, Plus } from "lucide-react"
import Link from "next/link"

export default function CreateProposalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()

  const [form, setForm] = useState({
    groupId: "",
    title: "",
    description: "",
    fundingAmountKes: "",
    isEmergency: false,
  })

  const { data: memberships = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => communityApi.getMyGroups(),
    enabled: isAuthenticated,
  })

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      governanceApi.createProposal({
        groupId: form.groupId,
        title: form.title.trim(),
        description: form.description.trim(),
        ...(form.fundingAmountKes ? { fundingAmountKes: Number(form.fundingAmountKes) } : {}),
        ...(form.isEmergency ? { isEmergency: true } : {}),
      }),
    onSuccess: () => {
      toast({ title: "Proposal created", description: "It is now in draft — a group leader can start voting." })
      router.push("/proposals")
    },
    onError: (err: any) => {
      toast({ title: "Failed to create proposal", description: err?.message ?? "Please try again.", variant: "destructive" })
    },
  })

  const canSubmit = form.groupId && form.title.trim().length >= 5 && form.description.trim().length >= 10

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-warm-gray text-sm">
        Sign in to create a proposal.
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Back */}
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-sm text-warm-gray hover:text-amber transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to proposals
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0A1F14]" style={{ fontFamily: "var(--font-cormorant, serif)" }}>
          Create a Proposal
        </h1>
        <p className="mt-1 text-sm text-warm-gray">
          Submit a proposal to your group. A group leader can then open it for voting.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-5">
          {/* Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">Group *</label>
            {loadingGroups ? (
              <div className="h-10 rounded-lg bg-cream animate-pulse" />
            ) : memberships.length === 0 ? (
              <p className="text-sm text-warm-gray">You are not a member of any group yet.</p>
            ) : (
              <select
                value={form.groupId}
                onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
                className="w-full h-10 rounded-lg border border-cream bg-white px-3 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/40"
              >
                <option value="">Select a group…</option>
                {memberships.map((m) => (
                  <option key={m.groupId} value={m.groupId}>
                    {m.groupName}
                    {m.role === "LEADER" ? " (you are leader)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Drill a borehole on Kirinyaga Road"
              maxLength={200}
              className="w-full h-10 rounded-lg border border-cream bg-white px-3 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
            <p className="text-xs text-warm-gray text-right">{form.title.length}/200</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the proposal, its purpose, and expected impact…"
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-cream bg-white px-3 py-2.5 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
            />
            <p className="text-xs text-warm-gray text-right">{form.description.length}/2000</p>
          </div>

          {/* Funding amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">
              Funding Amount (KES) <span className="font-normal text-warm-gray">optional</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-warm-gray">KES</span>
              <input
                type="number"
                value={form.fundingAmountKes}
                onChange={(e) => setForm((f) => ({ ...f, fundingAmountKes: e.target.value }))}
                placeholder="0"
                min={0}
                className="w-full h-10 rounded-lg border border-cream bg-white pl-12 pr-3 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/40"
              />
            </div>
          </div>

          {/* Emergency */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isEmergency}
              onChange={(e) => setForm((f) => ({ ...f, isEmergency: e.target.checked }))}
              className="h-4 w-4 rounded border-cream accent-amber"
            />
            <div>
              <p className="text-sm font-semibold text-[#0A1F14]">Mark as emergency</p>
              <p className="text-xs text-warm-gray">Emergency proposals skip the standard review window.</p>
            </div>
          </label>

          {/* Submit */}
          <button
            onClick={() => submit()}
            disabled={!canSubmit || isPending}
            className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isPending ? "Creating…" : "Create Proposal"}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
