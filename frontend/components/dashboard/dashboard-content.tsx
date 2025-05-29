import { Suspense } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { StatsGrid } from "@/components/layout/stats-grid"
import { UserProfile } from "@/components/user/user-profile"
import { GroupsList } from "@/components/groups/groups-list"
import Link from "next/link"
import { Vote, Users, FolderOpen, TrendingUp, Award, Coins, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function DashboardContent() {
  const stats = [
    {
      title: "Mapendekezo Hai", // Active Proposals
      subtitle: "Active Proposals",
      value: 12,
      change: "+3 wiki hii", // this week
      changeType: "positive" as const,
      icon: Vote,
      color: "bg-gradient-to-br from-orange-500 to-red-600",
      description: "Mapendekezo ya uongozi",
    },
    {
      title: "Miradi Yangu", // My Projects
      subtitle: "My Projects",
      value: 5,
      change: "2 zinakamilika", // completing
      changeType: "neutral" as const,
      icon: FolderOpen,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      description: "Ushiriki hai",
    },
    {
      title: "Alama za Athari", // Impact Points
      subtitle: "Impact Points",
      value: 1250,
      change: "+85 mwezi huu", // this month
      changeType: "positive" as const,
      icon: Award,
      color: "bg-gradient-to-br from-yellow-500 to-orange-500",
      description: "Jumla ya alama",
    },
    {
      title: "Salio la Sarafu", // Token Balance
      subtitle: "Token Balance",
      value: 500,
      change: "Zinapatikana", // Available
      changeType: "neutral" as const,
      icon: Coins,
      color: "bg-gradient-to-br from-blue-500 to-purple-600",
      description: "Sarafu za uongozi",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="Karibu kwenye jukwaa lako la uongozi wa kijamii. Shiriki katika mapendekezo, simamia miradi, na jenga athari ya jamii."
        gradient
        badge="UJAMAA 🌍"
      />

      {/* Stats Grid */}
      <StatsGrid stats={stats} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Vote className="h-5 w-5" />
              </div>
              <div>
                <div>Mapendekezo Hai</div>
                <div className="text-sm opacity-80">Active Proposals</div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-orange-100 mb-4">
              Shiriki katika uongozi kwa kupiga kura na kuunda mustakabali wetu pamoja.
            </p>
            <Link href="/proposals">
              <Button variant="secondary" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Vote className="h-4 w-4 mr-2" />
                Ona Mapendekezo 🗳️
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <div>Miradi Yangu</div>
                <div className="text-sm opacity-80">My Projects</div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-green-100 mb-4">Simamia ushiriki wako na ufuatilie maendeleo ya hatua muhimu.</p>
            <Link href="/projects">
              <Button variant="secondary" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                <FolderOpen className="h-4 w-4 mr-2" />
                Ona Miradi 📁
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div>Vikundi vya Jamii</div>
                <div className="text-sm opacity-80">Community Groups</div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-purple-100 mb-4">Jiunge na vikundi na ushirikiane na wanajamii wenzako.</p>
            <Link href="/groups">
              <Button variant="secondary" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Users className="h-4 w-4 mr-2" />
                Chunguza Vikundi 👥
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <div>
                  <div>Shughuli za Hivi Karibuni</div>
                  <div className="text-sm font-normal text-gray-500">Recent Activity</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    action: "Alipiga kura", // Voted
                    actionEn: "Voted on proposal",
                    title: "Mradi wa Nishati ya Jua ya Jamii",
                    titleEn: "Community Solar Energy Initiative",
                    time: "masaa 2 yaliyopita", // 2 hours ago
                    type: "vote",
                    status: "imeidhinishwa", // approved
                  },
                  {
                    action: "Alikamilisha hatua",
                    actionEn: "Completed milestone",
                    title: "Mafunzo ya Ujuzi wa Kidijitali - Awamu ya 1",
                    titleEn: "Digital Literacy Training - Phase 1",
                    time: "siku 1 iliyopita",
                    type: "milestone",
                    status: "imekamilika",
                  },
                  {
                    action: "Alijiunga na kikundi",
                    actionEn: "Joined group",
                    title: "Kikundi cha Nishati Safi",
                    titleEn: "Green Energy Collective",
                    time: "siku 3 zilizopita",
                    type: "group",
                    status: "hai",
                  },
                ].map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        activity.type === "vote"
                          ? "bg-orange-100 text-orange-600"
                          : activity.type === "milestone"
                            ? "bg-green-100 text-green-600"
                            : "bg-purple-100 text-purple-600"
                      }`}
                    >
                      {activity.type === "vote" && <Vote className="h-4 w-4" />}
                      {activity.type === "milestone" && <Target className="h-4 w-4" />}
                      {activity.type === "group" && <Users className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {activity.action} • <span className="text-sm text-gray-600">{activity.actionEn}</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {activity.title}
                        <br />
                        <span className="text-xs text-gray-500">{activity.titleEn}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={activity.status === "imekamilika" ? "default" : "secondary"}>
                        {activity.status}
                      </Badge>
                      <div className="text-xs text-slate-500 mt-1">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Groups Section */}
          <Suspense fallback={<div className="h-32 animate-pulse bg-slate-200 rounded-lg" />}>
            <GroupsList />
          </Suspense>
        </div>

        <div>
          <Suspense fallback={<div className="h-64 animate-pulse bg-slate-200 rounded-lg" />}>
            <UserProfile />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
