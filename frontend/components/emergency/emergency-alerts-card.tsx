"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { emergencyApi, type EmergencyAlertDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"

const SEVERITY_CONFIG: Record<
  EmergencyAlertDto["severity"],
  { bg: string; color: string; label: string }
> = {
  CRITICAL: { bg: "rgba(176,58,30,0.12)", color: "#B03A1E", label: "Critical" },
  HIGH:     { bg: "rgba(201,146,42,0.15)", color: "#C9722A", label: "High" },
  MEDIUM:   { bg: "rgba(30,61,47,0.1)",   color: "#1E3D2F", label: "Medium" },
  LOW:      { bg: "rgba(26,18,11,0.06)",   color: "rgba(14,11,8,0.4)", label: "Low" },
}

const TYPE_LABELS: Record<EmergencyAlertDto["emergencyType"], string> = {
  FIRE:     "🔥 Fire",
  FLOOD:    "🌊 Flood",
  MEDICAL:  "🏥 Medical",
  SECURITY: "🛡️ Security",
  ACCIDENT: "⚠️ Accident",
  OTHER:    "⚡ Emergency",
}

function AlertRow({ alert }: { alert: EmergencyAlertDto }) {
  const sev = SEVERITY_CONFIG[alert.severity]
  return (
    <div
      className="flex items-center gap-2.5 py-2 border-b last:border-0"
      style={{ borderColor: "rgba(26,18,11,0.06)" }}
    >
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0"
        style={{ background: sev.bg, color: sev.color }}
      >
        {sev.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#0E0B08] truncate leading-tight">
          {TYPE_LABELS[alert.emergencyType]}
        </p>
        <p className="text-[11px] text-[#0E0B08]/45 truncate leading-tight">{alert.description}</p>
      </div>
      <span className="text-[10px] text-[#0E0B08]/35 flex-shrink-0">
        {new Date(alert.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
      </span>
    </div>
  )
}

export function EmergencyAlertsCard() {
  const { isAuthenticated } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ["emergency-alerts"],
    queryFn: () => emergencyApi.listAlerts({ status: "ACTIVE", limit: 5 }),
    staleTime: 2 * 60_000,
  })

  const alerts = data?.alerts ?? []

  if (!isAuthenticated) return null

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#B03A1E" }} />
            Ward Alerts
          </span>
          {alerts.length > 0 && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "rgba(176,58,30,0.12)", color: "#B03A1E" }}
            >
              {alerts.length} active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-[12px] py-2" style={{ color: "rgba(14,11,8,0.40)" }}>
            No active alerts — your ward is clear.
          </p>
        ) : (
          <div>
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
