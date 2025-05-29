"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Users, Lock, Settings, UserPlus } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { RoleGuard } from "@/components/auth/role-guard"

interface GroupDetailProps {
  groupId: string
}

export function GroupDetail({ groupId }: GroupDetailProps) {
  const {
    data: group,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiClient.getGroup(groupId),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 bg-slate-200 rounded-full" />
              <div className="flex-1">
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-5/6" />
              <div className="h-4 bg-slate-200 rounded w-4/6" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !group) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Failed to load group details.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={group.avatar || "/placeholder.svg"} />
              <AvatarFallback className="text-lg">{group.name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-2xl">{group.name}</CardTitle>
                {group.isPrivate && <Lock className="h-5 w-5 text-slate-500" />}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{group.memberCount} members</span>
                </div>
                <span>•</span>
                <span>Created {formatDate(group.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <RoleGuard scopes={["groups:invite"]}>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </RoleGuard>
            <RoleGuard scopes={["groups:manage"]}>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </RoleGuard>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">About</h3>
            <p className="text-slate-600">{group.description}</p>
          </div>

          {group.userRole && (
            <div>
              <h3 className="font-semibold mb-2">Your Role</h3>
              <Badge variant="secondary">{group.userRole}</Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
