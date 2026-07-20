"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  MessagesSquare,
  ExternalLink,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react"
import { integrationApi, type BarazaGroupDto } from "@/lib/api"

/**
 * Surfaces the user's WARD Baraza — the Telegram chat for their home ward — with
 * a prominent join CTA, shown on the community page at the ward level only.
 *
 * Design intent: the ward is where real-time chat adds the most value (small,
 * local, high-signal); upper levels (constituency/county/national) stay in the
 * app rather than becoming noisy mega-groups. So we push the ward Baraza here.
 *
 * When none exists yet, anyone can expand a short "start one" guide — the
 * backend gates who may actually `/register`, so showing the steps is harmless
 * and seeds supply (every ward starts with zero Barazas).
 */
export function WardBarazaCard({
  wardGroupId,
  wardName,
}: {
  wardGroupId?: string
  wardName?: string
}) {
  const [guideOpen, setGuideOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: barazas = [] } = useQuery<BarazaGroupDto[]>({
    queryKey: ["baraza-groups"],
    queryFn: integrationApi.getBarazaGroups,
    staleTime: 60_000,
  })

  if (!wardGroupId) return null

  const baraza = barazas.find(
    (b) => b.groupId === wardGroupId && b.platform === "TELEGRAM" && b.isActive,
  )
  const place = wardName ?? "Your ward"
  const command = `/register ${wardGroupId}`

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — user can select the text manually */
    }
  }

  const shell = {
    background: "rgba(29,71,49,0.06)",
    border: "1px solid rgba(29,71,49,0.14)",
  }

  // ── A Baraza exists → join CTA ──────────────────────────────────────────
  if (baraza?.inviteLink) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3.5" style={shell}>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(29,71,49,0.12)" }}
        >
          <MessagesSquare className="h-5 w-5" style={{ color: "#1D4731" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: "#1D4731" }}>
            {place} Baraza
          </p>
          <p className="text-[12px]" style={{ color: "rgba(14,11,8,0.55)" }}>
            Your ward's group chat — coordinate with neighbours in real time.
          </p>
        </div>
        <a
          href={baraza.inviteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-bold text-cream"
          style={{ background: "#1D4731" }}
        >
          Join <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    )
  }

  // ── No Baraza yet → nudge + opt-in "start one" guide ────────────────────
  return (
    <div className="rounded-2xl p-4" style={shell}>
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(29,71,49,0.12)" }}
        >
          <MessagesSquare className="h-5 w-5" style={{ color: "#1D4731" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: "#1D4731" }}>
            {place} Baraza
          </p>
          <p className="text-[12px]" style={{ color: "rgba(14,11,8,0.55)" }}>
            No Baraza yet — once your ward starts one, neighbours can coordinate
            in real time on Telegram.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setGuideOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold"
        style={{ color: "#C9922A" }}
      >
        Are you a ward leader? Start the Baraza
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform"
          style={{ transform: guideOpen ? "rotate(180deg)" : "none" }}
        />
      </button>

      {guideOpen && (
        <ol
          className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed"
          style={{ color: "rgba(14,11,8,0.7)" }}
        >
          <li>
            <span className="font-bold" style={{ color: "#1D4731" }}>1.</span>{" "}
            Create a Telegram group named <strong>{place} Baraza</strong>.
          </li>
          <li>
            <span className="font-bold" style={{ color: "#1D4731" }}>2.</span>{" "}
            Add the UjamaaDAO bot to the group (the same bot that posts in
            Barazas).
          </li>
          <li>
            <span className="font-bold" style={{ color: "#1D4731" }}>3.</span>{" "}
            In the group, send this command:
            <div
              className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "rgba(14,11,8,0.05)" }}
            >
              <code
                className="flex-1 text-[12px] break-all"
                style={{ color: "#1D4731" }}
              >
                {command}
              </code>
              <button
                type="button"
                onClick={copyCommand}
                className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold"
                style={{ color: "#C9922A" }}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
          </li>
        </ol>
      )}
    </div>
  )
}
