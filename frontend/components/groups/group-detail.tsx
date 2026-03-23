"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, communityApi, type GroupDetailDto, type GroupMemberDto } from "@/lib/api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Globe, MapPin, Landmark, Home, Users, CalendarDays, ChevronRight, Settings, Loader2, ScrollText } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { WardDeclarationScreen } from "@/components/groups/ward-declaration-screen"

// ── Level display config ──────────────────────────────────────

const LEVEL_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  NATIONAL:     { label: "National",     Icon: Globe,     color: "#1D4731", bg: "rgba(29,71,49,0.10)" },
  COUNTY:       { label: "County",       Icon: MapPin,    color: "#B03A1E", bg: "rgba(176,58,30,0.10)" },
  CONSTITUENCY: { label: "Constituency", Icon: Landmark,  color: "#7A4F1E", bg: "rgba(122,79,30,0.10)" },
  WARD:         { label: "Ward",         Icon: Home,      color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
}

// ── Location breadcrumb: County → Constituency → Ward ────────

function LocationBreadcrumb({ group }: { group: GroupDetailDto }) {
  const parts = [
    group.county?.name,
    group.constituency?.name,
    group.ward?.name,
  ].filter(Boolean)

  if (parts.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" style={{ color: "#7A6E60" }} />}
          <span className="text-xs font-medium" style={{ color: "#7A6E60" }}>{part}</span>
        </span>
      ))}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────

function GroupDetailSkeleton() {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}

// ── Leader admin panel ────────────────────────────────────

const GROUP_ROLES = ["MEMBER", "LEADER", "TREASURER", "SECRETARY", "AUDITOR", "FACILITATOR", "MENTOR", "MODERATOR"] as const

