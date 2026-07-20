"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { communityApi, userApi } from "@/lib/api"
import { Loader2, Users, Home, Building2, Landmark } from "lucide-react"
import Link from "next/link"
import { WardDeclarationScreen } from "@/components/groups/ward-declaration-screen"

const VOLUNTARY_TYPES = [
  { value: "BUSINESS_COLLECTIVE",    label: "Business Collective" },
  { value: "SAVINGS_CREDIT",         label: "Savings & Credit" },
  { value: "AGRICULTURE_COOPERATIVE",label: "Agriculture Cooperative" },
  { value: "TRADE_ASSOCIATION",      label: "Trade Association" },
  { value: "PROJECT_EXECUTION",      label: "Project Execution" },
  { value: "INFRASTRUCTURE_COMMITTEE",label: "Infrastructure Committee" },
  { value: "NON_PROFIT",             label: "Non-Profit" },
  { value: "COMMUNITY_WELFARE",      label: "Community Welfare" },
  { value: "PROFESSIONAL_NETWORK",   label: "Professional Network" },
  { value: "EMERGENCY_RESPONSE",     label: "Emergency Response" },
  { value: "YOUTH_ORGANIZATION",     label: "Youth Organization" },
  { value: "WOMEN_EMPOWERMENT",      label: "Women Empowerment" },
  { value: "HEALTH_INITIATIVE",      label: "Health Initiative" },
  { value: "EDUCATION_INITIATIVE",   label: "Education Initiative" },
  { value: "ENVIRONMENTAL_GROUP",    label: "Environmental Group" },
  { value: "TECHNOLOGY_HUB",         label: "Technology Hub" },
  { value: "ARTS_CULTURE",           label: "Arts & Culture" },
  { value: "SPORTS_RECREATION",      label: "Sports & Recreation" },
  { value: "ADVOCACY_GROUP",         label: "Advocacy Group" },
  { value: "NEIGHBORHOOD_ASSOCIATION",label: "Neighbourhood Association" },
]

