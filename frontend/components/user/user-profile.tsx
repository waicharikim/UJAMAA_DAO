"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Edit, Settings, Award, Coins, MapPin, Briefcase } from "lucide-react"
import { ProfileEditForm } from "./profile-edit-form"
import { PrivacySettings } from "./privacy-settings"

export function UserProfile() {
  const { user, isAuthenticated } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [showPrivacySettings, setShowPrivacySettings] = useState(false)

  if (!isAuthenticated || !user) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="p-8 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(201,146,42,0.1)" }}
          >
            <Award className="h-5 w-5" style={{ color: "#C9922A" }} />
          </div>
          <p className="text-sm text-[#0E0B08]/60">Sign in to view your profile</p>
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

  const verificationLabel =
    user.verificationLevel === "FULL_VERIFIED" ? "Full Verified"
    : user.verificationLevel === "COMMUNITY_VERIFIED" ? "Community Verified"
    : user.verificationLevel === "PHONE_VERIFIED" ? "Phone Verified"
    : user.verificationLevel === "EMAIL_VERIFIED" ? "Email Verified"
    : "Unverified"

  return (
    <Card className="border-0 shadow-card overflow-hidden">
      {/* Gold accent top strip */}
      <div className="h-1" style={{ background: "linear-gradient(to right, #C9922A, #E8B84B)" }} />

      <CardHeader className="flex flex-row items-start justify-between pb-4 pt-5 px-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 rounded-xl flex-shrink-0" style={{ border: "2px solid rgba(201,146,42,0.3)" }}>
            <AvatarImage src={user.avatar || "/placeholder.svg"} />
            <AvatarFallback
              className="rounded-xl font-bold text-white text-lg"
              style={{ background: "linear-gradient(135deg, #2A5240, #1E3D2F)" }}
            >
              {(user.username || user.email || "U")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-display font-bold text-lg text-[#0E0B08] leading-tight">
              {user.username || "Community Member"}
            </h3>
            <p className="text-xs text-[#0E0B08]/50 mt-0.5">{user.email || ""}</p>
            <Badge
              className="mt-1 text-[10px] font-semibold px-2 py-0.5"
              style={{ background: "rgba(30,61,47,0.1)", color: "#1E3D2F", border: "none" }}
            >
              {verificationLabel}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg hover:bg-[rgba(201,146,42,0.08)]"
            onClick={() => setShowPrivacySettings(true)}
          >
            <Settings className="h-4 w-4 text-[#0E0B08]/50" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg hover:bg-[rgba(201,146,42,0.08)]"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="h-4 w-4 text-[#0E0B08]/50" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-4">
        {/* Token stats */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background: "rgba(201,146,42,0.06)", border: "1px solid rgba(201,146,42,0.12)" }}
          >
            <Award className="h-4 w-4 flex-shrink-0" style={{ color: "#C9922A" }} />
            <div>
              <p className="text-[18px] font-bold text-[#0E0B08] leading-none">{user.impactPoints?.global ?? 0}</p>
              <p className="text-[10px] text-[#0E0B08]/50 mt-0.5">Impact Points</p>
            </div>
          </div>
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background: "rgba(30,61,47,0.06)", border: "1px solid rgba(30,61,47,0.12)" }}
          >
            <Coins className="h-4 w-4 flex-shrink-0" style={{ color: "#1E3D2F" }} />
            <div>
              <p className="text-[18px] font-bold text-[#0E0B08] leading-none">{user.tokenBalance ?? 0}</p>
              <p className="text-[10px] text-[#0E0B08]/50 mt-0.5">PR Balance</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-1">About</p>
            <p className="text-sm text-[#0E0B08]/70">{user.bio}</p>
          </div>
        )}

        {/* Location */}
        {(user.residenceCounty || user.residenceConstituency) && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#C9922A" }} />
            <p className="text-xs text-[#0E0B08]/60">
              {[user.residenceConstituency, user.residenceCounty].filter(Boolean).join(", ")}
            </p>
          </div>
        )}

        {/* Industry */}
        {user.industry && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#C9922A" }} />
            <p className="text-xs text-[#0E0B08]/60">{user.industry}</p>
          </div>
        )}

        {/* Roles */}
        {user.roles && user.roles.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0E0B08]/40 mb-2">Roles</p>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <Badge
                  key={role.id}
                  className="text-[10px] font-medium px-2 py-0.5"
                  style={{ background: "rgba(201,146,42,0.1)", color: "#C9922A", border: "1px solid rgba(201,146,42,0.2)" }}
                >
                  {role.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
