"use client"

import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { userApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, MapPin, Shield, Users, Award } from "lucide-react"

const LEVEL_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  FULL_VERIFIED:      { bg: "rgba(42,82,64,0.12)",    color: "#1E3D2F", label: "Fully verified" },
  COMMUNITY_VERIFIED: { bg: "rgba(42,82,64,0.10)",    color: "#2A5240", label: "Community verified" },
  PHONE_VERIFIED:     { bg: "rgba(201,146,42,0.12)",  color: "#C9922A", label: "Phone verified" },
  EMAIL_VERIFIED:     { bg: "rgba(14,11,8,0.07)",     color: "#0E0B08", label: "Email verified" },
  UNVERIFIED:         { bg: "rgba(14,11,8,0.05)",     color: "rgba(14,11,8,0.4)", label: "Unverified" },
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => userApi.getUserProfile(userId),
    staleTime: 60_000,
  })

  const vouchMutation = useMutation({
    mutationFn: () => {
      const wardId = currentUser?.primaryWardId
      if (!wardId) throw new Error("Your ward is not set. Complete your profile first.")
      return userApi.vouchForUser(userId, wardId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile", userId] })
      toast({ title: "Vouched!", description: "Your vouch has been recorded." })
    },
    onError: (err: any) => {
      toast({ title: "Vouch failed", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  const isSelf = currentUser?.id === userId
  const canVouch =
    !isSelf &&
    (currentUser?.verificationLevel === "COMMUNITY_VERIFIED" ||
      currentUser?.verificationLevel === "FULL_VERIFIED")

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-xl mx-auto space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-xl mx-auto">
        <p className="text-sm text-center py-12" style={{ color: "rgba(14,11,8,0.35)" }}>
          User not found.
        </p>
      </div>
    )
  }

  const levelInfo = LEVEL_COLORS[profile.verificationLevel ?? "UNVERIFIED"] ?? LEVEL_COLORS.UNVERIFIED

  return (
    <div className="px-4 md:px-8 py-6 space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-bold"
              style={{ background: "rgba(42,82,64,0.1)", color: "#1E3D2F" }}
            >
              {(profile.name ?? "?")[0]?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#0E0B08]">{profile.name ?? "Anonymous"}</h1>

              {/* Verification badge */}
              <span
                className="inline-flex items-center gap-1 mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: levelInfo.bg, color: levelInfo.color }}
              >
                <Shield className="h-3 w-3" />
                {levelInfo.label}
              </span>

              {/* Ward / location */}
              {profile.geographic?.primaryWard && (
                <p className="flex items-center gap-1 text-xs text-[#0E0B08]/50 mt-2">
                  <MapPin className="h-3 w-3" />
                  {profile.geographic.primaryWard.name}
                  {profile.geographic.primaryConstituency && `, ${profile.geographic.primaryConstituency.name}`}
                </p>
              )}
            </div>
          </div>

          {/* Vouch button — only for community-verified users vouching someone else */}
          {canVouch && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: "rgba(14,11,8,0.07)" }}>
              <p className="text-xs text-[#0E0B08]/50 mb-3">
                Do you know this person and can confirm they live in your ward?
              </p>
              <button
                onClick={() => vouchMutation.mutate()}
                disabled={vouchMutation.isPending || vouchMutation.isSuccess}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: vouchMutation.isSuccess ? "rgba(42,82,64,0.1)" : "#1E3D2F",
                  color: vouchMutation.isSuccess ? "#1E3D2F" : "#fff",
                }}
              >
                {vouchMutation.isSuccess ? (
                  <><CheckCircle className="h-4 w-4" /> Vouched</>
                ) : vouchMutation.isPending ? (
                  "Vouching…"
                ) : (
                  <><Users className="h-4 w-4" /> Vouch for {profile.name?.split(" ")[0] ?? "this person"}</>
                )}
              </button>
            </div>
          )}

          {/* If current user is not community verified, show why they can't vouch */}
          {!isSelf && !canVouch && currentUser && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(14,11,8,0.07)" }}>
              <p className="text-xs text-[#0E0B08]/40 text-center">
                You need to be community-verified to vouch for others.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {(profile.impact || profile.economic) && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#0E0B08]/60">Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {profile.impact?.global !== undefined && (
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" style={{ color: "#C9922A" }} />
                <div>
                  <p className="text-xs text-[#0E0B08]/50">Impact Points</p>
                  <p className="text-base font-bold text-[#0E0B08]">{profile.impact.global.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
