"use client"

import type React from "react"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/types"
import { Upload } from "lucide-react"

const profileSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  bio: z.string().max(500).optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileEditFormProps {
  user: User
  onCancel: () => void
  onSave: () => void
}

export function ProfileEditForm({ user, onCancel, onSave }: ProfileEditFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const { updateUser } = useAuth()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user.username || "",
      email: user.email || "",
      bio: user.bio || "",
    },
  })

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = () => setAvatarPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsLoading(true)

      // Create FormData for file upload if avatar is selected
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.append(key, value)
      })

      if (avatarFile) {
        formData.append("avatar", avatarFile)
      }

      const updatedUser = await apiClient.updateProfile(data)
      updateUser(updatedUser)

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
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarPreview || user.avatar} />
              <AvatarFallback>{user.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar" className="cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                  <Upload className="h-4 w-4" />
                  Change Avatar
                </div>
              </Label>
              <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
          </div>

          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...register("username")} placeholder="Enter your username" />
            {errors.username && <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="Enter your email" />
            {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" {...register("bio")} placeholder="Tell us about yourself" rows={3} />
            {errors.bio && <p className="text-sm text-red-600 mt-1">{errors.bio.message}</p>}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
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
