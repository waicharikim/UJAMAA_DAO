"use client"

import { ThumbsUp, AlertTriangle, HelpCircle, Sparkles, Info } from "lucide-react"

interface DeliberationSummaryData {
  support: string[]
  concerns: string[]
  openQuestions: string[]
  note?: string
}

interface DeliberationSummaryProps {
  summary: DeliberationSummaryData | null | undefined
  /** Proposal status — controls the "generating…" placeholder. */
  status: string
}

const SECTIONS = [
  { key: "support" as const,       label: "Points of support", Icon: ThumbsUp,     color: "#1A6B3C", bg: "rgba(26,107,60,0.07)"  },
  { key: "concerns" as const,      label: "Concerns raised",   Icon: AlertTriangle, color: "#B03A1E", bg: "rgba(176,58,30,0.07)"  },
  { key: "openQuestions" as const, label: "Open questions",    Icon: HelpCircle,   color: "#7A4F1E", bg: "rgba(122,79,30,0.07)"  },
]

/**
 * Neutral AI digest of the community's annotations, shown once voting opens.
 * Renders nothing when there is no summary and the proposal isn't actively
 * being summarised (e.g. AI disabled, or no annotations were made).
 */
export function DeliberationSummary({ summary, status }: DeliberationSummaryProps) {
  const isVotingPhase = ["VOTING", "APPROVED", "REJECTED", "EXECUTING", "COMPLETED"].includes(status)

  // Nothing to show, and not in a phase where a summary is expected → hide.
  if (!summary && status !== "VOTING") return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 md:px-5 pt-4">
        <Sparkles className="h-4 w-4" style={{ color: "#C9922A" }} />
        <h2 className="text-sm font-bold text-[#0A1F14]">Community deliberation</h2>
      </div>

      {/* Neutral-digest banner — the "AI never decides" contract, made visible */}
      <div
        className="mx-4 md:mx-5 mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
        style={{ background: "rgba(42,107,124,0.06)", border: "1px solid rgba(42,107,124,0.15)" }}
      >
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#2A6B7C" }} />
        <p className="text-[11px] leading-snug" style={{ color: "rgba(14,11,8,0.6)" }}>
          A neutral digest of what community members wrote — <strong>not a recommendation</strong>. The decision is your vote.
        </p>
      </div>

      <div className="px-4 md:px-5 py-4 space-y-3">
        {!summary ? (
          // VOTING but no summary yet → being generated (or no annotations / AI off)
          <p className="text-[12px]" style={{ color: "rgba(14,11,8,0.45)" }}>
            {isVotingPhase
              ? "Summarising the deliberation… check back shortly. (Appears only when the community annotated this proposal.)"
              : "No deliberation summary yet."}
          </p>
        ) : summary.note ? (
          <p className="text-[13px] whitespace-pre-line" style={{ color: "rgba(14,11,8,0.75)" }}>
            {summary.note}
          </p>
        ) : (
          SECTIONS.map(({ key, label, Icon, color, bg }) => {
            const items = summary[key] ?? []
            if (items.length === 0) return null
            return (
              <div key={key} className="rounded-xl p-3" style={{ background: bg }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
                    {label}
                  </p>
                </div>
                <ul className="space-y-1">
                  {items.map((point, i) => (
                    <li key={i} className="flex gap-1.5 text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.78)" }}>
                      <span style={{ color }}>•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}

        {summary &&
          !summary.note &&
          summary.support.length === 0 &&
          summary.concerns.length === 0 &&
          summary.openQuestions.length === 0 && (
            <p className="text-[12px]" style={{ color: "rgba(14,11,8,0.45)" }}>
              The deliberation was light — no distinct points to summarise.
            </p>
          )}
      </div>
    </div>
  )
}
