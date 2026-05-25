"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Vote, Users, Briefcase, Award, Coins, Zap, AlertCircle, ShieldCheck, MapPin, BarChart3, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useRole } from "@/contexts/role-context"
import { economyApi, governanceApi, communityApi, adminApi } from "@/lib/api"
import { HomeFeed } from "@/components/feed/home-feed"
import { BarazaGroupsCard } from "@/components/integration/baraza-groups-card"
import { SystemGroupsCard } from "@/components/community/system-groups-card"
import { EmergencyAlertsCard } from "@/components/emergency/emergency-alerts-card"
import { GettingStartedCard } from "@/components/onboarding/getting-started-card"
import { ImpactTracker } from "@/components/user/impact-tracker"

// ─── Stat card skeleton ───────────────────────────────────
function StatSkeleton() {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-4 md:p-6 space-y-3">
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
      <CardContent className="p-3 md:p-5">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center mb-2.5 ${colorClass}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <p className="text-[9px] md:text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 leading-snug">{subtitle}</p>
        <p className="text-xl md:text-[28px] font-bold text-[#0E0B08] leading-none mb-1.5">{value}</p>
        <p
          className="text-[10px] md:text-xs font-medium"
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

// ─── Admin overview panel ──────────────────────────────────
function AdminPanel() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
    staleTime: 60_000,
  })

  const { data: recentUsers } = useQuery({
    queryKey: ["admin-users-recent"],
    queryFn: () => adminApi.getUsers({ limit: 4 }),
    staleTime: 60_000,
  })

  return (
    <Card className="border-0 shadow-card" style={{ borderLeft: "4px solid #C9922A" }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: "#C9922A" }} />
            Platform Overview
          </div>
          <Link href="/admin">
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2 gap-1" style={{ color: "#C9922A" }}>
              Admin Panel <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Total Users", value: stats?.users.total ?? "—" },
            { label: "Active Proposals", value: stats?.governance.activeProposals ?? "—" },
            { label: "Pending Verif.", value: stats?.pendingActions.verifications ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: "rgba(201,146,42,0.07)" }}>
              <p className="text-xl font-bold" style={{ color: "#0E0B08" }}>{value}</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(14,11,8,0.5)" }}>{label}</p>
            </div>
          ))}
        </div>
        {recentUsers && recentUsers.users.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Recent Users</p>
            {recentUsers.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "rgba(14,11,8,0.06)" }}>
                <span className="font-medium truncate max-w-[55%]" style={{ color: "#0E0B08" }}>{u.name ?? u.email}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "rgba(30,61,47,0.1)", color: "#1D4731" }}>
                  {u.verificationLevel?.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Compliance officer panel ──────────────────────────────
function CompliancePanel() {
  const { data: pendingUsers } = useQuery({
    queryKey: ["compliance-pending-verif"],
    queryFn: () => adminApi.getUsers({ verificationLevel: "PHONE_VERIFIED", limit: 5 }),
    staleTime: 60_000,
  })

  const { data: activeProposals } = useQuery({
    queryKey: ["compliance-proposals"],
    queryFn: () => governanceApi.getProposals({ limit: 1 }),
    staleTime: 60_000,
  })

  return (
    <Card className="border-0 shadow-card" style={{ borderLeft: "4px solid #1D4731" }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4" style={{ color: "#1D4731" }} />
          Compliance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: "rgba(30,61,47,0.07)" }}>
            <p className="text-2xl font-bold" style={{ color: "#0E0B08" }}>
              {pendingUsers?.total ?? "—"}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(14,11,8,0.5)" }}>Awaiting Community Verification</p>
            <Link href="/admin">
              <Button size="sm" variant="ghost" className="text-xs h-7 px-0 mt-2 gap-1" style={{ color: "#1D4731" }}>
                Review Queue <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="rounded-xl p-4" style={{ background: "rgba(201,146,42,0.07)" }}>
            <p className="text-2xl font-bold" style={{ color: "#0E0B08" }}>
              {activeProposals?.total ?? "—"}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(14,11,8,0.5)" }}>Active Proposals</p>
            <Link href="/proposals">
              <Button size="sm" variant="ghost" className="text-xs h-7 px-0 mt-2 gap-1" style={{ color: "#C9922A" }}>
                View Governance <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── County coordinator panel ──────────────────────────────
function CoordinatorPanel() {
  const { data: proposals } = useQuery({
    queryKey: ["coordinator-proposals"],
    queryFn: () => governanceApi.getProposals({ limit: 4 }),
    staleTime: 60_000,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ["coordinator-groups"],
    queryFn: communityApi.getMyGroups,
    staleTime: 60_000,
  })

  return (
    <Card className="border-0 shadow-card" style={{ borderLeft: "4px solid #2A5240" }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" style={{ color: "#2A5240" }} />
          County Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposals && proposals.proposals && proposals.proposals.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(14,11,8,0.4)" }}>Active Proposals</p>
            {proposals.proposals.slice(0, 3).map((p: any) => (
              <Link key={p.id} href={`/proposals/${p.id}`}>
                <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
                  <span className="font-medium truncate max-w-[70%]" style={{ color: "#0E0B08" }}>{p.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "rgba(42,82,64,0.1)", color: "#2A5240" }}>
                    {p.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
            <Link href="/proposals">
              <Button size="sm" variant="ghost" className="text-xs h-7 px-0 gap-1 w-full justify-end" style={{ color: "#2A5240" }}>
                All proposals <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-xs py-2" style={{ color: "rgba(14,11,8,0.4)" }}>No active proposals yet.</p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "rgba(14,11,8,0.5)" }}>
            Ward Groups: <span className="font-semibold" style={{ color: "#0E0B08" }}>{groups.length}</span>
          </p>
          <Link href="/groups">
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2 gap-1" style={{ color: "#2A5240" }}>
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Verification nudge banner ─────────────────────────────
function VerificationNudge({ level }: { level: string }) {
  if (level === "EMAIL_VERIFIED") {
    return (
      <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #FFF7E6 0%, #FEF3C7 100%)", borderLeft: "4px solid #D4911E" }}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#D4911E" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#0A1F14" }}>Verify your phone number</p>
              <p className="text-xs" style={{ color: "rgba(14,11,8,0.5)" }}>Complete phone verification to unlock economy features and community access.</p>
            </div>
          </div>
          <Link href="/profile">
            <Button size="sm" className="flex-shrink-0 font-semibold text-xs" style={{ background: "#D4911E", color: "#0A1F14" }}>
              Start →
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (level === "PHONE_VERIFIED") {
    return (
      <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #F0F7F4 0%, #E6F2EC 100%)", borderLeft: "4px solid #1D4731" }}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 flex-shrink-0" style={{ color: "#1D4731" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#0A1F14" }}>Complete community verification</p>
              <p className="text-xs" style={{ color: "rgba(14,11,8,0.5)" }}>Get 3 ward members to vouch for you and unlock governance participation.</p>
            </div>
          </div>
          <Link href="/profile">
            <Button size="sm" className="flex-shrink-0 font-semibold text-xs" style={{ background: "#1D4731", color: "#fff" }}>
              Request Vouching →
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return null
}

// ─── Welcome header ───────────────────────────────────────
function WelcomeHeader({
  user,
  prBalance,
  impactPoints,
}: {
  user: { username?: string; email?: string; utBalance?: number }
  prBalance: number
  impactPoints: number
}) {
  const tokens = [
    { label: "PR", value: prBalance,         color: "#C9922A" },
    { label: "IP", value: impactPoints,       color: "#1D4731" },
    { label: "UT", value: user.utBalance ?? 0, color: "#7A4F1E" },
  ]
  return (
    <div>
      <h2 className="font-display font-bold text-2xl md:text-3xl text-[#0E0B08] leading-tight">
        Karibu,{" "}
        <span style={{ color: "#C9922A" }}>{user.username || user.email?.split("@")[0] || "Mwanachama"}</span>
      </h2>
      <p className="text-sm text-[#0E0B08]/50 mt-1">Ward Sovereignty Platform — making every ward count</p>
      <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-none md:hidden pb-0.5">
        {tokens.map(({ label, value, color }) => (
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
  )
}

// ─── Section label ─────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(14,11,8,0.40)" }}>
      {children}
    </p>
  )
}

// ─── Your Impact row (PR · IP · UT) ───────────────────────
function ImpactRow({
  prBalance,
  impactPoints,
  utBalance,
  isLoading,
}: {
  prBalance: number
  impactPoints: number
  utBalance: number
  isLoading: boolean
}) {
  return (
    <div>
      <SectionLabel>Your Impact</SectionLabel>
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {isLoading ? (
          <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
        ) : (
          <>
            <StatCard title="Haki za Ushiriki"  subtitle="Participation Rights" value={prBalance}    change="PR balance"      changeType="neutral"  icon={Coins} colorClass="bg-[#2A5240]" />
            <StatCard title="Alama za Athari"    subtitle="Impact Points"        value={impactPoints} change="Reputation score" changeType="positive" icon={Award} colorClass="bg-[#B03A1E]" />
            <StatCard title="Tokeni za Huduma"   subtitle="Utility Tokens"       value={utBalance}    change="UT balance"      changeType="neutral"  icon={Zap}   colorClass="bg-[#7A4F1E]" />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Ward Status row (Proposals · Communities) ────────────
function WardStatusRow({
  proposalCount,
  groupCount,
  isLoading,
}: {
  proposalCount: number | undefined
  groupCount: number
  isLoading: boolean
}) {
  return (
    <div>
      <SectionLabel>Ward Status</SectionLabel>
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {isLoading ? (
          <><StatSkeleton /><StatSkeleton /></>
        ) : (
          <>
            <StatCard title="Mapendekezo Hai" subtitle="Active Proposals" value={proposalCount ?? "—"} change="All submitted"  changeType="positive" icon={Vote}  colorClass="bg-[#C9922A]" />
            <StatCard title="Makundi Yangu"    subtitle="My Communities"   value={groupCount}           change="Groups joined"  changeType="neutral"  icon={Users} colorClass="bg-[#1E3D2F]" />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Needs-action banner ───────────────────────────────────
function NeedsActionBanner({ total }: { total: number }) {
  return (
    <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #FFF7E6 0%, #FEF3C7 100%)", borderLeft: "4px solid #D4911E" }}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#0A1F14]">
              {total} proposal{total !== 1 ? "s" : ""} need your attention
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
  )
}

// ─── Quick action cards ────────────────────────────────────
function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
      <Card
        className="group border-0 overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold"
        style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
      >
        <CardContent className="p-4 md:p-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 md:mb-4" style={{ background: "rgba(14,11,8,0.15)" }}>
            <Vote className="h-5 w-5 text-white" />
          </div>
          <h3 className="font-display font-bold text-lg md:text-xl text-[#0E0B08] mb-1">Governance</h3>
          <p className="text-sm text-[#0E0B08]/60 mb-3 md:mb-4">Vote on ward proposals and shape your community&apos;s future.</p>
          <Link href="/proposals">
            <Button size="sm" className="w-full font-semibold" style={{ background: "rgba(14,11,8,0.15)", color: "#0E0B08", border: "1px solid rgba(14,11,8,0.15)" }}>
              View Proposals
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card
        className="group border-0 overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #1E3D2F 0%, #2A5240 100%)" }}
      >
        <CardContent className="p-4 md:p-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 md:mb-4" style={{ background: "rgba(255,255,255,0.1)" }}>
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <h3 className="font-display font-bold text-lg md:text-xl text-white mb-1">Projects</h3>
          <p className="text-sm text-white/60 mb-3 md:mb-4">Join ward projects — boreholes, schools, clean energy.</p>
          <Link href="/projects">
            <Button size="sm" className="w-full font-semibold" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
              Browse Projects
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card
        className="group border-0 overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)", border: "1px solid rgba(201,146,42,0.2)" }}
      >
        <CardContent className="p-4 md:p-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 md:mb-4" style={{ background: "rgba(201,146,42,0.12)" }}>
            <Users className="h-5 w-5" style={{ color: "#C9922A" }} />
          </div>
          <h3 className="font-display font-bold text-lg md:text-xl text-[#0E0B08] mb-1">Community</h3>
          <p className="text-sm text-[#0E0B08]/60 mb-3 md:mb-4">Connect with ward members and join interest groups.</p>
          <Link href="/groups">
            <Button size="sm" className="w-full font-semibold" style={{ background: "rgba(201,146,42,0.1)", color: "#C9922A", border: "1px solid rgba(201,146,42,0.3)" }}>
              Explore Groups
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Activity section ──────────────────────────────────────
function ActivitySection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      <div className="lg:col-span-2">
        <HomeFeed embedded />
      </div>
      <div className="space-y-4">
        <GettingStartedCard />
        <ImpactTracker />
        <SystemGroupsCard />
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <BarazaGroupsCard />
        </Suspense>
        <EmergencyAlertsCard />
      </div>
    </div>
  )
}

// ─── Role-specific panels ──────────────────────────────────
function RolePanels({ isAdmin, isCompliance, isCoordinator }: { isAdmin: boolean; isCompliance: boolean; isCoordinator: boolean }) {
  if (isAdmin)       return <AdminPanel />
  if (isCompliance)  return <CompliancePanel />
  if (isCoordinator) return <CoordinatorPanel />
  return null
}

// ─── Main dashboard ───────────────────────────────────────
export function DashboardContent() {
  const { user, isAuthenticated } = useAuth()
  const { hasAnyRole } = useRole()

  const isAdmin       = hasAnyRole(["super_admin", "admin", "auditor", "ward_admin", "constituency_admin", "county_admin"])
  const isCompliance  = hasAnyRole(["compliance_officer"])
  const isCoordinator = hasAnyRole(["county_coordinator"])

  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ["pr-balance"],
    queryFn: () => economyApi.getPRBalance(),
    staleTime: 30_000,
    enabled: isAuthenticated,
  })
  const { data: proposalsMeta } = useQuery({
    queryKey: ["proposals-count"],
    queryFn: () => governanceApi.getProposals({ limit: 1 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
  const { data: needsAction } = useQuery({
    queryKey: ["proposals-needs-action"],
    queryFn: () => governanceApi.getNeedsAction(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
  const { data: myGroups = [] } = useQuery({
    queryKey: ["system-groups"],
    queryFn: communityApi.getMyGroups,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const prBalance    = prData?.balance ?? user?.tokenBalance ?? 0
  const impactPoints = user?.impactPoints?.global ?? 0

  if (!isAuthenticated) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        <UnauthenticatedState />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-8 max-w-6xl mx-auto">
      {user && <WelcomeHeader user={user} prBalance={prBalance} impactPoints={impactPoints} />}
      {user?.verificationLevel && <VerificationNudge level={user.verificationLevel} />}
      <RolePanels isAdmin={isAdmin} isCompliance={isCompliance} isCoordinator={isCoordinator} />
      <ImpactRow
        prBalance={prBalance}
        impactPoints={impactPoints}
        utBalance={user?.utBalance ?? 0}
        isLoading={prLoading}
      />
      <WardStatusRow
        proposalCount={proposalsMeta?.total}
        groupCount={myGroups.length}
        isLoading={prLoading}
      />
      {needsAction && needsAction.total > 0 && <NeedsActionBanner total={needsAction.total} />}
      <QuickActions />
      <ActivitySection />
    </div>
  )
}
