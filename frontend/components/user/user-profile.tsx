"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatAddress } from "@/lib/utils"
import { Settings, Edit } from "lucide-react"
import { ProfileEditForm } from "./profile-edit-form"
import { PrivacySettings } from "./privacy-settings"

export function UserProfile() {
  const { user, isAuthenticated } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [showPrivacySettings, setShowPrivacySettings] = useState(false)

  if (!isAuthenticated || !user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-slate-600">Connect your wallet to view your profile</p>
        </CardContent>
      </Card>
    )
  }

  if (isEditing) {
    return <ProfileEditForm user={user} onCancel={() => setIsEditing(false)} onSave={() => setIsEditing(false)} />
  }

  if (showPrivacySettings) {
    return <PrivacySettings user={user} onBack={() => setShowPrivacySettings(false)} />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Profile</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPrivacySettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar || "/placeholder.svg"} />
            <AvatarFallback className="text-lg">
              {user.username?.[0]?.toUpperCase() || formatAddress(user.walletAddress)[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{user.username || "Anonymous User"}</h3>
            <p className="text-sm text-slate-600">{formatAddress(user.walletAddress)}</p>
          </div>
        </div>

        {user.bio && (
          <div>
            <h4 className="font-medium mb-1">Bio</h4>
            <p className="text-sm text-slate-600">{user.bio}</p>
          </div>
        )}

        {user.email && (
          <div>
            <h4 className="font-medium mb-1">Email</h4>
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-2">Roles</h4>
          <div className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
