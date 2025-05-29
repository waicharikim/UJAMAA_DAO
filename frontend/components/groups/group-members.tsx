"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatAddress, formatDate } from "@/lib/utils"
import { Users } from "lucide-react"

interface GroupMembersProps {
  groupId: string
}

export function GroupMembers({ groupId }: GroupMembersProps) {
  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => apiClient.getGroupMembers(groupId),
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-1" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Failed to load members.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Members ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4 space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.user.avatar || "/placeholder.svg"} />
                  <AvatarFallback>
                    {member.user.username?.[0]?.toUpperCase() || formatAddress(member.user.walletAddress)[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">
                      {member.user.username || formatAddress(member.user.walletAddress)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Joined {formatDate(member.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
