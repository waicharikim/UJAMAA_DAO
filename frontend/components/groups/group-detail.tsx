"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, communityApi, type GroupDetailDto } from "@/lib/api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Globe, MapPin, Landmark, Home, Users, CalendarDays, ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils"

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

// ── Main component ────────────────────────────────────────────

interface GroupDetailProps {
  groupId: string
}

export function GroupDetail({ groupId }: GroupDetailProps) {
  const queryClient = useQueryClient()

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
        </div>
      </CardContent>
    </Card>
  )
}