function LeaderAdminPanel({ group }: { group: GroupDetailDto }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const groupId = group.groupId
  const [tab, setTab] = useState<"settings" | "members">("settings")
  const [nameVal, setNameVal] = useState(group.groupName)
  const [descVal, setDescVal] = useState(group.description ?? "")
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({})

  const { data: members = [], isLoading: loadingMembers } = useQuery<GroupMemberDto[]>({
    queryKey: ["group-members-admin", groupId],
    queryFn: () => communityApi.getGroupMembers(groupId, 100, 0),
    enabled: tab === "members",
  })

  const settingsMutation = useMutation({
    mutationFn: () => communityApi.updateGroupSettings(groupId, {
      name: nameVal.trim() || undefined,
      description: descVal.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      toast({ title: "Group settings updated" })
    },
    onError: (err: any) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      communityApi.changeMemberRole(groupId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members-admin", groupId] })
      toast({ title: "Role updated" })
    },
    onError: (err: any) => toast({ title: "Role change failed", description: err?.message, variant: "destructive" }),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => communityApi.removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members-admin", groupId] })
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      toast({ title: "Member removed" })
    },
    onError: (err: any) => toast({ title: "Remove failed", description: err?.message, variant: "destructive" }),
  })

  return (
    <Card className="border-0 shadow-card overflow-hidden">
      <CardHeader className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4" style={{ color: "#C9922A" }} />
          <h2 className="text-sm font-bold text-[#0E0B08]">Leader Admin</h2>
        </div>
        {/* Tab strip */}
        <div className="flex gap-1 border-b border-black/[0.06]">
          {(["settings", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-semibold capitalize transition-colors"
              style={tab === t
                ? { color: "#1D4731", borderBottom: "2px solid #1D4731" }
                : { color: "#7A6E60" }}
            >
              {t}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-6 py-5">
        {tab === "settings" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E0B08]">Group Name</label>
              <input
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                minLength={3}
                maxLength={100}
                className="w-full h-9 rounded-lg border border-black/10 bg-white px-3 text-sm text-[#0E0B08] focus:outline-none focus:ring-2 focus:ring-amber/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E0B08]">Description</label>
              <textarea
                value={descVal}
                onChange={(e) => setDescVal(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#0E0B08] focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
              />
            </div>
            <button
              onClick={() => settingsMutation.mutate()}
              disabled={settingsMutation.isPending || nameVal.trim().length < 3}
              className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "#1D4731", color: "#fff" }}
            >
              {settingsMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {settingsMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}

        {tab === "members" && (
          <div className="space-y-3">
            {loadingMembers && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            )}
            {!loadingMembers && members.map((m) => {
              const currentRole = pendingRoles[m.userId] ?? m.role
              const isSelf = group.userRole === "LEADER" && m.role === "LEADER" && members.filter(x => x.role === "LEADER").length === 1
              return (
                <div key={m.userId} className="flex items-center gap-3 py-2 border-b border-black/[0.05] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0E0B08] truncate">{m.userName}</p>
                    <p className="text-xs text-[#7A6E60] capitalize">{m.role.toLowerCase()}</p>
                  </div>
                  <select
                    value={currentRole}
                    onChange={(e) => setPendingRoles((r) => ({ ...r, [m.userId]: e.target.value }))}
                    className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs text-[#0E0B08] focus:outline-none"
                  >
                    {GROUP_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
                  </select>
                  <button
                    onClick={() => roleMutation.mutate({ userId: m.userId, role: currentRole })}
                    disabled={roleMutation.isPending || currentRole === m.role}
                    className="px-2 py-1 rounded-lg text-xs font-semibold border border-black/10 text-[#1D4731] hover:bg-[#1D4731]/5 disabled:opacity-40 transition-colors"
                  >
                    Apply
                  </button>
                  {!isSelf && (
                    <button
                      onClick={() => removeMutation.mutate(m.userId)}
                      disabled={removeMutation.isPending}
                      className="px-2 py-1 rounded-lg text-xs font-semibold border border-black/10 text-[#B03A1E] hover:bg-[#B03A1E]/5 disabled:opacity-40 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
            {!loadingMembers && members.length === 0 && (
              <p className="text-xs text-[#7A6E60]">No members yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────

interface GroupDetailProps {
  groupId: string
}

export function GroupDetail({ groupId }: GroupDetailProps) {
  const queryClient = useQueryClient()
  const [showDeclaration, setShowDeclaration] = useState(false)

  const { data: group, isLoading, error } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiClient.getGroup(groupId),
  })

  const joinMutation = useMutation({
    mutationFn: () => communityApi.joinGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      queryClient.invalidateQueries({ queryKey: ["system-groups"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => communityApi.leaveGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      queryClient.invalidateQueries({ queryKey: ["system-groups"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  if (isLoading) return <GroupDetailSkeleton />

  if (error || !group) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="p-8 text-center">
          <p className="text-sm font-medium" style={{ color: "#B03A1E" }}>
            Failed to load group details.
          </p>
        </CardContent>
      </Card>
    )
  }

  const levelKey = (group.locationScope ?? group.systemType ?? "WARD").toUpperCase()
  const levelCfg = LEVEL_CONFIG[levelKey] ?? LEVEL_CONFIG.WARD
  const { Icon: LevelIcon, color: levelColor, bg: levelBg, label: levelLabel } = levelCfg

  const isMember = !!group.userRole
  const isSystemGroup = group.isSystem

  return (
    <div className="space-y-4">
    <Card className="border-0 shadow-card overflow-hidden">
      <CardHeader className="pb-0 pt-6 px-6">
        <div className="flex items-start justify-between gap-4">
          {/* Icon + title */}
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: levelBg }}
            >
              <LevelIcon className="h-7 w-7" style={{ color: levelColor }} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-xl text-[#0E0B08] leading-tight">
                {group.groupName}
              </h1>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  className="text-[10px] font-semibold px-2 py-0 border-0"
                  style={{ background: levelBg, color: levelColor }}
                >
                  {levelLabel}
                </Badge>
                {isSystemGroup ? (
                  <Badge
                    className="text-[10px] font-semibold px-2 py-0 border-0"
                    style={{ background: "rgba(29,71,49,0.08)", color: "#1D4731" }}
                  >
                    Official
                  </Badge>
                ) : (
                  group.voluntaryType && (
                    <Badge
                      className="text-[10px] font-semibold px-2 py-0 border-0"
                      style={{ background: "rgba(201,146,42,0.10)", color: "#7A4F1E" }}
                    >
                      {group.voluntaryType.replace(/_/g, " ")}
                    </Badge>
                  )
                )}
              </div>

              <div className="mt-1.5">
                <LocationBreadcrumb group={group} />
              </div>
            </div>
          </div>

          {/* Join / Leave — only for voluntary groups */}
          {!isSystemGroup && (
            isMember ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="flex-shrink-0 text-xs border-[#B03A1E] text-[#B03A1E] hover:bg-[#B03A1E]/5"
              >
                {leaveMutation.isPending ? "Leaving…" : "Leave Group"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="flex-shrink-0 text-xs font-semibold"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {joinMutation.isPending ? "Joining…" : "Join Group"}
              </Button>
            )
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 py-5">
        <div className="border-t border-black/[0.05] pt-5 space-y-5">
          {/* Stats row */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(201,146,42,0.10)" }}
              >
                <Users className="h-3.5 w-3.5" style={{ color: "#C9922A" }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>Members</p>
                <p className="text-sm font-bold text-[#0E0B08]">{group.memberCount.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(29,71,49,0.08)" }}
              >
                <CalendarDays className="h-3.5 w-3.5" style={{ color: "#1D4731" }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>Created</p>
                <p className="text-sm font-bold text-[#0E0B08]">{formatDate(group.createdAt)}</p>
              </div>
            </div>

            {isMember && (
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: levelBg }}
                >
                  <LevelIcon className="h-3.5 w-3.5" style={{ color: levelColor }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>Your Role</p>
                  <p className="text-sm font-bold text-[#0E0B08] capitalize">{group.userRole?.toLowerCase()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {group.description && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A6E60" }}>About</h3>
              <p className="text-sm text-[#0E0B08]/70 leading-relaxed">{group.description}</p>
            </div>
          )}

          {/* Joined date */}
          {isMember && group.userJoinedAt && (
            <p className="text-xs" style={{ color: "#7A6E60" }}>
              You joined {formatDate(group.userJoinedAt)}
            </p>
          )}

          {/* Founding declaration link — voluntary groups only */}
          {!isSystemGroup && (
            <button
              onClick={() => setShowDeclaration(true)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: "#C9922A" }}
            >
              <ScrollText className="h-3.5 w-3.5" />
              View founding declaration
            </button>
          )}
        </div>
      </CardContent>
    </Card>

    {showDeclaration && (
      <WardDeclarationScreen
        groupId={groupId}
        wardName={group.groupName}
        onContinue={() => setShowDeclaration(false)}
      />
    )}

    {/* Leader admin panel — only visible to group leaders */}
    {group.userRole === "LEADER" && !isSystemGroup && (
      <LeaderAdminPanel group={group} />
    )}
    </div>
  )
}
