"use client"

import { useAuth } from "@/contexts/auth-context"
import { UserProfile } from "@/components/user/user-profile"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Award, Coins, Users } from "lucide-react"

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">{label}</p>
            <p className="text-[28px] font-bold text-[#0E0B08] leading-none">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color }}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="font-display font-bold text-3xl text-[#0E0B08]">My Profile</h2>
        <p className="text-sm text-[#0E0B08]/50 mt-1">
          Manage your account, track your impact, and update your preferences.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Impact Points"
            value={user?.impactPoints?.global ?? 0}
            icon={Award}
            color="#C9922A"
          />
          <StatCard
            label="PR Balance"
            value={user?.tokenBalance ?? 0}
            icon={Coins}
            color="#1E3D2F"
          />
          <StatCard
            label="Roles"
            value={user?.roles?.length ?? 0}
            icon={Users}
            color="#B03A1E"
          />
        </div>
      )}

      <UserProfile />
    </div>
  )
}
