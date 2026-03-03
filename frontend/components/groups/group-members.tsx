"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient, type GroupMemberDto } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, ShieldCheck } from "lucide-react"
import { formatDate } from "@/lib/utils"

// ── Verification level color ──────────────────────────────────

function VerificationBadge({ level }: { level: string }) {
  const isVerified = level === "COMMUNITY_VERIFIED" || level === "FULL_VERIFIED"
  if (!isVerified) return null
  return (
    <ShieldCheck
      className="h-3.5 w-3.5 flex-shrink-0"
      style={{ color: "#1D4731" }}
      aria-label={level.replace(/_/g, " ")}
    />
  )
}

// ── Role badge ────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  LEADER: { bg: "rgba(201,146,42,0.12)", color: "#7A4F1E" },
  ADMIN:  { bg: "rgba(29,71,49,0.10)",   color: "#1D4731" },
  MEMBER: { bg: "rgba(14,11,8,0.06)",    color: "#7A6E60" },
}

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLE[role] ?? ROLE_STYLE.MEMBER
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={style}
    >
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </span>
  )
}

// ── Single member row ─────────────────────────────────────────

function MemberRow({ member }: { member: GroupMemberDto }) {
  const initials = member.userName
    ? member.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/[0.04] last:border-0">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={member.avatarUrl ?? undefined} />
        <AvatarFallback
          className="text-xs font-semibold"
          style={{ background: "rgba(201,146,42,0.12)", color: "#7A4F1E" }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#0E0B08] truncate">{member.userName}</span>
          <VerificationBadge level={member.verificationLevel} />
        </div>
        <p className="text-[11px]" style={{ color: "#7A6E60" }}>
          Joined {formatDate(member.joinedAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <RoleBadge role={member.role} />
      </div>
    </div>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────

function MemberSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/[0.04] last:border-0">
      <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-4 w-14 rounded-full" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

interface GroupMembersProps {
  groupId: string
}

export function GroupMembers({ groupId }: GroupMembersProps) {
  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => apiClient.getGroupMembers(groupId),
    staleTime: 30_000,
  })

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-chai flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "#1D4731" }} />
          {isLoading ? "Members" : `Members (${members.length})`}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-1">
        {isLoading ? (
          <>
            <MemberSkeleton />
            <MemberSkeleton />
            <MemberSkeleton />
            <MemberSkeleton />
            <MemberSkeleton />
          </>
        ) : error ? (
          <p className="text-xs py-3 text-center" style={{ color: "#B03A1E" }}>
            Failed to load members.
          </p>
        ) : members.length === 0 ? (
          <p className="text-xs py-3" style={{ color: "#7A6E60" }}>
            No members found.
          </p>
        ) : (
          <ScrollArea className="max-h-[420px]">
            {members.map((member) => (
              <MemberRow key={member.userId} member={member} />
            ))}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
