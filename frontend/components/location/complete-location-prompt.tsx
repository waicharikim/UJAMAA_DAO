"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { MapPin, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { userApi, ApiError } from "@/lib/api"
import { WardCascade, type RefItem } from "@/components/location/ward-cascade"

/**
 * Prompts a signed-in user who has no ward to set one.
 *
 * Every member belongs to a ward — it's where their posts land, their vote
 * counts, and their dues go. A ward is normally chosen at registration, but a
 * user can land here without one (e.g. they registered before selecting, or a
 * historic data issue cleared it). This is an INITIAL set; the backend rejects
 * it if a ward already exists, so it can't be used to hop wards.
 */
export function CompleteLocationPrompt() {
  const { isAuthenticated, isLoading, user, refreshUser } = useAuth()
  const queryClient = useQueryClient()

  const [counties, setCounties] = useState<RefItem[]>([])
  const [addRoots, setAddRoots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [dismissed, setDismissed] = useState(false)

  const [home, setHome] = useState({ countyId: "", constituencyId: "", wardId: "" })
  const [roots, setRoots] = useState({ countyId: "", constituencyId: "", wardId: "" })

  const needsLocation =
    isAuthenticated && !isLoading && !!user && !user.primaryWardId
  const open = needsLocation && !dismissed

  useEffect(() => {
    if (!open || counties.length > 0) return
    userApi.getCounties().then(setCounties).catch(() => {})
  }, [open, counties.length])

  const handleSubmit = async () => {
    if (!home.wardId) return
    setError("")
    setSubmitting(true)
    try {
      await userApi.setLocation({
        primaryWardId: home.wardId,
        secondaryWardId: addRoots && roots.wardId ? roots.wardId : undefined,
      })
      await refreshUser()
      // Membership + feed now reflect the new ward.
      queryClient.invalidateQueries()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={(o) => !o && setDismissed(true)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-1"
            style={{ background: "rgba(212,145,30,0.12)" }}
          >
            <MapPin className="h-5 w-5" style={{ color: "#D4911E" }} />
          </div>
          <DialogTitle className="font-serif text-2xl" style={{ color: "#1D4731" }}>
            Where's your community?
          </DialogTitle>
          <DialogDescription>
            Pick the ward where you live. It's your home community — where your
            posts appear, your vote counts, and your dues go. You'll be enrolled
            in its governance groups automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <WardCascade
            heading="Your home community"
            countyId={home.countyId}
            constituencyId={home.constituencyId}
            wardId={home.wardId}
            counties={counties}
            onCountyChange={(v) => setHome((p) => ({ ...p, countyId: v }))}
            onConstituencyChange={(v) => setHome((p) => ({ ...p, constituencyId: v }))}
            onWardChange={(v) => setHome((p) => ({ ...p, wardId: v }))}
          />

          {addRoots ? (
            <WardCascade
              heading="Where you're originally from (optional)"
              countyId={roots.countyId}
              constituencyId={roots.constituencyId}
              wardId={roots.wardId}
              counties={counties}
              onCountyChange={(v) => setRoots((p) => ({ ...p, countyId: v }))}
              onConstituencyChange={(v) => setRoots((p) => ({ ...p, constituencyId: v }))}
              onWardChange={(v) => setRoots((p) => ({ ...p, wardId: v }))}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddRoots(true)}
              className="text-xs font-semibold"
              style={{ color: "#D4911E" }}
            >
              + Add where you're originally from
            </button>
          )}

          {error && (
            <div
              className="text-sm rounded-md px-3 py-2"
              style={{
                color: "#C43D28",
                background: "rgba(196,61,40,0.08)",
                border: "1px solid rgba(196,61,40,0.15)",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => setDismissed(true)}
              className="flex-1"
            >
              Later
            </Button>
            <Button
              className="flex-1 text-cream"
              style={{ background: "#D4911E" }}
              onClick={handleSubmit}
              disabled={!home.wardId || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Join my community"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