export default function CreateGroupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated, user } = useAuth()

  type ScopeLevel = "ward" | "constituency" | "county"

  const [form, setForm] = useState({
    name: "",
    voluntaryType: "",
    description: "",
  })
  const [scope, setScope] = useState<ScopeLevel>("ward")
  const [countyId, setCountyId]           = useState(user?.primaryCountyId ?? "")
  const [constituencyId, setConstituencyId] = useState(user?.primaryConstituencyId ?? "")
  const [wardId, setWardId]               = useState(user?.primaryWardId ?? "")

  const { data: counties = [] }       = useQuery({ queryKey: ["counties"],             queryFn: () => userApi.getCounties(),                     staleTime: Infinity })
  const { data: constituencies = [] } = useQuery({ queryKey: ["constituencies", countyId], queryFn: () => userApi.getConstituencies(countyId), enabled: !!countyId, staleTime: Infinity })
  const { data: wards = [] }          = useQuery({ queryKey: ["wards", constituencyId],   queryFn: () => userApi.getWards(constituencyId),        enabled: !!constituencyId && scope === "ward", staleTime: Infinity })

  const [createdGroup, setCreatedGroup] = useState<{ id: string; name: string } | null>(null)

  const locationPayload = {
    ...(scope === "ward"         && wardId         ? { wardId }         : {}),
    ...(scope === "constituency" && constituencyId ? { constituencyId } : {}),
    ...(scope === "county"       && countyId       ? { countyId }       : {}),
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      communityApi.createVoluntaryGroup({
        name: form.name.trim(),
        voluntaryType: form.voluntaryType,
        description: form.description.trim() || undefined,
        ...locationPayload,
      }),
    onSuccess: (data) => {
      toast({ title: "Group created", description: "You are now the leader." })
      setCreatedGroup({ id: data.id, name: form.name.trim() })
    },
    onError: (err: any) => {
      toast({
        title: "Failed to create group",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      })
    },
  })

  const locationSelected =
    (scope === "ward" && !!wardId) ||
    (scope === "constituency" && !!constituencyId) ||
    (scope === "county" && !!countyId)

  const canSubmit = form.name.trim().length >= 3 && form.voluntaryType !== "" && locationSelected

  if (createdGroup) {
    return (
      <WardDeclarationScreen
        groupId={createdGroup.id}
        wardName={createdGroup.name}
        onContinue={() => router.push(`/groups/${createdGroup.id}`)}
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-warm-gray">
        Sign in to create a group.
      </div>
    )
  }

  const canCreate = user?.verificationLevel === "COMMUNITY_VERIFIED" || user?.verificationLevel === "FULL_VERIFIED"
  if (!canCreate) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
        <p className="text-warm-gray text-sm">
          You need <strong>Community Verification</strong> to create a voluntary group.
        </p>
        <Link href="/profile" className="text-amber text-sm underline underline-offset-2">
          Complete verification →
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-[#0A1F14]"
          style={{ fontFamily: "var(--font-cormorant, serif)" }}
        >
          Create a Group
        </h1>
        <p className="mt-1 text-sm text-warm-gray">
          Creating a voluntary group costs 100 Participation Rights.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">Group Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Kirinyaga Savings Circle"
              minLength={3}
              maxLength={100}
              className="w-full h-10 rounded-lg border border-cream bg-white px-3 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
            <p className="text-xs text-warm-gray text-right">{form.name.length}/100</p>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">Group Type *</label>
            <select
              value={form.voluntaryType}
              onChange={(e) => setForm((f) => ({ ...f, voluntaryType: e.target.value }))}
              className="w-full h-10 rounded-lg border border-cream bg-white px-3 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="">Select a type…</option>
              {VOLUNTARY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#0A1F14]">
              Description <span className="font-normal text-warm-gray">optional</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the group's purpose and goals…"
              rows={4}
              maxLength={500}
              className="w-full rounded-lg border border-cream bg-white px-3 py-2.5 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
            />
            <p className="text-xs text-warm-gray text-right">{form.description.length}/500</p>
          </div>

          {/* Scope */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#0A1F14]">Group Scope *</label>
            <p className="text-xs text-warm-gray -mt-1">
              Where does this group operate? This determines who can discover and join it.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "ward",         label: "Ward",         sub: "Most local",   icon: Home      },
                { value: "constituency", label: "Constituency", sub: "Sub-county",   icon: Building2 },
                { value: "county",       label: "County",       sub: "Widest reach", icon: Landmark  },
              ] as const).map(({ value, label, sub, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all"
                  style={scope === value
                    ? { background: "rgba(29,71,49,0.08)", border: "1.5px solid #1D4731", color: "#1D4731" }
                    : { border: "1px solid rgba(0,0,0,0.10)", color: "#7A6E60" }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[12px] font-semibold leading-tight">{label}</span>
                  <span className="text-[10px] opacity-60">{sub}</span>
                </button>
              ))}
            </div>

            {/* County selector — always shown */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-[#7A6E60]">County</label>
              <select
                value={countyId}
                onChange={(e) => { setCountyId(e.target.value); setConstituencyId(""); setWardId("") }}
                className="w-full rounded-lg px-3 py-2 text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-amber/40"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                <option value="">Select county…</option>
                {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Constituency selector — shown for constituency + ward scope */}
            {scope !== "county" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[#7A6E60]">Constituency</label>
                <select
                  value={constituencyId}
                  onChange={(e) => { setConstituencyId(e.target.value); setWardId("") }}
                  disabled={!countyId}
                  className="w-full rounded-lg px-3 py-2 text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-amber/40 disabled:opacity-40"
                  style={{ borderColor: "rgba(0,0,0,0.10)" }}
                >
                  <option value="">{countyId ? "Select constituency…" : "Select county first"}</option>
                  {constituencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Ward selector — shown only for ward scope */}
            {scope === "ward" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[#7A6E60]">Ward</label>
                <select
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  disabled={!constituencyId}
                  className="w-full rounded-lg px-3 py-2 text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-amber/40 disabled:opacity-40"
                  style={{ borderColor: "rgba(0,0,0,0.10)" }}
                >
                  <option value="">{constituencyId ? "Select ward…" : "Select constituency first"}</option>
                  {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={() => submit()}
            disabled={!canSubmit || isPending}
            className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            {isPending ? "Creating…" : "Create Group"}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
