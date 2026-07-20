"use client"

import { useQuery } from "@tanstack/react-query"
import { projectApi, type MemberContributionDto } from "@/lib/api"
import { CheckCircle2, Clock, Users, Zap } from "lucide-react"

function StatChip({
  icon,
  value,
  label,
  color = "#1D4731",
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <div className="flex items-center gap-1" style={{ color }}>
        {icon}
        <span className="text-sm font-bold">{value}</span>
      </div>
      <span className="text-[9px] text-[#0E0B08]/40 uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

function MemberRow({ contrib }: { contrib: MemberContributionDto }) {
  const initials = (contrib.user.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const totalTasks = contrib.tasksCompleted + contrib.tasksInProgress

  return (
    <div
      className="flex items-center gap-4 rounded-xl px-4 py-3"
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
        style={{ background: "#1D4731" }}
      >
        {contrib.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contrib.user.avatarUrl}
            alt={contrib.user.name ?? ""}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0E0B08] truncate">
          {contrib.user.name ?? "Member"}
        </p>
        <p className="text-[10px] text-[#0E0B08]/40 uppercase tracking-wide">
          {contrib.role === "LEADER" ? "Project Leader" : "Contributor"}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0">
        {totalTasks > 0 && (
          <StatChip
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            value={`${contrib.tasksCompleted}/${totalTasks}`}
            label="Tasks"
            color={contrib.tasksCompleted > 0 ? "#1D4731" : "#7A6E60"}
          />
        )}
        {contrib.hoursLogged > 0 && (
          <StatChip
            icon={<Clock className="h-3.5 w-3.5" />}
            value={`${contrib.hoursLogged.toFixed(1)}h`}
            label="Logged"
            color="#C9922A"
          />
        )}
        {contrib.sessionsAttended > 0 && (
          <StatChip
            icon={<Users className="h-3.5 w-3.5" />}
            value={contrib.sessionsAttended}
            label="Sessions"
          />
        )}
        {contrib.impactPointsEarned > 0 && (
          <StatChip
            icon={<Zap className="h-3.5 w-3.5" />}
            value={contrib.impactPointsEarned}
            label="IP"
            color="#C9922A"
          />
        )}
        {totalTasks === 0 &&
          contrib.hoursLogged === 0 &&
          contrib.sessionsAttended === 0 && (
            <span className="text-[10px] text-[#0E0B08]/30 italic">No activity yet</span>
          )}
      </div>
    </div>
  )
}

interface MemberContributionsProps {
  projectId: string
}

export default function MemberContributions({ projectId }: MemberContributionsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-contributions", projectId],
    queryFn: () => projectApi.getMemberContributions(projectId),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-[#0E0B08]/05 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm font-semibold text-[#0E0B08]/40">No members yet</p>
        <p className="text-xs text-[#0E0B08]/30 mt-1">Contributions will appear once members join.</p>
      </div>
    )
  }

  // Sort: leaders first, then by total impact desc
  const sorted = [...data].sort((a, b) => {
    if (a.role === "LEADER" && b.role !== "LEADER") return -1
    if (b.role === "LEADER" && a.role !== "LEADER") return 1
    return b.impactPointsEarned - a.impactPointsEarned
  })

  return (
    <div className="space-y-2">
      {sorted.map((contrib) => (
        <MemberRow key={contrib.userId} contrib={contrib} />
      ))}
    </div>
  )
}
