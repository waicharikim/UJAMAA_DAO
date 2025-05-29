"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { User, PrivacySettings as PrivacySettingsType } from "@/lib/types"
import { ArrowLeft } from "lucide-react"

interface PrivacySettingsProps {
  user: User
  onBack: () => void
}

export function PrivacySettings({ user, onBack }: PrivacySettingsProps) {
  const [settings, setSettings] = useState<PrivacySettingsType>(user.privacySettings)
  const [isLoading, setIsLoading] = useState(false)
  const { updateUser } = useAuth()
  const { toast } = useToast()

  const handleSave = async () => {
    try {
      setIsLoading(true)
      const updatedUser = await apiClient.updatePrivacySettings(settings)
      updateUser(updatedUser)

      toast({
        title: "Privacy Settings Updated",
        description: "Your privacy preferences have been saved.",
      })
    } catch (error) {
      console.error("Failed to update privacy settings:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update privacy settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = (key: keyof PrivacySettingsType, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Privacy Settings</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Profile Visibility</Label>
          <Select
            value={settings.profileVisibility}
            onValueChange={(value) => updateSetting("profileVisibility", value as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="friends">Friends Only</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Email Visibility</Label>
          <Select
            value={settings.emailVisibility}
            onValueChange={(value) => updateSetting("emailVisibility", value as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="friends">Friends Only</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Wallet Visibility</Label>
          <Select
            value={settings.walletVisibility}
            onValueChange={(value) => updateSetting("walletVisibility", value as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="friends">Friends Only</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Privacy Settings"}
        </Button>
      </CardContent>
    </Card>
  )
}
