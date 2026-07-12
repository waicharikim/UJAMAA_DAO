"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { governanceApi } from "@/lib/api"
import { BookMarked, Plus, Check, AlertTriangle, X } from "lucide-react"

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "confirmed", color: "#1A6B3C", bg: "rgba(26,107,60,0.10)" },
  pending: { label: "pending review", color: "#7A4F1E", bg: "rgba(201,146,42,0.12)" },
  disputed: { label: "disputed", color: "#B03A1E", bg: "rgba(176,58,30,0.12)" },
}

export function OurStoryTab({
  groupId,
  canRatify = false,
  canPropose = false,
}: {
  groupId: string
  canRatify?: boolean
  canPropose?: boolean
}) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [year, setYear] = useState("")

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["group-history", groupId],
    queryFn: () => governanceApi.listHistory(groupId),
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["group-history", groupId] })

  const propose = useMutation({
    mutationFn: () =>
      governanceApi.proposeHistory({
        groupId,
        title: title.trim(),
        summary: summary.trim(),
        startYear: year ? Number(year) : undefined,
      }),
    onSuccess: () => {
      setTitle("")
      setSummary("")
      setYear("")
      setShowForm(false)
      invalidate()
    },
  })

  const ratify = useMutation({
    mutationFn: (v: { id: string; action: "confirm" | "dispute" | "reject" }) =>
      governanceApi.ratifyHistory(v.id, v.action),
    onSuccess: invalidate,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#0A1F14] flex items-center gap-1.5">
            <BookMarked className="h-4 w-4" style={{ color: "#C9922A" }} /> Our Story
          </h3>
          <p className="text-xs text-[#7A6E60] mt-0.5">
            The community&apos;s own timeline — what happened here, kept by the
            community. Confirmed entries ground the council&apos;s historian.
          </p>
        </div>
        {canPropose && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 whitespace-nowrap"
            style={{ background: "rgba(201,146,42,0.12)", color: "#7A4F1E" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add to our story
          </button>
        )}
      </div>

      {showForm && canPropose && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(14,11,8,0.03)" }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened? (e.g. The borehole ran dry)"
            maxLength={160}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white"
            style={{ border: "1px solid rgba(14,11,8,0.12)" }}
          />
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A sentence or two — what happened and why it mattered."
            maxLength={2000}
            className="w-full rounded-lg px-3 py-2 text-sm min-h-[70px] bg-white"
            style={{ border: "1px solid rgba(14,11,8,0.12)" }}
          />
          <div className="flex items-center gap-2">
            <input
              value={year}
              onChange={(e) =>
                setYear(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="Year (optional)"
              className="w-32 rounded-lg px-3 py-2 text-sm bg-white"
              style={{ border: "1px solid rgba(14,11,8,0.12)" }}
            />
            <button
              disabled={!title.trim() || !summary.trim() || propose.isPending}
              onClick={() => propose.mutate()}
              className="text-xs font-semibold rounded-full px-4 py-2 disabled:opacity-50"
              style={{ background: "#C9922A", color: "#fff" }}
            >
              {propose.isPending ? "Submitting…" : "Submit for review"}
            </button>
          </div>
          <p className="text-[11px] text-[#7A6E60]">
            Your entry goes to the community&apos;s keeper for review before it
            joins the story.
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-[#7A6E60]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[#7A6E60]">
          No story recorded yet.{" "}
          {canPropose ? "Be the first to add what has happened here." : ""}
        </p>
      ) : (
        <ol className="space-y-2.5">
          {entries.map((e) => {
            const s = STATUS[e.status] ?? STATUS.pending
            return (
              <li
                key={e.id}
                className="rounded-xl p-3"
                style={{
                  background: "#fff",
                  boxShadow: "0 0 0 1px rgba(14,11,8,0.05)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#0A1F14]">
                      {e.startYear ? (
                        <span className="text-[#7A6E60] font-normal">
                          {e.startYear} ·{" "}
                        </span>
                      ) : null}
                      {e.title}
                    </p>
                    <p className="text-[13px] text-[#0A1F14]/75 leading-snug mt-0.5">
                      {e.summary}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ color: s.color, background: s.bg }}
                  >
                    {s.label}
                  </span>
                </div>
                {canRatify && e.status === "pending" && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      onClick={() =>
                        ratify.mutate({ id: e.id, action: "confirm" })
                      }
                      disabled={ratify.isPending}
                      className="text-[11px] font-semibold rounded-full px-2.5 py-1 flex items-center gap-1"
                      style={{ color: "#1A6B3C", background: "rgba(26,107,60,0.10)" }}
                    >
                      <Check className="h-3 w-3" /> Confirm
                    </button>
                    <button
                      onClick={() =>
                        ratify.mutate({ id: e.id, action: "dispute" })
                      }
                      disabled={ratify.isPending}
                      className="text-[11px] font-semibold rounded-full px-2.5 py-1 flex items-center gap-1"
                      style={{ color: "#B03A1E", background: "rgba(176,58,30,0.10)" }}
                    >
                      <AlertTriangle className="h-3 w-3" /> Dispute
                    </button>
                    <button
                      onClick={() =>
                        ratify.mutate({ id: e.id, action: "reject" })
                      }
                      disabled={ratify.isPending}
                      className="text-[11px] font-semibold rounded-full px-2.5 py-1 flex items-center gap-1"
                      style={{ color: "#7A6E60", background: "rgba(14,11,8,0.05)" }}
                    >
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
