"use client"

/**
 * @file app/emergency/page.tsx
 *
 * Ward Emergency Alerts page.
 *
 * Features:
 * - Browse active / all / my alerts with type + severity filters
 * - Report a new emergency (pre-fills ward from membership)
 * - Update status on own alerts (ACTIVE → IN_PROGRESS / RESOLVED / FALSE_ALARM)
 * - Respond to alerts (ward admin / verifiers — gracefully hidden otherwise)
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  emergencyApi,
  communityApi,
  type EmergencyAlertDto,
} from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useSectionTour } from "@/hooks/use-section-tour"
import { emergencyTour } from "@/lib/tours"
import { TourButton } from "@/components/onboarding/tour-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  Flame,
  Droplets,
  HeartPulse,
  ShieldAlert,
  Car,
  Zap,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────

type AlertStatus = "ACTIVE" | "IN_PROGRESS" | "RESOLVED" | "FALSE_ALARM"
type AlertType   = EmergencyAlertDto["emergencyType"]
type Severity    = EmergencyAlertDto["severity"]

const TYPE_CONFIG: Record<AlertType, { label: string; Icon: React.ElementType; color: string }> = {
  FIRE:     { label: "Fire",      Icon: Flame,      color: "#B03A1E" },
  FLOOD:    { label: "Flood",     Icon: Droplets,   color: "#1E3D8F" },
  MEDICAL:  { label: "Medical",   Icon: HeartPulse, color: "#B03A1E" },
  SECURITY: { label: "Security",  Icon: ShieldAlert,color: "#1E3D2F" },
  ACCIDENT: { label: "Accident",  Icon: Car,        color: "#C9922A" },
  OTHER:    { label: "Emergency", Icon: Zap,        color: "#888"    },
}

const SEVERITY_CONFIG: Record<Severity, { bg: string; color: string; label: string }> = {
  CRITICAL: { bg: "rgba(176,58,30,0.12)",  color: "#B03A1E", label: "Critical" },
  HIGH:     { bg: "rgba(201,146,42,0.15)", color: "#C9722A", label: "High"     },
  MEDIUM:   { bg: "rgba(30,61,47,0.1)",    color: "#1E3D2F", label: "Medium"   },
  LOW:      { bg: "rgba(14,11,8,0.07)",    color: "rgba(14,11,8,0.45)", label: "Low" },
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string; Icon: React.ElementType }> = {
  ACTIVE:      { bg: "rgba(176,58,30,0.1)",  color: "#B03A1E", label: "Active",      Icon: AlertTriangle },
  IN_PROGRESS: { bg: "rgba(201,146,42,0.1)", color: "#C9922A", label: "In Progress", Icon: Clock         },
  RESOLVED:    { bg: "rgba(30,61,47,0.1)",   color: "#1E3D2F", label: "Resolved",    Icon: CheckCircle2  },
  FALSE_ALARM: { bg: "rgba(14,11,8,0.07)",   color: "rgba(14,11,8,0.4)", label: "False Alarm", Icon: XCircle },
}

const ALERT_TYPES: AlertType[] = ["FIRE", "FLOOD", "MEDICAL", "SECURITY", "ACCIDENT", "OTHER"]
const SEVERITIES: Severity[]   = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

// ── Report modal ──────────────────────────────────────────

function ReportModal({
  open,
  onClose,
  wardId,
  wardName,
}: {
  open: boolean
  onClose: () => void
  wardId:  string | null
  wardName: string | null
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [type,        setType]        = useState<AlertType>("MEDICAL")
  const [description, setDescription] = useState("")

  const mutation = useMutation({
    mutationFn: () => emergencyApi.reportEmergency({
      type,
      description,
      locationWardId: wardId!,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-alerts"] })
      toast({ title: "Emergency reported", description: "Ward authorities have been notified." })
      setDescription("")
      onClose()
    },
    onError: (err: any) => {
      toast({ title: "Failed to report", description: err?.message ?? "Try again.", variant: "destructive" })
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[440px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" style={{ color: "#B03A1E" }} />
            Report Emergency
          </DialogTitle>
          {wardName && (
            <p className="text-xs text-[#0E0B08]/50 mt-0.5">Ward: {wardName}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold text-[#0E0B08]/60 mb-2">Emergency type</p>
            <div className="grid grid-cols-3 gap-2">
              {ALERT_TYPES.map((t) => {
                const cfg = TYPE_CONFIG[t]
                const active = type === t
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className="flex flex-col items-center gap-1 rounded-xl p-3 transition-all"
                    style={{
                      border:     `2px solid ${active ? cfg.color : "rgba(14,11,8,0.1)"}`,
                      background: active ? `${cfg.color}18` : "transparent",
                    }}
                  >
                    <cfg.Icon className="h-5 w-5" style={{ color: cfg.color }} />
                    <span className="text-[10px] font-semibold text-[#0E0B08]">{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-[#0E0B08]">Description</label>
            <textarea
              rows={4}
              placeholder="Describe the emergency — location, what happened, who is affected…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B03A1E]/20 resize-none"
            />
          </div>

          {!wardId && (
            <p className="text-xs text-[#B03A1E] font-semibold">
              Complete community verification to report emergencies in your ward.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!wardId || description.trim().length < 10 || mutation.isPending}
              className="flex-1 h-11 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "#B03A1E", color: "#fff" }}
            >
              {mutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Reporting…</>
                : <><AlertTriangle className="h-4 w-4" /> Report</>
              }
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Alert card ────────────────────────────────────────────

function AlertCard({ alert, currentUserId }: { alert: EmergencyAlertDto; currentUserId?: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [respondMsg, setRespondMsg] = useState("")

  const typeCfg   = TYPE_CONFIG[alert.emergencyType]
  const sevCfg    = SEVERITY_CONFIG[alert.severity]
  const statusCfg = STATUS_CONFIG[alert.status] ?? STATUS_CONFIG.ACTIVE

  const isOwner = currentUserId === alert.reporterId
  const isOpen  = alert.status === "ACTIVE" || alert.status === "IN_PROGRESS"

  const statusMutation = useMutation({
    mutationFn: (status: "IN_PROGRESS" | "RESOLVED" | "FALSE_ALARM") =>
      emergencyApi.updateAlertStatus(alert.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-alerts"] })
      toast({ title: "Status updated" })
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err?.message, variant: "destructive" })
    },
  })

  const respondMutation = useMutation({
    mutationFn: () => emergencyApi.respondToEmergency(alert.id, respondMsg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-alerts"] })
      toast({ title: "Response sent" })
      setRespondMsg("")
    },
    onError: (err: any) => {
      toast({ title: "Response failed", description: err?.message, variant: "destructive" })
    },
  })

  return (
    <Card className="border-0 shadow-sm" style={{ border: "1px solid rgba(14,11,8,0.07)" }}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${typeCfg.color}14` }}
          >
            <typeCfg.Icon className="h-5 w-5" style={{ color: typeCfg.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: sevCfg.bg, color: sevCfg.color }}
              >
                {sevCfg.label}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: statusCfg.bg, color: statusCfg.color }}
              >
                <statusCfg.Icon className="h-2.5 w-2.5" />
                {statusCfg.label}
              </span>
              <span className="text-[10px] text-[#0E0B08]/35 ml-auto flex-shrink-0">
                {new Date(alert.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </span>
            </div>

            <p className="text-sm font-semibold text-[#0E0B08] mt-1">{typeCfg.label}</p>
            <p className="text-xs text-[#0E0B08]/55 mt-0.5 line-clamp-2">{alert.description}</p>

            {alert.reporter?.name && (
              <p className="text-[10px] text-[#0E0B08]/35 mt-1">Reported by {alert.reporter.name}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "rgba(14,11,8,0.06)" }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {expanded ? "Hide" : "Respond"}
            {(alert._count?.responses ?? 0) > 0 && (
              <span className="ml-1 text-[10px] text-[#0E0B08]/40">({alert._count?.responses})</span>
            )}
          </button>

          {/* Owner status controls */}
          {isOwner && isOpen && (
            <>
              {alert.status === "ACTIVE" && (
                <button
                  onClick={() => statusMutation.mutate("IN_PROGRESS")}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: "rgba(201,146,42,0.1)", color: "#C9922A" }}
                >
                  <Clock className="h-3.5 w-3.5" /> In Progress
                </button>
              )}
              <button
                onClick={() => statusMutation.mutate("RESOLVED")}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: "rgba(30,61,47,0.1)", color: "#1E3D2F" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
              </button>
              <button
                onClick={() => statusMutation.mutate("FALSE_ALARM")}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-40 ml-auto"
                style={{ color: "rgba(14,11,8,0.35)" }}
              >
                <XCircle className="h-3.5 w-3.5" /> False alarm
              </button>
            </>
          )}
        </div>

        {/* Respond form */}
        {expanded && (
          <div className="mt-3 space-y-2">
            <textarea
              rows={2}
              placeholder="Add a response or update for the community…"
              value={respondMsg}
              onChange={(e) => setRespondMsg(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3D2F]/20 resize-none"
            />
            <button
              onClick={() => respondMutation.mutate()}
              disabled={respondMsg.trim().length < 5 || respondMutation.isPending}
              className="h-9 px-4 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: "#1E3D2F", color: "#fff" }}
            >
              {respondMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
              Send response
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────

type TabKey = "active" | "all" | "mine"

export default function EmergencyPage() {
  const { user } = useAuth()
  const { replay: replayTour } = useSectionTour(emergencyTour.key, emergencyTour.steps)
  const [tab,          setTab]          = useState<TabKey>("active")
  const [typeFilter,   setTypeFilter]   = useState<string>("")
  const [reportOpen,   setReportOpen]   = useState(false)
  const [page,         setPage]         = useState(1)

  // Get user's ward group for reporting
  const { data: memberships } = useQuery({
    queryKey: ["my-groups"],
    queryFn:  communityApi.getMyGroups,
    staleTime: 60_000,
    enabled:  !!user,
  })
  const wardGroup = memberships?.find((m) => m.isSystem && m.systemType === "WARD")

  // Build query params per tab
  const queryParams = {
    active: { status: "ACTIVE",  limit: 15, page },
    all:    { limit: 15, page, ...(typeFilter ? { type: typeFilter } : {}) },
    mine:   { limit: 15, page },
  }

  const { data, isLoading } = useQuery({
    queryKey: ["emergency-alerts", tab, typeFilter, page],
    queryFn:  () => emergencyApi.listAlerts(queryParams[tab]),
    staleTime: 30_000,
  })

  const alerts     = data?.alerts ?? []
  const totalPages = data?.pagination.totalPages ?? 1

  // Filter "mine" client-side (API doesn't have userId filter)
  const displayed = tab === "mine"
    ? alerts.filter((a) => a.reporterId === user?.id)
    : alerts

  function handleTabChange(t: TabKey) {
    setTab(t)
    setPage(1)
    setTypeFilter("")
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-3xl text-[#0E0B08]">Emergency Alerts</h2>
          <p className="text-sm text-[#0E0B08]/50 mt-1">
            Report and track emergencies in your ward community.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TourButton onClick={replayTour} />
          <button
            onClick={() => setReportOpen(true)}
            data-tour="emergency-report"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "#B03A1E", color: "#fff" }}
          >
            <Plus className="h-4 w-4" />
            Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(14,11,8,0.06)" }}>
        {(["active", "all", "mine"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className="flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all"
            style={{
              background: tab === t ? "#fff" : "transparent",
              color:      tab === t ? "#0E0B08" : "rgba(14,11,8,0.45)",
              boxShadow:  tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t === "active" ? "Active" : t === "mine" ? "My Reports" : "All"}
          </button>
        ))}
      </div>

      {/* Type filter (all tab only) */}
      {tab === "all" && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter("")}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
            style={{
              background: !typeFilter ? "#1E3D2F" : "rgba(14,11,8,0.07)",
              color:      !typeFilter ? "#fff"     : "rgba(14,11,8,0.55)",
            }}
          >
            All types
          </button>
          {ALERT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(typeFilter === t ? "" : t); setPage(1) }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: typeFilter === t ? TYPE_CONFIG[t].color : "rgba(14,11,8,0.07)",
                color:      typeFilter === t ? "#fff" : "rgba(14,11,8,0.55)",
              }}
            >
              {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      )}

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <Card className="border-0 shadow-card text-center py-14">
          <CardContent>
            <AlertTriangle className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(14,11,8,0.12)" }} />
            <p className="text-sm font-semibold text-[#0E0B08]/50">
              {tab === "active" ? "No active alerts — your ward is clear." :
               tab === "mine"   ? "You haven't reported any emergencies." :
                                  "No alerts found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-tour="emergency-list">
          {displayed.map((alert) => (
            <AlertCard key={alert.id} alert={alert} currentUserId={user?.id} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-30"
            style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-xs text-[#0E0B08]/40">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-30"
            style={{ background: "rgba(14,11,8,0.06)", color: "#0E0B08" }}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Report modal */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        wardId={wardGroup?.ward?.id ?? null}
        wardName={wardGroup?.ward?.name ?? null}
      />
    </div>
  )
}
