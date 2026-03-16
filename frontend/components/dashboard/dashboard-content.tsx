"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Vote, Users, Briefcase, Award, Coins, TrendingUp, Target, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { economyApi, governanceApi, communityApi, notificationsApi } from "@/lib/api"
import { BarazaGroupsCard } from "@/components/integration/baraza-groups-card"
import { SystemGroupsCard } from "@/components/community/system-groups-card"
import { EmergencyAlertsCard } from "@/components/emergency/emergency-alerts-card"

// ─── Stat card skeleton ───────────────────────────────────
function StatSkeleton() {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  )
}

// ─── Individual stat card ─────────────────────────────────
interface StatCardProps {
  title: string
  subtitle: string
  value: number | string
  change: string
  changeType: "positive" | "negative" | "neutral"
  icon: React.ElementType
  colorClass: string
}

function StatCard({ title, subtitle, value, change, changeType, icon: Icon, colorClass }: StatCardProps) {
  return (
    <Card className="border-0 shadow-card overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{subtitle}</p>
            <p className="text-[28px] font-bold text-[#0E0B08] leading-none mb-2">{value}</p>
            <p
              className="text-xs font-medium"
              style={{
                color:
                  changeType === "positive"
                    ? "#1E3D2F"
                    : changeType === "negative"
                      ? "#B03A1E"
                      : "rgba(14,11,8,0.4)",
              }}
            >
              {change}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Unauthenticated empty state ──────────────────────────
function UnauthenticatedState() {
  return (
    <Card
      className="border-0 shadow-card text-center py-16 px-8"
      style={{ background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)" }}
    >
      <CardContent>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(201,146,42,0.12)" }}
        >
          <Award className="h-7 w-7" style={{ color: "#C9922A" }} />
        </div>
        <h2 className="font-display font-bold text-2xl text-[#0E0B08] mb-2">Your Ward Dashboard</h2>
        <p className="text-[#0E0B08]/60 mb-6 max-w-sm mx-auto text-sm">
          Sign in to see your Participation Rights balance, Impact Points, and your ward&apos;s governance activity.
        </p>
        <p className="text-xs text-[#0E0B08]/40">Use the Sign In button in the top right to get started.</p>
      </CardContent>
    </Card>
  )
}

// ─── Main dashboard ───────────────────────────────────────
export function DashboardContent() {
  const { user, isAuthenticated } = useAuth()

  // Fetch PR balance from economy API (30s stale time)
  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ["pr-balance"],
    queryFn: () => economyApi.getPRBalance(),
    staleTime: 30_000,
    enabled: isAuthenticated,
  })

  // Active proposals count
  const { data: proposalsMeta } = useQuery({
    queryKey: ["proposals-count"],
    queryFn: () => governanceApi.getProposals({ limit: 1 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  // Proposals needing the current user's action
  const { data: needsAction } = useQuery({
    queryKey: ["proposals-needs-action"],
    queryFn: () => governanceApi.getNeedsAction(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  // My communities count (reuse system-groups query key)
  const { data: myGroups = [] } = useQuery({
    queryKey: ["system-groups"],
    queryFn: communityApi.getMyGroups,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  // Recent activity from notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getNotifications(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const prBalance = prData?.balance ?? user?.tokenBalance ?? 0
  const impactPoints = user?.impactPoints?.global ?? 0
  const recentActivity = notifications.slice(0, 5)

  return (
    <div className="px-4 md:px-8 py-6 space-y-8 max-w-6xl mx-auto">
      {/* Welcome header */}
      {isAuthenticated && user && (
        <div>
          <h2 className="font-display font-bold text-3xl text-[#0E0B08] leading-tight">
            Karibu,{" "}
            <span style={{ color: "#C9922A" }}>{user.username || user.email?.split("@")[0] || "Mwanachama"}</span>
          </h2>
          <p className="text-sm text-[#0E0B08]/50 mt-1">Ward Sovereignty Platform — making every ward count</p>
          {/* Mobile token bar — hidden on desktop (topbar handles it there) */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-none md:hidden pb-0.5">
            {[
              { label: "PR", value: prBalance,              color: "#C9922A" },
              { label: "IP", value: impactPoints,            color: "#1D4731" },
              { label: "UT", value: user.utBalance ?? 0,    color: "#7A4F1E" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0"
                style={{ background: `${color}15`, color }}
              >
                <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
                <span className="opacity-60">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unauthenticated state */}
      {!isAuthenticated && <UnauthenticatedState />}

      {/* Stats grid */}
      {isAuthenticated && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {prLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                title="Mapendekezo Hai"
                subtitle="Active Proposals"
                value={proposalsMeta?.total ?? "—"}
                change="All submitted"
                changeType="positive"
                icon={Vote}
                colorClass="bg-[#C9922A]"
              />
              <StatCard
                title="Makundi Yangu"
                subtitle="My Communities"
                value={myGroups.length}
                change="Groups joined"
                changeType="neutral"
                icon={Users}
                colorClass="bg-[#1E3D2F]"
              />
              <StatCard
                title="Alama za Athari"
                subtitle="Impact Points"
                value={impactPoints}
                change="Reputation score"
                changeType="positive"
                icon={Award}
                colorClass="bg-[#B03A1E]"
              />
              <StatCard
                title="Haki za Ushiriki"
                subtitle="Participation Rights"
                value={prBalance}
                change="PR balance"
                changeType="neutral"
                icon={Coins}
                colorClass="bg-[#2A5240]"
              />
            </>
          )}
        </div>
      )}

      {/* Needs-action banner — only when there are pending governance items */}
      {isAuthenticated && needsAction && needsAction.total > 0 && (
        <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #FFF7E6 0%, #FEF3C7 100%)", borderLeft: "4px solid #D4911E" }}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-[#0A1F14]">
                  {needsAction.total} proposal{needsAction.total !== 1 ? "s" : ""} need your attention
                </p>
                <p className="text-xs text-warm-gray">
                  You have pending actions as a proposal creator, group leader, or administrator.
                </p>
              </div>
            </div>
            <Link href="/proposals">
              <Button size="sm" className="flex-shrink-0 font-semibold text-xs" style={{ background: "#D4911E", color: "#0A1F14" }}>
                Review Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick action cards */}
      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card
            className="group border-0 overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold"
            style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
          >
            <CardContent className="p-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(14,11,8,0.15)" }}
              >
                <Vote className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E0B08] mb-1">Governance</h3>
              <p className="text-sm text-[#0E0B08]/60 mb-4">
                Vote on ward proposals and shape your community&apos;s future.
              </p>
              <Link href="/proposals">
                <Button
                  size="sm"
                  className="w-full font-semibold"
                  style={{ background: "rgba(14,11,8,0.15)", color: "#0E0B08", border: "1px solid rgba(14,11,8,0.15)" }}
                >
                  View Proposals
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card
            className="group border-0 overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #1E3D2F 0%, #2A5240 100%)" }}
          >
            <CardContent className="p-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-1">Projects</h3>
              <p className="text-sm text-white/60 mb-4">
                Join ward projects — boreholes, schools, clean energy.
              </p>
              <Link href="/projects">
                <Button
                  size="sm"
                  className="w-full font-semibold"
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  Browse Projects
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card
            className="group border-0 overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)", border: "1px solid rgba(201,146,42,0.2)" }}
          >
            <CardContent className="p-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(201,146,42,0.12)" }}
              >
                <Users className="h-5 w-5" style={{ color: "#C9922A" }} />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E0B08] mb-1">Community</h3>
              <p className="text-sm text-[#0E0B08]/60 mb-4">
                Connect with ward members and join interest groups.
              </p>
              <Link href="/groups">
                <Button
                  size="sm"
                  className="w-full font-semibold"
                  style={{ background: "rgba(201,146,42,0.1)", color: "#C9922A", border: "1px solid rgba(201,146,42,0.3)" }}
                >
                  Explore Groups
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent activity */}
      {isAuthenticated && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" style={{ color: "#C9922A" }} />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color: "rgba(14,11,8,0.35)" }}>
                      No recent activity yet.
                    </p>
                  ) : (
                    recentActivity.map((n: any) => {
                      const isProposal = n.type?.startsWith("PROPOSAL")
                      const isGroup    = n.type?.startsWith("GROUP") || n.type?.startsWith("COMMUNITY")
                      const iconColor  = isProposal ? "#C9922A" : isGroup ? "#B03A1E" : "#1E3D2F"
                      const iconBg     = isProposal ? "rgba(201,146,42,0.12)" : isGroup ? "rgba(176,58,30,0.1)" : "rgba(30,61,47,0.1)"
                      const Icon       = isProposal ? Vote : isGroup ? Users : Target
                      return (
                        <div
                          key={n.id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: "rgba(201,146,42,0.05)" }}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: iconBg }}
                          >
                            <Icon className="h-4 w-4" style={{ color: iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0E0B08] truncate">{n.title || n.message}</p>
                            {n.message && n.title && (
                              <p className="text-xs text-[#0E0B08]/50 truncate">{n.message}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-[#0E0B08]/40 flex-shrink-0">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <SystemGroupsCard />
            <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
              <BarazaGroupsCard />
            </Suspense>
            <EmergencyAlertsCard />
          </div>
        </div>
      )}
    </div>
  )
}
