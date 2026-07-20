"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Eye } from "lucide-react"
import { agentName, agentRole } from "./conflict-map-graph"

const INK = "#0A1F14"
const TEAL = "#2A6B7C"
const GOLD = "#7A4F1E"

interface Round {
  roundNumber: number | null
  domainPositions: Record<string, string>
  shahidi: string | null
  mpelelezi: string | null
  kadere: string | null
}
interface Transcript {
  rounds: Round[]
  casting: Record<string, { lifeStage: string; exposure: string }>
  mkaguzi?: string | null
}

const MKAGUZI_AXES: Array<{ key: string; label: string }> = [
  { key: "regulatory", label: "Regulatory — bodies, permits, laws" },
  { key: "financial", label: "Financial — budget & arithmetic" },
  { key: "method", label: "Method — baseline, M&E, KPIs" },
  { key: "instruments", label: "Instruments — MoUs, licences, agreements" },
]

/** Mkaguzi's review is a JSON string {regulatory,financial,method,instruments}. */
function parseMkaguzi(raw?: string | null): Record<string, string[]> | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim())
    if (j && typeof j === "object") return j
  } catch {
    /* fall through */
  }
  return null
}

/**
 * The council's full round-by-round debate — the "under the hood" of the AI
 * deliberation. Opt-in / collapsed by default so the distilled verdict stays
 * the primary read. The per-agent casting is framed as an ANALYTICAL LENS
 * (how the council stress-tested impact across life situations), never as a
 * real member's words. (Vision-checked; see ADR.)
 */
export function DeliberationTranscript({ transcript }: { transcript?: Transcript | null }) {
  const [open, setOpen] = useState(false)
  const rounds = transcript?.rounds ?? []
  const casting = transcript?.casting ?? {}
  if (rounds.length === 0) return null

  const Analyst = ({ label, role, text }: { label: string; role: string; text: string | null }) =>
    text ? (
      <div className="mt-3">
        <div className="text-[12px] font-semibold" style={{ color: TEAL }}>
          {label} <span className="font-normal" style={{ color: "rgba(14,31,20,0.5)" }}>· {role}</span>
        </div>
        <p className="mt-1 text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: "rgba(14,31,20,0.82)" }}>
          {text.trim()}
        </p>
      </div>
    ) : null

  return (
    <div className="mt-1 border-t" style={{ borderColor: "rgba(14,31,20,0.08)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 py-3 text-left"
        style={{ color: INK }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Eye size={15} style={{ color: TEAL }} />
        <span className="text-sm font-semibold">See the full deliberation</span>
        <span className="text-[12px]" style={{ color: "rgba(14,31,20,0.5)" }}>
          — the council's round-by-round debate
        </span>
      </button>

      {open && (
        <div className="pb-4">
          {/* framing — casting is a lens, the vote is the outcome */}
          <p
            className="text-[12px] italic leading-relaxed rounded-lg px-3 py-2 mb-4"
            style={{ background: "rgba(42,107,124,0.06)", color: "rgba(14,31,20,0.7)" }}
          >
            This is the council's internal debate. Each agent stress-tests the proposal from a
            range of life situations — these are <strong>analytical lenses</strong>, not real
            members' words. A single agent's position is not the council's conclusion; the
            readiness read above and your vote remain the outcome.
          </p>

          {rounds.map((r, i) => (
            <div key={i} className="mb-5">
              <div
                className="text-[11px] font-bold uppercase tracking-wide mb-2 pb-1 border-b"
                style={{ color: GOLD, borderColor: "rgba(122,79,30,0.2)" }}
              >
                Round {r.roundNumber ?? i + 1}
              </div>

              {Object.entries(r.domainPositions ?? {}).map(([agent, text]) => {
                const lens = casting[agent]
                return (
                  <div key={agent} className="mb-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-bold" style={{ color: INK }}>
                        {agentName(agent)}
                      </span>
                      {agentRole(agent) && (
                        <span className="text-[12px]" style={{ color: "rgba(14,31,20,0.5)" }}>
                          {agentRole(agent)}
                        </span>
                      )}
                      {lens && (lens.lifeStage || lens.exposure) && (
                        <span
                          className="text-[11px] italic px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(122,79,30,0.08)", color: GOLD }}
                        >
                          lens: {[lens.lifeStage, lens.exposure].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 text-[13px] whitespace-pre-wrap leading-relaxed"
                      style={{ color: "rgba(14,31,20,0.85)" }}
                    >
                      {String(text).trim()}
                    </p>
                  </div>
                )
              })}

              <Analyst label="Shahidi" role="fact-checker" text={r.shahidi} />
              <Analyst label="Mpelelezi" role="feasibility & power" text={r.mpelelezi} />
              <Analyst label="Kadere" role="values" text={r.kadere} />
            </div>
          ))}

          {/* Mkaguzi — the once-run procedural / compliance audit */}
          {(() => {
            const m = parseMkaguzi(transcript?.mkaguzi)
            if (!m) return null
            const hasAny = MKAGUZI_AXES.some((a) => Array.isArray(m[a.key]) && m[a.key].length)
            if (!hasAny) return null
            return (
              <div className="mb-2">
                <div
                  className="text-[11px] font-bold uppercase tracking-wide mb-2 pb-1 border-b"
                  style={{ color: GOLD, borderColor: "rgba(122,79,30,0.2)" }}
                >
                  Mkaguzi — the auditor{" "}
                  <span className="font-normal normal-case" style={{ color: "rgba(14,31,20,0.5)" }}>
                    · procedural &amp; compliance due-diligence
                  </span>
                </div>
                {MKAGUZI_AXES.map((a) =>
                  Array.isArray(m[a.key]) && m[a.key].length ? (
                    <div key={a.key} className="mb-2">
                      <div className="text-[12px] font-semibold" style={{ color: TEAL }}>{a.label}</div>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        {m[a.key].map((item, i) => (
                          <li key={i} className="text-[13px] leading-relaxed" style={{ color: "rgba(14,31,20,0.82)" }}>
                            {String(item)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
