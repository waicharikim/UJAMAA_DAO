"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { QRCodeSVG } from "qrcode.react"
import { projectApi, type WorkSessionDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  QrCode,
  Timer,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  UserPlus,
  X,
} from "lucide-react"

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ProjectMember {
  userId: string
  user: { id: string; name: string | null; avatarUrl: string | null }
}

interface Props {
  milestoneId: string
  projectId: string
  projectMembers: ProjectMember[]
  isLeader: boolean
}

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "90 min", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
  { label: "4 hours", value: 240 },
  { label: "8 hours", value: 480 },
]

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "Expired"
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function storageKey(milestoneId: string) {
  return `ujamaa-ws-${milestoneId}`
}

// ─────────────────────────────────────────────────────────
// WorkSessionPanel
// ─────────────────────────────────────────────────────────

export function WorkSessionPanel({ milestoneId, projectId, projectMembers, isLeader }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [duration, setDuration] = useState(60)
  const [showAttest, setShowAttest] = useState(false)
  const [attestTarget, setAttestTarget] = useState("")
  const [countdown, setCountdown] = useState("")
  const [origin, setOrigin] = useState("")

  // Persist sessionId across page refreshes
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(storageKey(milestoneId))
  })

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const saveSessionId = (id: string) => {
    localStorage.setItem(storageKey(milestoneId), id)
    setSessionId(id)
  }

  const clearSessionId = () => {
    localStorage.removeItem(storageKey(milestoneId))
    setSessionId(null)
  }

  // ── Fetch session ────────────────────────────────────────
  const { data: session, isLoading: sessionLoading } = useQuery<WorkSessionDto>({
    queryKey: ["work-session", sessionId],
    queryFn: async () => {
      try {
        return await projectApi.getWorkSession(sessionId!)
      } catch (err: any) {
        if (err?.status === 404) clearSessionId()
        throw err
      }
    },
    enabled: !!sessionId,
    refetchInterval: (query) =>
      query.state.data?.status === "OPEN" ? 8_000 : false,
    staleTime: 4_000,
    retry: false,
  })

  // ── Countdown ────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "OPEN") return
    const tick = () => setCountdown(formatCountdown(session.expiresAt))
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [session?.expiresAt, session?.status])

  // ── Mutations ────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => projectApi.createWorkSession({ milestoneId, durationMinutes: duration }),
    onSuccess: (data) => {
      saveSessionId(data.sessionId)
      setShowCreateForm(false)
      toast({ title: "Work session started" })
      queryClient.invalidateQueries({ queryKey: ["work-session", data.sessionId] })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  const closeMutation = useMutation({
    mutationFn: () => projectApi.closeWorkSession(sessionId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["work-session", sessionId] })
      const approved = data.status === "APPROVED"
      toast({
        title: approved ? "Session approved ✓" : "Session flagged",
        description: approved
          ? `${data.presenceCount} member${data.presenceCount !== 1 ? "s" : ""} earned 10 IP`
          : "No direct scans recorded — review manually",
      })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  const attestMutation = useMutation({
    mutationFn: (targetUserId: string) => projectApi.attestPresence(sessionId!, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-session", sessionId] })
      setShowAttest(false)
      setAttestTarget("")
      toast({ title: "Presence attested ✓" })
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  })

  // ── Derived state ────────────────────────────────────────
  const qrUrl = origin && session?.qrSecret
    ? `${origin}/projects/scan?secret=${session.qrSecret}`
    : ""

  const myPresence = session?.presences.find((p) => p.userId === user?.id)
  const myAttestationCount = session?.presences.filter((p) => p.attestedById === user?.id).length ?? 0
  const canAttest = session?.status === "OPEN" && !!myPresence && myAttestationCount < 2
  const presentUserIds = new Set(session?.presences.map((p) => p.userId) ?? [])
  const attestableMembers = projectMembers.filter(
    (m) => !presentUserIds.has(m.userId) && m.userId !== user?.id
  )

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#1D4731] hover:opacity-80 transition-opacity"
      >
        <QrCode className="h-3.5 w-3.5" />
        Work Session
        {session?.status === "APPROVED" && (
          <CheckCircle2 className="h-3 w-3" style={{ color: "#1D4731" }} />
        )}
        {session?.status === "FLAGGED" && (
          <AlertTriangle className="h-3 w-3" style={{ color: "#C9922A" }} />
        )}
        {open ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>

      {open && (
        <div className="space-y-3 pt-1">

          {/* ── No session & leader → create form ─────────── */}
          {!sessionId && isLeader && (
            <>
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: "rgba(29,71,49,0.08)", color: "#1D4731" }}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Start Work Session
                </button>
              ) : (
                <div className="space-y-3 p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.03)" }}>
                  <p className="text-xs font-semibold text-[#0E0B08]">Session duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_OPTIONS.map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => setDuration(value)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                        style={
                          duration === value
                            ? { background: "#1D4731", color: "#fff" }
                            : { background: "rgba(0,0,0,0.07)", color: "#0E0B08" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(0,0,0,0.07)", color: "#0E0B08" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => createMutation.mutate()}
                      disabled={createMutation.isPending}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "#1D4731", color: "#fff" }}
                    >
                      {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Generate QR
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── No session & not leader → message ─────────── */}
          {!sessionId && !isLeader && (
            <p className="text-[11px] text-[#0E0B08]/45">
              No active session. Scan a QR code shown by your team leader to check in.
            </p>
          )}

          {/* ── Session loading ────────────────────────────── */}
          {sessionId && sessionLoading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D4731]" />
              <span className="text-xs text-[#0E0B08]/50">Loading session…</span>
            </div>
          )}

          {/* ── OPEN session ──────────────────────────────── */}
          {session?.status === "OPEN" && (
            <div className="space-y-3">
              {/* QR code */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                {qrUrl ? (
                  <QRCodeSVG
                    value={qrUrl}
                    size={180}
                    level="M"
                    marginSize={1}
                  />
                ) : (
                  <div className="w-[180px] h-[180px] bg-gray-100 rounded animate-pulse" />
                )}
                <p className="text-[10px] text-[#0E0B08]/40 text-center">
                  Scan with UjamaaDAO to check in
                </p>
                {/* Countdown */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
                >
                  <Timer className="h-3 w-3" />
                  {countdown || "…"}
                </div>
              </div>

              {/* Presence list */}
              {(session.presences.length > 0 || canAttest) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#0E0B08]/40">
                    Present ({session.presences.length})
                  </p>
                  {session.presences.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                      style={{ background: "rgba(0,0,0,0.025)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ background: p.depth === 0 ? "#1D4731" : "#C9922A" }}
                        >
                          {(p.userName ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0E0B08] truncate">
                            {p.userName ?? "Member"}
                          </p>
                          <p
                            className="text-[10px]"
                            style={{ color: p.depth === 0 ? "#1D4731" : "#C9922A" }}
                          >
                            {p.depth === 0 ? "Direct scan" : `Attested · chain depth ${p.depth}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Attest someone */}
                  {canAttest && attestableMembers.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => setShowAttest((v) => !v)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2A6B7C] hover:opacity-80 transition-opacity"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Attest someone ({2 - myAttestationCount} remaining)
                        {showAttest
                          ? <ChevronUp className="h-3 w-3 opacity-50" />
                          : <ChevronDown className="h-3 w-3 opacity-50" />}
                      </button>
                      {showAttest && (
                        <div className="flex gap-2">
                          <select
                            value={attestTarget}
                            onChange={(e) => setAttestTarget(e.target.value)}
                            className="flex-1 h-8 rounded-lg border border-black/10 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D4731]/30"
                          >
                            <option value="">Select team member…</option>
                            {attestableMembers.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.user.name ?? "Unknown"}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => attestMutation.mutate(attestTarget)}
                            disabled={!attestTarget || attestMutation.isPending}
                            className="flex items-center gap-1 px-3 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40"
                            style={{ background: "#1D4731", color: "#fff" }}
                          >
                            {attestMutation.isPending
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : "Attest"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Close session (leader only) */}
              {isLeader && (
                <button
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  className="flex items-center gap-2 text-[11px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: "#B03A1E" }}
                >
                  {closeMutation.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <X className="h-3 w-3" />}
                  Close session early
                </button>
              )}
            </div>
          )}

          {/* ── APPROVED session ──────────────────────────── */}
          {session?.status === "APPROVED" && (
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(29,71,49,0.08)" }}
              >
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "#1D4731" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#1D4731" }}>Session Approved</p>
                  <p className="text-[11px]" style={{ color: "#1D4731" }}>
                    {session.presences.length} member{session.presences.length !== 1 ? "s" : ""} earned 10 Impact Points
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {session.presences.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: "rgba(0,0,0,0.02)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ background: p.depth === 0 ? "#1D4731" : "#C9922A" }}
                      >
                        {(p.userName ?? "?")[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs font-medium text-[#0E0B08] truncate">
                        {p.userName ?? "Member"}
                      </p>
                    </div>
                    {p.ipAwarded && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: "#C9922A" }}>
                        <Zap className="h-2.5 w-2.5" />
                        +10 IP
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={clearSessionId}
                className="text-[11px] text-[#0E0B08]/35 hover:text-[#0E0B08]/60 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* ── FLAGGED session ───────────────────────────── */}
          {session?.status === "FLAGGED" && (
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(201,146,42,0.10)" }}
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#C9922A" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#C9922A" }}>Session Flagged</p>
                  <p className="text-[11px]" style={{ color: "#C9922A" }}>
                    No direct scans recorded — review manually
                  </p>
                </div>
              </div>
              {session.presences.length > 0 && (
                <div className="space-y-1">
                  {session.presences.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                      style={{ background: "rgba(0,0,0,0.02)" }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ background: "#7A6E60" }}
                      >
                        {(p.userName ?? "?")[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs font-medium text-[#0E0B08] truncate">
                        {p.userName ?? "Member"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={clearSessionId}
                className="text-[11px] text-[#0E0B08]/35 hover:text-[#0E0B08]/60 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
