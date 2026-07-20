"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  MapPin, Users, ChevronRight, Globe, Home, Building2, Landmark,
  ShieldCheck, Loader2, ChevronDown, ChevronUp,
} from "lucide-react"
import { communityApi, userApi, type GroupDiscoveryDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"

// ── Location select ────────────────────────────────────────────
function LocationSelect({
  label, value, onChange, options, disabled, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { id: string; name: string }[]
  disabled?: boolean
  placeholder: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg px-3 py-2 text-sm font-medium appearance-none outline-none transition-all disabled:opacity-40"
        style={{
          background: disabled ? "rgba(0,0,0,0.03)" : "#fff",
          border: "1px solid rgba(0,0,0,0.10)",
          color: value ? "#1A120B" : "#7A6E60",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  )
}

// ── Group card ─────────────────────────────────────────────────
function DiscoverCard({
  group, onJoin, isJoining,
}: {
  group: GroupDiscoveryDto
  onJoin: (id: string) => void
  isJoining: boolean
}) {
  const Icon = group.isSystemGroup
    ? group.locationScope === "WARD" ? Home
      : group.locationScope === "CONSTITUENCY" ? Building2
        : Landmark
    : Users

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{
        background: group.isSystemGroup ? "rgba(29,71,49,0.04)" : "#fff",
        border: `1px solid ${group.isSystemGroup ? "rgba(29,71,49,0.12)" : "rgba(0,0,0,0.06)"}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: group.isSystemGroup ? "rgba(29,71,49,0.12)" : "rgba(201,146,42,0.10)",
          color: group.isSystemGroup ? "#1D4731" : "#C9922A",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "#1A120B" }}>{group.name}</p>
        <p className="text-[11px]" style={{ color: "#7A6E60" }}>
          {group.isSystemGroup ? `${(group.locationScope ?? "Ward").toLowerCase()} group` : (group.voluntaryType ?? "Voluntary").replace(/_/g, " ")}
          {" · "}{group.memberCount} members
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {group.isSystemGroup ? (
          <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.04)", color: "#7A6E60" }}>
            <ShieldCheck className="h-3 w-3" />
            Auto-join
          </div>
        ) : (
          <button
            onClick={() => onJoin(group.id)}
            disabled={isJoining}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-1"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            {isJoining ? <Loader2 className="h-3 w-3 animate-spin" /> : "Join"}
          </button>
        )}
        <Link href={`/groups/${group.id}`}
          className="p-1.5 rounded-full" style={{ color: "#7A6E60", background: "rgba(0,0,0,0.04)" }}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

// ── Main component (embedded in My Groups tab) ─────────────────
export function FindCommunity() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const [expanded, setExpanded]             = useState(false)
  const [countyId, setCountyId]             = useState("")
  const [constituencyId, setConstituencyId] = useState("")
  const [wardId, setWardId]                 = useState("")
  const [joiningId, setJoiningId]           = useState<string | null>(null)

  // Pre-fill from user's location
  useEffect(() => {
    if (user?.primaryCountyId)        setCountyId(user.primaryCountyId)
    if (user?.primaryConstituencyId)  setConstituencyId(user.primaryConstituencyId)
    if (user?.primaryWardId)          setWardId(user.primaryWardId)
  }, [user?.primaryCountyId, user?.primaryConstituencyId, user?.primaryWardId])

  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: () => userApi.getCounties(),
    staleTime: Infinity,
    enabled: expanded,
  })

  const { data: constituencies = [] } = useQuery({
    queryKey: ["constituencies", countyId],
    queryFn: () => userApi.getConstituencies(countyId),
    enabled: expanded && !!countyId,
    staleTime: Infinity,
  })

  const { data: wards = [] } = useQuery({
    queryKey: ["wards", constituencyId],
    queryFn: () => userApi.getWards(constituencyId),
    enabled: expanded && !!constituencyId,
    staleTime: Infinity,
  })

  const activeFilter = wardId ? { wardId }
    : constituencyId ? { constituencyId }
    : countyId ? { countyId }
    : null

  const { data: groupData, isLoading: loadingGroups } = useQuery({
    queryKey: ["community-discover", activeFilter],
    queryFn: () => communityApi.getGroups({ ...activeFilter!, limit: 50 }),
    enabled: expanded && !!activeFilter,
    staleTime: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => communityApi.joinGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-discover"] })
      qc.invalidateQueries({ queryKey: ["my-groups-list"] })
      qc.invalidateQueries({ queryKey: ["my-groups-stats"] })
      setJoiningId(null)
    },
    onError: () => setJoiningId(null),
  })

  function handleJoin(id: string) {
    setJoiningId(id)
    joinMutation.mutate(id)
  }

  // Only show groups the user isn't already a member of
  const nonMemberGroups = (groupData?.groups ?? []).filter((g) => !g.isMember)
  const systemGroups    = nonMemberGroups.filter((g) => g.isSystemGroup)
  const voluntaryGroups = nonMemberGroups.filter((g) => !g.isSystemGroup)

  return (
    <div>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between py-3 px-1"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: "#1D4731" }} />
          <span className="text-sm font-semibold" style={{ color: "#1A120B" }}>Discover nearby groups</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4" style={{ color: "#7A6E60" }} />
          : <ChevronDown className="h-4 w-4" style={{ color: "#7A6E60" }} />}
      </button>

      {expanded && (
        <div className="space-y-4 pb-2">
          {/* Location cascade */}
          <div className="grid grid-cols-3 gap-2">
            <LocationSelect label="County" value={countyId}
              onChange={(v) => { setCountyId(v); setConstituencyId(""); setWardId("") }}
              options={counties} placeholder="County" />
            <LocationSelect label="Constituency" value={constituencyId}
              onChange={(v) => { setConstituencyId(v); setWardId("") }}
              options={constituencies} disabled={!countyId} placeholder={countyId ? "Constituency" : "—"} />
            <LocationSelect label="Ward" value={wardId}
              onChange={setWardId}
              options={wards} disabled={!constituencyId} placeholder={constituencyId ? "Ward" : "—"} />
          </div>

          {/* Results */}
          {!activeFilter ? null : loadingGroups ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3 w-24" /></div>
                  <Skeleton className="h-7 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : nonMemberGroups.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "#7A6E60" }}>
              {(groupData?.total ?? 0) === 0
                ? "No groups found in this location yet."
                : "You're already a member of all groups here."}
            </p>
          ) : (
            <div className="space-y-4">
              {systemGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
                    Community groups
                  </p>
                  {systemGroups.map((g) => (
                    <DiscoverCard key={g.id} group={g} onJoin={handleJoin} isJoining={joiningId === g.id} />
                  ))}
                </div>
              )}
              {voluntaryGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
                    Voluntary groups
                  </p>
                  {voluntaryGroups.map((g) => (
                    <DiscoverCard key={g.id} group={g} onJoin={handleJoin} isJoining={joiningId === g.id} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
