"use client"

import { useQuery } from "@tanstack/react-query"
import { MessageSquare, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { integrationApi, type BarazaGroupDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

// Platform display config
const PLATFORM_CONFIG: Record<
  BarazaGroupDto["platform"],
  { label: string; bg: string; color: string }
> = {
  TELEGRAM: { label: "Telegram", bg: "rgba(41,182,246,0.12)", color: "#0288D1" },
  WHATSAPP: { label: "WhatsApp", bg: "rgba(37,211,102,0.12)", color: "#128C7E" },
  DISCORD:  { label: "Discord",  bg: "rgba(88,101,242,0.12)",  color: "#5865F2" },
}

function PlatformBadge({ platform }: { platform: BarazaGroupDto["platform"] }) {
  const cfg = PLATFORM_CONFIG[platform]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function BarazaRow({ group }: { group: BarazaGroupDto }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: "rgba(26,18,11,0.06)" }}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <PlatformBadge platform={group.platform} />
        <p className="text-sm font-medium text-[#0E0B08] truncate mt-0.5">{group.name}</p>
      </div>

      {group.isActive && group.inviteLink ? (
        <a
          href={group.inviteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
        >
          Join
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <Badge
          variant="secondary"
          className="flex-shrink-0 text-[10px]"
          style={{ background: "rgba(26,18,11,0.05)", color: "rgba(14,11,8,0.4)" }}
        >
          {group.isActive ? "No link" : "Inactive"}
        </Badge>
      )}
    </div>
  )
}

export function BarazaGroupsCard() {
  const { isAuthenticated } = useAuth()

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["baraza-groups"],
    queryFn: integrationApi.getBarazaGroups,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  if (!isAuthenticated) return null

  return (
    <Card className="border-0 shadow-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" style={{ color: "#C9922A" }} />
          My Barazas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: "rgba(14,11,8,0.15)" }} />
            <p className="text-sm text-[#0E0B08]/50">No baraza groups yet.</p>
            <p className="text-xs text-[#0E0B08]/35 mt-1">
              Your ward coordinator will set these up.
            </p>
          </div>
        ) : (
          <div>
            {groups.map((g) => (
              <BarazaRow key={g.id} group={g} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
