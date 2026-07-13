"use client"

import { Users, Info, Check, ThumbsUp, Swords, HelpCircle, Construction, Star, Wrench, PencilLine, Lightbulb, HeartHandshake } from "lucide-react"
import type { BarazaDeliberationDto } from "@/lib/api"
import { ConflictMapGraph } from "./conflict-map-graph"

interface BarazaDeliberationCardProps {
  deliberation: BarazaDeliberationDto | null | undefined
  // When the viewer is the proposal's author and the proposal can still change
  // (DRAFT / PENDING_REVIEW), the council's open questions are surfaced as a
  // gentle "strengthen this" nudge rather than a read-only list.
  isCreator?: boolean
  editable?: boolean
}

// Plain-language readiness labels (the engine's bands, said simply).
const BAND: Record<string, { label: string; color: string; bg: string }> = {
  READY:                { label: "Looks solid",        color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
  CONDITIONAL:          { label: "Needs some changes", color: "#7A4F1E", bg: "rgba(201,146,42,0.12)" },
  SIGNIFICANT_CONCERNS: { label: "Needs work",         color: "#B05A1E", bg: "rgba(176,90,30,0.12)" },
  NOT_READY:            { label: "Not ready yet",      color: "#B03A1E", bg: "rgba(176,58,30,0.12)" },
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []
}

/**
 * Read-only, plain-language summary of the 7-agent Baraza review for a proposal.
 * Renders nothing until a completed deliberation exists.
 */
export function BarazaDeliberationCard({ deliberation, isCreator = false, editable = false }: BarazaDeliberationCardProps) {
  if (!deliberation) return null

  const map = deliberation.conflictMap ?? {}
  const band = deliberation.readinessBand
    ? (BAND[deliberation.readinessBand] ?? { label: deliberation.readinessBand, color: "#0A1F14", bg: "rgba(14,11,8,0.06)" })
    : null
  const score = deliberation.readinessScore

  const agreed = asList(map.consensus)
  const open = asList(map.unresolved)
  const sharedConcerns = (map.coalitions ?? []).map((c) => c.sharedConcern || (c.agents ?? []).join(", ")).filter(Boolean)
  const tensions = (map.conflicts ?? []).map((c) => c.issue || (c.between ?? []).join(" vs ")).filter(Boolean)
  const blockers = map.chokepoints ?? []
  const topConcerns = asList(deliberation.mkutanoConvergence)
  const changes = asList(deliberation.revisionSuggestions)

  // Author-facing nudge: the questions/changes worth addressing while the
  // proposal can still be improved. Suggested changes first (most actionable),
  // then anything still unanswered; deduped and capped so it stays inviting.
  const nudgeItems = (() => {
    const seen = new Set<string>()
    return [...changes, ...open]
      .filter((t) => {
        const k = t.trim().toLowerCase()
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, 5)
  })()
  const showNudge = isCreator && editable && nudgeItems.length > 0

  const Section = ({ icon: Icon, label, color, children }: {
    icon: typeof Check; label: string; color: string; children: React.ReactNode
  }) => (
    <div className="rounded-xl p-3" style={{ background: "rgba(14,11,8,0.03)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <p className="text-[12px] font-bold" style={{ color }}>{label}</p>
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

  const sevWord = (s?: string) =>
    s ? ({ HIGH: "big issue", MEDIUM: "worth sorting", LOW: "minor" }[s.toUpperCase()] ?? s.toLowerCase()) : null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
    >
      {/* Header + readiness */}
      <div className="flex items-center justify-between gap-2 px-4 md:px-5 pt-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "#C9922A" }} />
          <h2 className="text-sm font-bold text-[#0A1F14]">Baraza review</h2>
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

      {/* Plain-language explainer + the "AI never decides" contract */}
      <div
        className="mx-4 md:mx-5 mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
        style={{ background: "rgba(42,107,124,0.06)", border: "1px solid rgba(42,107,124,0.15)" }}
      >
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#2A6B7C" }} />
        <p className="text-[11px] leading-snug" style={{ color: "rgba(14,11,8,0.6)" }}>
          A panel of AI helpers read this proposal before the vote and noted what looks strong and what needs work. It's here to help you decide — <strong>it does not decide</strong>. Your vote is what counts.
        </p>
      </div>

      {/* Author nudge — only while the proposal can still change */}
      {showNudge && (
        <div
          className="mx-4 md:mx-5 mt-2 rounded-lg px-3 py-2.5"
          style={{ background: "rgba(201,146,42,0.10)", border: "1px solid rgba(201,146,42,0.30)" }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#7A4F1E" }} />
            <p className="text-[12px] font-bold" style={{ color: "#7A4F1E" }}>Strengthen your proposal before it goes further</p>
          </div>
          <p className="text-[11px] leading-snug mb-1.5" style={{ color: "rgba(14,11,8,0.6)" }}>
            It's still a draft — addressing these now (in your reasoning below, or by resubmitting) will help it through review and the vote. Optional.
          </p>
          <ul className="space-y-1">
            {nudgeItems.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug" style={{ color: "rgba(14,11,8,0.82)" }}>
                <span style={{ color: "#7A4F1E" }}>•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 md:px-5 py-4 space-y-3">
        {((map.conflicts?.length ?? 0) > 0 || (map.coalitions?.length ?? 0) > 0) && (
          <div className="pb-1">
            <ConflictMapGraph coalitions={map.coalitions} conflicts={map.conflicts} />
          </div>
        )}

        {agreed.length > 0 && (
          <Section icon={Check} label="What's widely agreed" color="#1A6B3C">
            <Bullets items={agreed} color="#1A6B3C" />
          </Section>
        )}

        {sharedConcerns.length > 0 && (
          <Section icon={ThumbsUp} label="Concerns that come up a lot" color="#2A6B7C">
            <Bullets items={sharedConcerns} color="#2A6B7C" />
          </Section>
        )}

        {tensions.length > 0 && (
          <Section icon={Swords} label="Trade-offs to weigh" color="#B03A1E">
            <Bullets items={tensions} color="#B03A1E" />
          </Section>
        )}

        {open.length > 0 && (
          <Section icon={HelpCircle} label="Still unanswered" color="#7A4F1E">
            <Bullets items={open} color="#7A4F1E" />
          </Section>
        )}

        {/* Values check (Kadere) — advisory read on fit with the community's declared
            values. Prominent only when it flagged a tension; a quiet note otherwise. */}
        {deliberation.kadere?.reading && (
          deliberation.kadere.hasTension ? (
            <Section icon={HeartHandshake} label="Values check" color="#7A4F1E">
              <p className="text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>
                {deliberation.kadere.reading}
              </p>
              {deliberation.kadere.closing && (
                <p className="text-[12.5px] leading-snug mt-1.5" style={{ color: "rgba(14,11,8,0.6)" }}>
                  <span className="font-semibold">After discussion:</span> {deliberation.kadere.closing}
                </p>
              )}
            </Section>
          ) : (
            <div className="flex items-start gap-1.5 text-[12.5px]" style={{ color: "rgba(14,11,8,0.7)" }}>
              <HeartHandshake className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#1A6B3C" }} />
              <span><strong>Values check:</strong> {deliberation.kadere.reading}</span>
            </div>
          )
        )}

        {blockers.length > 0 && (
          <Section icon={Construction} label="What could hold this back" color="#B05A1E">
            <div className="space-y-2.5">
              {blockers.map((c, i) => {
                const sev = sevWord(c.severity)
                return (
                  <div key={i}>
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: "rgba(14,11,8,0.85)" }}>
                      {c.location ?? "Unspecified"}
                      {sev ? <span className="font-normal" style={{ color: "#B05A1E" }}> — {sev}</span> : null}
                    </p>
                    <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: "rgba(14,11,8,0.65)" }}>
                      {c.routeAround ? <><span className="font-semibold">How to get past it:</span> {c.routeAround}</> : "No clear way around it yet."}
                    </p>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {topConcerns.length > 0 && (
          <Section icon={Star} label="The most important things to fix" color="#1A6B3C">
            <Bullets items={topConcerns} color="#1A6B3C" />
          </Section>
        )}

        {deliberation.mkutanoFixability && (
          <div className="flex items-start gap-1.5 text-[12.5px]" style={{ color: "rgba(14,11,8,0.7)" }}>
            <Wrench className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7A4F1E" }} />
            <span><strong>Can these be fixed?</strong> {deliberation.mkutanoFixability}</span>
          </div>
        )}

        {changes.length > 0 && (
          <Section icon={PencilLine} label="Suggested changes before voting" color="#7A4F1E">
            <ol className="space-y-1 list-decimal list-inside">
              {changes.map((s, i) => (
                <li key={i} className="text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>{s}</li>
              ))}
            </ol>
          </Section>
        )}
      </div>
    </div>
  )
}
