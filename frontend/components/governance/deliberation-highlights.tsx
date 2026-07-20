"use client"

import { TrendingUp, ArrowUp, ArrowDown } from "lucide-react"
import type { ProposalAnnotationDto } from "@/lib/api"

interface DeliberationHighlightsProps {
  annotations: ProposalAnnotationDto[] | undefined
  topN?: number
}

const FIELD_LABEL: Record<string, string> = {
  description: "Description",
  rationale: "Rationale",
  alternatives: "Alternatives",
}

/**
 * Part A — deterministic, no AI. Surfaces the most-reacted community annotations
 * (by net score = upvotes − downvotes) next to the rationale during deliberation.
 * Works today, even with no Claude key.
 */
export function DeliberationHighlights({ annotations, topN = 3 }: DeliberationHighlightsProps) {
  if (!annotations || annotations.length === 0) return null

  // Only surface annotations the community actually reacted to.
  const ranked = [...annotations]
    .filter((a) => a.upvotes + a.downvotes > 0)
    .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    .slice(0, topN)

  if (ranked.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#fff", boxShadow: "0 1px 6px rgba(14,11,8,0.07), 0 0 0 1px rgba(14,11,8,0.04)" }}
    >
      <div className="flex items-center gap-2 px-4 md:px-5 pt-4">
        <TrendingUp className="h-4 w-4" style={{ color: "#1A6B3C" }} />
        <h2 className="text-sm font-bold text-[#0A1F14]">Most-reacted opinions</h2>
      </div>
      <p className="px-4 md:px-5 text-[11px] mt-0.5" style={{ color: "rgba(14,11,8,0.45)" }}>
        What the community is reacting to most, right now.
      </p>

      <div className="px-4 md:px-5 py-3 space-y-2">
        {ranked.map((a) => {
          const net = a.upvotes - a.downvotes
          const positive = net >= 0
          return (
            <div
              key={a.id}
              className="rounded-xl p-3"
              style={{ background: "rgba(14,11,8,0.02)", borderLeft: `3px solid ${a.color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "rgba(14,11,8,0.4)" }}>
                    {FIELD_LABEL[a.fieldKey] ?? a.fieldKey}
                    {a.author?.name ? ` · ${a.author.name}` : ""}
                  </p>
                  {a.quotedText && (
                    <p className="text-[11px] italic line-clamp-1 mb-1" style={{ color: "rgba(14,11,8,0.5)" }}>
                      “{a.quotedText}”
                    </p>
                  )}
                  <p className="text-[13px] leading-snug" style={{ color: "rgba(14,11,8,0.8)" }}>
                    {a.comment}
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    background: positive ? "rgba(26,107,60,0.08)" : "rgba(176,58,30,0.08)",
                    color: positive ? "#1A6B3C" : "#B03A1E",
                  }}
                >
                  {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(net)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
