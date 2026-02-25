"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"
import { userApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/types"
import { Phone, Info } from "lucide-react"

/**
 * Backend updateProfile only accepts: name, avatarUrl, privacySettings, accessibility.
 * Phone updates go through /auth/phone/send-code + /auth/phone/verify-code (separate flow).
 * Bio is not in the backend User model.
 */
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileEditFormProps {
  user: User
  onCancel: () => void
  onSave: () => void
}

export function ProfileEditForm({ user, onCancel, onSave }: ProfileEditFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { refreshUser } = useAuth()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.username || "",
      avatarUrl: user.avatar || "",
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsLoading(true)
      const payload: Parameters<typeof userApi.updateProfile>[0] = {}
      if (data.name) payload.name = data.name
      if (data.avatarUrl) payload.avatarUrl = data.avatarUrl

      await userApi.updateProfile(payload)
      await refreshUser()
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      })
      onSave()
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl text-[#0E0B08]">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Avatar display */}
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 rounded-xl flex-shrink-0" style={{ border: "2px solid rgba(201,146,42,0.3)" }}>
              <AvatarImage src={user.avatar || "/placeholder.svg"} />
              <AvatarFallback
                className="rounded-xl font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2A5240, #1E3D2F)" }}
              >
                {(user.username || user.email || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-[#0E0B08]">{user.email || "No email"}</p>
              <p className="text-xs text-[#0E0B08]/50">Account email (not editable here)</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-[#0E0B08]">Display Name</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Your full name"
              className="mt-1"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          {/* Avatar URL */}
          <div>
            <Label htmlFor="avatarUrl" className="text-sm font-medium text-[#0E0B08]">Avatar URL</Label>
            <Input
              id="avatarUrl"
              type="url"
              {...register("avatarUrl")}
              placeholder="https://example.com/your-photo.jpg"
              className="mt-1"
            />
            {errors.avatarUrl && <p className="text-xs text-red-600 mt-1">{errors.avatarUrl.message}</p>}
          </div>

          {/* Phone note */}
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl"
            style={{ background: "rgba(201,146,42,0.06)", border: "1px solid rgba(201,146,42,0.15)" }}
          >
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#C9922A" }} />
            <div>
              <p className="text-xs font-semibold text-[#0E0B08]">Phone / M-Pesa</p>
              <p className="text-xs text-[#0E0B08]/60 mt-0.5">
                {user.phone
                  ? `Current: ${user.phone}. `
                  : "No phone linked. "}
                Phone verification is managed separately via the security settings.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={isLoading}
              className="font-semibold hover:opacity-90"
              style={{ background: "#C9922A", color: "#0E0B08" }}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
