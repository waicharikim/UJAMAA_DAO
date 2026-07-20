"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Globe, MapPin, Landmark, Home, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { communityApi, type GroupMembershipDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

// ── Level ordering + display config ──────────────────────────

const LEVEL_ORDER: Record<string, number> = {
  NATIONAL: 0,
  COUNTY: 1,
  CONSTITUENCY: 2,
  WARD: 3,
}

const LEVEL_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; color: string; bg: string }
> = {
  NATIONAL:     { label: "National",     Icon: Globe,     color: "#1D4731", bg: "rgba(29,71,49,0.08)" },
  COUNTY:       { label: "County",       Icon: MapPin,    color: "#B03A1E", bg: "rgba(176,58,30,0.08)" },
  CONSTITUENCY: { label: "Constituency", Icon: Landmark,  color: "#7A4F1E", bg: "rgba(122,79,30,0.08)" },
  WARD:         { label: "Ward",         Icon: Home,      color: "#1A6B3C", bg: "rgba(26,107,60,0.08)" },
}

// ── Sub-components ────────────────────────────────────────────

function formatGroupDisplayName(g: GroupMembershipDto): string {
  const level = g.systemType ?? "WARD"
  if (level === "NATIONAL") return g.groupName
  if (level === "WARD" && g.ward?.name) return `${g.ward.name} Ward Community`
  if (level === "CONSTITUENCY" && g.constituency?.name) return `${g.constituency.name} Constituency Community`
  if (level === "COUNTY" && g.county?.name) return `${g.county.name} County Community`
  return g.groupName
}

function GroupRow({ g }: { g: GroupMembershipDto }) {
  const level = g.systemType ?? "WARD"
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.WARD
  const { Icon, color, bg, label } = cfg
  const displayName = formatGroupDisplayName(g)

  return (
    <Link href={`/groups/${g.groupId}`} className="block">
      <div className="flex items-center gap-3 py-2.5 border-b border-black/[0.04] last:border-0 rounded-lg px-1 hover:bg-black/[0.03] transition-colors cursor-pointer">
        {/* Level icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: bg }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>

        {/* Name + level */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-chai truncate">{displayName}</p>
          <p className="text-[11px]" style={{ color: "#7A6E60" }}>{label}</p>
        </div>

        {/* Member count */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Users className="h-3 w-3" style={{ color: "#7A6E60" }} />
          <span className="text-[11px] font-medium" style={{ color: "#7A6E60" }}>
            {g.memberCount.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/[0.04] last:border-0">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────

export function SystemGroupsCard() {
  const { user } = useAuth()

  const { data: memberships, isLoading } = useQuery({
    queryKey: ["system-groups", user?.id],
    queryFn: () => communityApi.getMyGroups(),
    enabled: !!user,
    staleTime: 60_000,
  })

  const systemGroups = (memberships ?? [])
    .filter((g) => g.isSystem)
    .sort((a, b) => (LEVEL_ORDER[a.systemType ?? "WARD"] ?? 3) - (LEVEL_ORDER[b.systemType ?? "WARD"] ?? 3))

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-chai flex items-center gap-2">
          <Globe className="h-4 w-4" style={{ color: "#1D4731" }} />
          My Communities
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-1">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : systemGroups.length === 0 ? (
          <p className="text-xs py-3" style={{ color: "#7A6E60" }}>
            Your community groups will appear here after your account is verified.
          </p>
        ) : (
          systemGroups.map((g) => <GroupRow key={g.groupId} g={g} />)
        )}
      </CardContent>
    </Card>
  )
}
