"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Users, Lock, Plus } from "lucide-react"
import { RoleGuard } from "@/components/auth/role-guard"
import Link from "next/link"

export function GroupsList() {
  const { isAuthenticated } = useAuth()

  const {
    data: groups = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiClient.getGroups(),
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Join Groups</h3>
          <p className="text-slate-600">Connect your wallet to view and join groups.</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-slate-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
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
          <p className="text-red-600">Failed to load groups. Please try again.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Groups</CardTitle>
        <RoleGuard scopes={["groups:create"]}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </RoleGuard>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups Yet</h3>
            <p className="text-slate-600 mb-4">
              You haven't joined any groups yet. Explore and join communities that interest you.
            </p>
            <Button>Explore Groups</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={group.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{group.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{group.name}</h3>
                      {group.isPrivate && <Lock className="h-4 w-4 text-slate-500" />}
                      {group.userRole && (
                        <Badge variant="secondary" className="text-xs">
                          {group.userRole}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 truncate mb-1">{group.description}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Users className="h-3 w-3" />
                      <span>{group.memberCount} members</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
