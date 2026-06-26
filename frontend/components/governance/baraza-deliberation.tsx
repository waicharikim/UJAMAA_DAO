"use client"

import { Users, Info, Check, Link2, Swords, HelpCircle, Construction, Microscope, Wrench, PencilLine } from "lucide-react"
import type { BarazaDeliberationDto } from "@/lib/api"

interface BarazaDeliberationCardProps {
  deliberation: BarazaDeliberationDto | null | undefined
}

const BAND: Record<string, { label: string; color: string; bg: string }> = {
  READY:                { label: "Ready",                color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
  CONDITIONAL:          { label: "Conditional",          color: "#7A4F1E", bg: "rgba(201,146,42,0.12)" },
  SIGNIFICANT_CONCERNS: { label: "Significant concerns", color: "#B05A1E", bg: "rgba(176,90,30,0.12)" },
  NOT_READY:            { label: "Not ready",            color: "#B03A1E", bg: "rgba(176,58,30,0.12)" },
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []
}

/**
 * Read-only record of the 7-agent Baraza deliberation (conflict map + readiness).
 * Renders nothing until a completed deliberation exists for the proposal.
 */
export function BarazaDeliberationCard({ deliberation }: BarazaDeliberationCardProps) {
  if (!deliberation) return null

  const map = deliberation.conflictMap ?? {}
  const band = deliberation.readinessBand
    ? (BAND[deliberation.readinessBand] ?? { label: deliberation.readinessBand, color: "#0A1F14", bg: "rgba(14,11,8,0.06)" })
    : null
  const score = deliberation.readinessScore

  const consensus = asList(map.consensus)
  const unresolved = asList(map.unresolved)
  const coalitions = map.coalitions ?? []
  const conflicts = map.conflicts ?? []
  const chokepoints = map.chokepoints ?? []
  const convergence = asList(deliberation.mkutanoConvergence)
  const revisions = asList(deliberation.revisionSuggestions)

  const Section = ({ icon: Icon, label, color, children }: {
    icon: typeof Check; label: string; color: string; children: React.ReactNode
  }) => (
    <div className="rounded-xl p-3" style={{ background: "rgba(14,11,8,0.03)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{label}</p>
      </div>
      {children}
    </div>
  )

  const Bullets = ({ items, color }: { items: string[]; color: string }) => (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="flex gap-1.5 text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>
          <span style={{ color }}>•</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
    >
      {/* Header + readiness */}
      <div className="flex items-center justify-between gap-2 px-4 md:px-5 pt-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "#C9922A" }} />
          <h2 className="text-sm font-bold text-[#0A1F14]">Baraza council — AI stress-test</h2>
        </div>
        {band && (
          <span
            className="text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
            style={{ color: band.color, background: band.bg }}
          >
            {band.label}{typeof score === "number" ? ` · ${score}/100` : ""}
          </span>
        )}
      </div>

      {/* Disclaimer — the "AI never decides" contract */}
      <div
        className="mx-4 md:mx-5 mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
        style={{ background: "rgba(42,107,124,0.06)", border: "1px solid rgba(42,107,124,0.15)" }}
      >
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#2A6B7C" }} />
        <p className="text-[11px] leading-snug" style={{ color: "rgba(14,11,8,0.6)" }}>
          A council of AI agents stress-tested this proposal before voting — <strong>guidance, not a verdict</strong>. The binding decision is your vote.
        </p>
      </div>

      <div className="px-4 md:px-5 py-4 space-y-3">
        {consensus.length > 0 && (
          <Section icon={Check} label="Consensus" color="#1A6B3C">
            <Bullets items={consensus} color="#1A6B3C" />
          </Section>
        )}

        {coalitions.length > 0 && (
          <Section icon={Link2} label="Coalitions" color="#2A6B7C">
            <ul className="space-y-1">
              {coalitions.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>
                  <span style={{ color: "#2A6B7C" }}>•</span>
                  <span>{(c.agents ?? []).join(" + ")}{c.sharedConcern ? ` — ${c.sharedConcern}` : ""}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {conflicts.length > 0 && (
          <Section icon={Swords} label="Conflicts" color="#B03A1E">
            <ul className="space-y-1">
              {conflicts.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>
                  <span style={{ color: "#B03A1E" }}>•</span>
                  <span>{(c.between ?? []).join(" ↔ ")}{c.issue ? `: ${c.issue}` : ""}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {unresolved.length > 0 && (
          <Section icon={HelpCircle} label="Unresolved" color="#7A4F1E">
            <Bullets items={unresolved} color="#7A4F1E" />
          </Section>
        )}

        {chokepoints.length > 0 && (
          <Section icon={Construction} label="Chokepoints" color="#B05A1E">
            <ul className="space-y-1">
              {chokepoints.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>
                  <span style={{ color: "#B05A1E" }}>•</span>
                  <span>
                    {c.severity ? `[${c.severity}] ` : ""}{c.location ?? "unspecified"}
                    {c.routeAround ? ` → route around: ${c.routeAround}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {convergence.length > 0 && (
          <Section icon={Microscope} label="Mkutano — convergence" color="#1A6B3C">
            <Bullets items={convergence} color="#1A6B3C" />
          </Section>
        )}

        {deliberation.mkutanoFixability && (
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "rgba(14,11,8,0.7)" }}>
            <Wrench className="h-3.5 w-3.5" style={{ color: "#7A4F1E" }} />
            <span><strong>Fixability:</strong> {deliberation.mkutanoFixability}</span>
          </div>
        )}

        {revisions.length > 0 && (
          <Section icon={PencilLine} label="Revision suggestions" color="#7A4F1E">
            <ol className="space-y-1 list-decimal list-inside">
              {revisions.map((s, i) => (
                <li key={i} className="text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>{s}</li>
              ))}
            </ol>
          </Section>
        )}
      </div>
    </div>
  )
}
