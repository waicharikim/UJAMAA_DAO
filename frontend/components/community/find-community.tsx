"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  MapPin, Users, ChevronRight, Globe, Home, Building2, Landmark,
  ShieldCheck, Loader2,
} from "lucide-react"
import { communityApi, userApi, type GroupDiscoveryDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

// ── Location breadcrumb ────────────────────────────────────────
function LocationBreadcrumb({
  county, constituency, ward,
}: {
  county?: string; constituency?: string; ward?: string
}) {
  if (!county) return null
  return (
    <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: "#7A6E60" }}>
      <Globe className="h-3 w-3 flex-shrink-0" />
      <span>{county}</span>
      {constituency && <><ChevronRight className="h-3 w-3 flex-shrink-0" /><span>{constituency}</span></>}
      {ward && <><ChevronRight className="h-3 w-3 flex-shrink-0" /><span className="font-semibold" style={{ color: "#1D4731" }}>{ward}</span></>}
    </div>
  )
}

// ── Group card ─────────────────────────────────────────────────
function GroupCard({
  group, onJoin, isJoining,
}: {
  group: GroupDiscoveryDto
  onJoin: (id: string) => void
  isJoining: boolean
}) {
  const scopeIcon = group.isSystemGroup
    ? group.locationScope === "WARD"
      ? Home
      : group.locationScope === "CONSTITUENCY"
        ? Building2
        : Landmark
    : Users

  const Icon = scopeIcon

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: group.isSystemGroup ? "rgba(29,71,49,0.04)" : "#fff",
        border: group.isSystemGroup
          ? "1px solid rgba(29,71,49,0.14)"
          : "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: group.isSystemGroup ? "rgba(29,71,49,0.12)" : "rgba(201,146,42,0.10)",
            color: group.isSystemGroup ? "#1D4731" : "#C9922A",
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: "#1A120B" }}>
                {group.name}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "#7A6E60" }}>
                {group.isSystemGroup
                  ? `${(group.locationScope ?? "Ward").toLowerCase()} community group`
                  : (group.voluntaryType ?? "Voluntary group").replace(/_/g, " ")}
              </p>
            </div>
            <span className="text-[11px] flex items-center gap-1 flex-shrink-0" style={{ color: "#7A6E60" }}>
              <Users className="h-3 w-3" />
              {group.memberCount}
            </span>
          </div>
          {group.description && (
            <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "#7A6E60" }}>
              {group.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {group.isMember ? (
          <Link
            href={`/groups/${group.id}`}
            className="flex-1 text-center py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
          >
            {group.myRole ?? "Member"} · View group
          </Link>
        ) : group.isSystemGroup ? (
          <div
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(0,0,0,0.04)", color: "#7A6E60" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Auto-joined on verification
          </div>
        ) : (
          <button
            onClick={() => onJoin(group.id)}
            disabled={isJoining}
            className="flex-1 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: "#D4911E", color: "#0A1F14" }}
          >
            {isJoining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Join"}
          </button>
        )}
        <Link
          href={`/groups/${group.id}`}
          className="p-1.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.04)", color: "#7A6E60" }}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// ── Select component (light) ───────────────────────────────────
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
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl px-3 py-2.5 text-sm font-medium appearance-none outline-none transition-all disabled:opacity-40"
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

