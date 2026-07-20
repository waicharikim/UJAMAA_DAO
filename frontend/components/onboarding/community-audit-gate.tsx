"use client"

/**
 * CommunityAuditGate
 *
 * Shown once to newly community-verified members before their first action.
 * Surfaces what UjamaaDAO already knows about their community connections —
 * auto-enrolled groups, ward, initial PR balance — so the system is transparent.
 *
 * Dismissed state persists in localStorage: "ca_seen_<userId>"
 */

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { communityApi, economyApi, type GroupMembershipDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Home, MapPin, Landmark, Globe, CheckCircle, Info } from "lucide-react"

// ─── System group icon config ──────────────────────────────────────────────

const SYSTEM_ICON: Record<string, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  WARD:         { Icon: Home,     color: "#1A6B3C", bg: "rgba(26,107,60,0.10)",   label: "Ward" },
  CONSTITUENCY: { Icon: Landmark, color: "#7A4F1E", bg: "rgba(122,79,30,0.10)",   label: "Constituency" },
  COUNTY:       { Icon: MapPin,   color: "#B03A1E", bg: "rgba(176,58,30,0.10)",   label: "County" },
  NATIONAL:     { Icon: Globe,    color: "#1D4731", bg: "rgba(29,71,49,0.10)",     label: "National" },
}

// ─── Single group row ─────────────────────────────────────────────────────

function SystemGroupRow({ group }: { group: GroupMembershipDto }) {
  const cfg = SYSTEM_ICON[group.systemType ?? "WARD"] ?? SYSTEM_ICON.WARD
  const { Icon, color, bg, label } = cfg

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: bg }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#F7F2E8] truncate">{group.groupName}</p>
        <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color }}>
          {label}
        </p>
      </div>
      <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#1A6B3C" }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────

export function CommunityAuditGate() {
  const { user, isAuthenticated } = useAuth()
  const [visible, setVisible] = useState(false)

  // Determine if we should show — only for verified users who haven't seen it
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    const level = user.verificationLevel ?? ""
    const isVerified =
      level === "COMMUNITY_VERIFIED" || level === "FULL_VERIFIED"
    if (!isVerified) return

    const key = `ca_seen_${user.id}`
    if (!localStorage.getItem(key)) {
      setVisible(true)
    }
  }, [isAuthenticated, user])

  const { data: groups = [] } = useQuery<GroupMembershipDto[]>({
    queryKey: ["my-groups-audit"],
    queryFn: () => communityApi.getMyGroups(),
    enabled: visible,
    staleTime: Infinity,
  })

  const { data: prData } = useQuery({
    queryKey: ["pr-balance-audit"],
    queryFn: () => economyApi.getPRBalance(),
    enabled: visible,
    staleTime: Infinity,
  })

  const systemGroups = groups.filter((g) => g.isSystem)

  function handleAcknowledge() {
    if (user?.id) {
      localStorage.setItem(`ca_seen_${user.id}`, "1")
    }
    setVisible(false)
  }

  if (!visible) return null

  const prBalance = (prData as any)?.balance ?? (prData as any)?.participationRights ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-[#0E0B08]/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          {/* Amber rule */}
          <div className="w-12 h-0.5 bg-[#C9922A] mb-8" />

          {/* Header */}
          <h1
            className="text-2xl md:text-3xl font-bold text-[#F7F2E8] mb-3"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Before your first vote
          </h1>
          <p className="text-[#F7F2E8]/60 text-sm leading-relaxed mb-8">
            UjamaaDAO is transparent about what it already knows. Here is your
            community map — the connections that existed before you took any
            action on this platform.
          </p>

          {/* Auto-enrolled groups */}
          {systemGroups.length > 0 && (
            <div className="mb-6">
              <h2
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "#C9922A" }}
              >
                Your Governance Units
              </h2>
              <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="px-4">
                  {systemGroups.map((g) => (
                    <SystemGroupRow key={g.groupId} group={g} />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[#F7F2E8]/30 leading-relaxed">
                You were automatically enrolled in these groups based on your
                registered ward. You cannot leave them — they are your
                constitutional governance units.
              </p>
            </div>
          )}

          {/* PR balance */}
          <div
            className="rounded-xl px-4 py-4 mb-6 flex items-center gap-4"
            style={{ background: "rgba(201,146,42,0.10)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(201,146,42,0.15)" }}
            >
              <span className="text-lg font-bold" style={{ color: "#C9922A" }}>
                PR
              </span>
            </div>
            <div>
              <p
                className="text-xl font-bold"
                style={{ color: "#C9922A", fontFamily: "Georgia, serif" }}
              >
                {Number(prBalance).toLocaleString()}
              </p>
              <p className="text-[11px] text-[#F7F2E8]/50">
                Participation Rights — awarded at registration. Non-transferable.
              </p>
            </div>
          </div>

          {/* Transparency note */}
          <div
            className="rounded-xl px-4 py-3 mb-8 flex items-start gap-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#F7F2E8"/*, opacity: 0.4*/}} />
            <p className="text-[12px] text-[#F7F2E8]/40 leading-relaxed">
              Every connection shown here is permanent in the audit log. Nothing
              about your participation is hidden from you — ever.
            </p>
          </div>

          {/* Acknowledge */}
          <button
            onClick={handleAcknowledge}
            className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#C9922A", color: "#0E0B08" }}
          >
            <CheckCircle className="h-4 w-4" />
            I understand — take me to the platform
          </button>
        </div>
      </div>
    </div>
  )
}
