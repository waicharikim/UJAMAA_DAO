"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  MessageSquare, Plus, Loader2, CheckCircle, XCircle,
  Users, ExternalLink, Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { integrationApi, communityApi, type RegisterBarazaGroupDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

const PLATFORM_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  TELEGRAM: { color: "#229ED9", bg: "rgba(34,158,217,0.1)",  label: "Telegram"  },
  WHATSAPP: { color: "#25D366", bg: "rgba(37,211,102,0.1)",  label: "WhatsApp"  },
  DISCORD:  { color: "#5865F2", bg: "rgba(88,101,242,0.1)",  label: "Discord"   },
}

// ── Register form ────────────────────────────────────────────────────────────

function RegisterForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isSuperAdmin = user?.roles?.some((r) => r.name === "system:super_admin") ?? false

  const [form, setForm] = useState<RegisterBarazaGroupDto>({
    groupId: "",
    platform: "TELEGRAM",
    externalId: "",
    name: "",
    inviteLink: "",
  })

  // Super admins see all system groups; ward admins see only groups they lead/admin
  const { data: allGroupsData } = useQuery({
    queryKey: ["community-groups-system"],
    queryFn: () => communityApi.getGroups({ isSystem: true, limit: 200 }),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  })
  const { data: myMemberships } = useQuery({
    queryKey: ["community-my-groups"],
    queryFn: () => communityApi.getMyGroups(),
    enabled: !isSuperAdmin,
    staleTime: 5 * 60_000,
  })

  const wardGroups = isSuperAdmin
    ? (allGroupsData?.groups ?? []).map((g) => ({ groupId: g.id, groupName: g.name }))
    : (myMemberships ?? [])
        .filter((m) => m.role === "LEADER")
        .map((m) => ({ groupId: m.groupId, groupName: m.groupName }))

  const mutation = useMutation({
    mutationFn: () => integrationApi.registerBarazaGroup({
      ...form,
      inviteLink: form.inviteLink || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-baraza-groups"] })
      toast({ title: "Baraza group registered", description: "Invites will be sent to ward members automatically." })
      onDone()
    },
    onError: (err: any) => {
      toast({ title: "Registration failed", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  const set = (k: keyof RegisterBarazaGroupDto, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const valid = form.groupId && form.externalId && form.name && form.platform

  return (
    <div className="space-y-4 border rounded-xl p-5" style={{ background: "rgba(26,18,11,0.02)" }}>
      <p className="text-sm font-semibold text-[#0E0B08]">Register new baraza group</p>

      {/* Ward group selector */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#0E0B08]/70">Ward group</label>
        <select
          value={form.groupId}
          onChange={(e) => set("groupId", e.target.value)}
          className="w-full h-10 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
        >
          <option value="">Select ward group…</option>
          {wardGroups.map((g) => (
            <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
          ))}
        </select>
      </div>

      {/* Platform */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#0E0B08]/70">Platform</label>
        <select
          value={form.platform}
          onChange={(e) => set("platform", e.target.value as any)}
          className="w-full h-10 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
        >
          <option value="TELEGRAM">Telegram</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="DISCORD">Discord</option>
        </select>
      </div>

      {/* External ID */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#0E0B08]/70">
          {form.platform === "TELEGRAM" ? "Telegram chat ID (numeric)" :
           form.platform === "DISCORD" ? "Discord channel ID" : "WhatsApp group ID"}
        </label>
        <input
          type="text"
          value={form.externalId}
          onChange={(e) => set("externalId", e.target.value)}
          placeholder={form.platform === "TELEGRAM" ? "-1001234567890" : "ID…"}
          className="w-full h-10 rounded-lg border border-black/10 bg-white px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
        />
        {form.platform === "TELEGRAM" && (
          <p className="text-[10px] text-[#0E0B08]/40">
            Add @userinfobot to the group and it will report the chat ID.
          </p>
        )}
      </div>

      {/* Display name */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#0E0B08]/70">Display name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Westlands Ward Baraza"
          className="w-full h-10 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
        />
      </div>

      {/* Invite link */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#0E0B08]/70">Invite link (optional)</label>
        <input
          type="url"
          value={form.inviteLink}
          onChange={(e) => set("inviteLink", e.target.value)}
          placeholder="https://t.me/+…"
          className="w-full h-10 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onDone()}
          className="flex-1 h-10 rounded-lg text-sm text-[#0E0B08]/50 hover:bg-black/5"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          className="flex-1 h-10 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "#1E3D2F", color: "#fff" }}
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Register group"}
        </button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function BarazaManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: groups, isLoading } = useQuery({
    queryKey: ["admin-baraza-groups"],
    queryFn: integrationApi.getAllBarazaGroups,
    staleTime: 30_000,
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => integrationApi.deactivateBarazaGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-baraza-groups"] })
      toast({ title: "Group deactivated" })
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message, variant: "destructive" })
    },
  })

  const active   = (groups ?? []).filter((g) => g.isActive)
  const inactive = (groups ?? []).filter((g) => !g.isActive)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#0E0B08]">Baraza Groups</h3>
          <p className="text-xs text-[#0E0B08]/50 mt-0.5">
            Telegram, WhatsApp, and Discord groups linked to ward groups.
            Members type <code className="font-mono bg-black/6 px-1 rounded">/present</code> to earn 15 PR per session.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "#1E3D2F", color: "#fff" }}
        >
          <Plus className="h-4 w-4" />
          Register group
        </button>
      </div>

      {/* Register form */}
      {showForm && <RegisterForm onDone={() => setShowForm(false)} />}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active groups",  value: active.length },
          { label: "Total sessions", value: (groups ?? []).reduce((s, g) => s + (g._count?.attendances ?? 0), 0) },
          { label: "Platforms",      value: new Set((groups ?? []).map((g) => g.platform)).size },
        ].map(({ label, value }) => (
          <Card key={label} className="border-0 shadow-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-[#0E0B08]">{value}</p>
              <p className="text-xs text-[#0E0B08]/50 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active groups */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4" style={{ color: "#2A5240" }} />
            Active groups ({active.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-black/4 animate-pulse" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: "rgba(14,11,8,0.15)" }} />
              <p className="text-sm text-[#0E0B08]/40">No baraza groups registered yet.</p>
              <p className="text-xs text-[#0E0B08]/30 mt-1">Click "Register group" to link a Telegram/WhatsApp/Discord group to a ward.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((g) => {
                const ps = PLATFORM_STYLES[g.platform]
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: "rgba(26,18,11,0.02)", border: "1px solid rgba(26,18,11,0.06)" }}
                  >
                    <span
                      className="flex-shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5"
                      style={{ background: ps.bg, color: ps.color }}
                    >
                      {ps.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0E0B08] truncate">{g.name}</p>
                      <p className="text-[10px] text-[#0E0B08]/40 font-mono">{g.externalId}</p>
                    </div>

                    <span className="flex items-center gap-1 text-xs text-[#0E0B08]/40 flex-shrink-0">
                      <Users className="h-3 w-3" />
                      {g._count?.attendances ?? 0} sessions
                    </span>

                    {g.inviteLink && (
                      <a
                        href={g.inviteLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/6 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#0E0B08]/40" />
                      </a>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Deactivate "${g.name}"?`)) deactivateMutation.mutate(g.id)
                      }}
                      disabled={deactivateMutation.isPending}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#B03A1E]/60" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive groups (collapsed) */}
      {inactive.length > 0 && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-[#0E0B08]/30" />
              Inactive groups ({inactive.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactive.map((g) => {
                const ps = PLATFORM_STYLES[g.platform]
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 opacity-50"
                    style={{ background: "rgba(26,18,11,0.02)", border: "1px solid rgba(26,18,11,0.06)" }}
                  >
                    <span
                      className="flex-shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5"
                      style={{ background: ps.bg, color: ps.color }}
                    >
                      {ps.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0E0B08] truncate">{g.name}</p>
                      <p className="text-[10px] text-[#0E0B08]/40 font-mono">{g.externalId}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