// ── Main component ─────────────────────────────────────────────
export function FindCommunity() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const [countyId, setCountyId]               = useState("")
  const [constituencyId, setConstituencyId]   = useState("")
  const [wardId, setWardId]                   = useState("")
  const [joiningId, setJoiningId]             = useState<string | null>(null)

  // Pre-fill from user's location on mount
  useEffect(() => {
    if (user?.primaryCountyId && !countyId) {
      setCountyId(user.primaryCountyId)
    }
    if (user?.primaryConstituencyId && !constituencyId) {
      setConstituencyId(user.primaryConstituencyId)
    }
    if (user?.primaryWardId && !wardId) {
      setWardId(user.primaryWardId)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reference data
  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: () => userApi.getCounties(),
    staleTime: Infinity,
  })

  const { data: constituencies = [] } = useQuery({
    queryKey: ["constituencies", countyId],
    queryFn: () => userApi.getConstituencies(countyId),
    enabled: !!countyId,
    staleTime: Infinity,
  })

  const { data: wards = [] } = useQuery({
    queryKey: ["wards", constituencyId],
    queryFn: () => userApi.getWards(constituencyId),
    enabled: !!constituencyId,
    staleTime: Infinity,
  })

  // Groups at narrowest selected location
  const activeFilter = wardId
    ? { wardId }
    : constituencyId
      ? { constituencyId }
      : countyId
        ? { countyId }
        : null

  const { data: groupData, isLoading: loadingGroups } = useQuery({
    queryKey: ["community-groups", activeFilter],
    queryFn: () => communityApi.getGroups({ ...activeFilter!, limit: 50 }),
    enabled: !!activeFilter,
    staleTime: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => communityApi.joinGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-groups"] })
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

  function handleCountyChange(v: string) {
    setCountyId(v)
    setConstituencyId("")
    setWardId("")
  }

  function handleConstituencyChange(v: string) {
    setConstituencyId(v)
    setWardId("")
  }

  const selectedCounty   = counties.find((c) => c.id === countyId)
  const selectedConst    = constituencies.find((c) => c.id === constituencyId)
  const selectedWard     = wards.find((w) => w.id === wardId)

  const systemGroups  = (groupData?.groups ?? []).filter((g) => g.isSystemGroup)
  const voluntaryGroups = (groupData?.groups ?? []).filter((g) => !g.isSystemGroup)

  return (
    <div className="space-y-6">
      {/* Location picker */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "rgba(29,71,49,0.04)", border: "1px solid rgba(29,71,49,0.10)" }}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: "#1D4731" }} />
          <p className="text-sm font-semibold" style={{ color: "#1A120B" }}>Select your location</p>
          {user?.primaryWardId && countyId && (
            <button
              onClick={() => {
                setCountyId(user.primaryCountyId ?? "")
                setConstituencyId(user.primaryConstituencyId ?? "")
                setWardId(user.primaryWardId ?? "")
              }}
              className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(29,71,49,0.10)", color: "#1D4731" }}
            >
              Use my location
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LocationSelect
            label="County"
            value={countyId}
            onChange={handleCountyChange}
            options={counties}
            placeholder="Select county…"
          />
          <LocationSelect
            label="Constituency"
            value={constituencyId}
            onChange={handleConstituencyChange}
            options={constituencies}
            disabled={!countyId}
            placeholder={countyId ? "Select constituency…" : "Select county first"}
          />
          <LocationSelect
            label="Ward"
            value={wardId}
            onChange={setWardId}
            options={wards}
            disabled={!constituencyId}
            placeholder={constituencyId ? "Select ward…" : "Select constituency first"}
          />
        </div>

        {(countyId || constituencyId || wardId) && (
          <LocationBreadcrumb
            county={selectedCounty?.name}
            constituency={selectedConst?.name}
            ward={selectedWard?.name}
          />
        )}
      </div>

      {/* Results */}
      {!activeFilter ? (
        <div className="flex flex-col items-center py-14 space-y-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(29,71,49,0.08)" }}
          >
            <MapPin className="h-5 w-5" style={{ color: "#1D4731" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#1A120B" }}>Select a location to see groups</p>
          <p className="text-xs text-center max-w-xs" style={{ color: "#7A6E60" }}>
            Choose your county, constituency, and ward to find your community groups and voluntary groups nearby.
          </p>
        </div>
      ) : loadingGroups ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl p-4 space-y-3" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="flex items-start gap-3">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (groupData?.groups ?? []).length === 0 ? (
        <div className="flex flex-col items-center py-12 space-y-2">
          <Globe className="h-8 w-8" style={{ color: "rgba(0,0,0,0.15)" }} />
          <p className="text-sm font-medium" style={{ color: "#1A120B" }}>No groups found in this location</p>
          <p className="text-xs" style={{ color: "#7A6E60" }}>Try selecting a broader area or a different ward.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {systemGroups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
                Geographic Community Groups
              </p>
              <div className="space-y-2">
                {systemGroups.map((g) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    onJoin={handleJoin}
                    isJoining={joiningId === g.id}
                  />
                ))}
              </div>
            </div>
          )}

          {voluntaryGroups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7A6E60" }}>
                Voluntary Groups
              </p>
              <div className="space-y-2">
                {voluntaryGroups.map((g) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    onJoin={handleJoin}
                    isJoining={joiningId === g.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
