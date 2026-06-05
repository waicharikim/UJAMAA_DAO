"use client"

import { useQuery } from "@tanstack/react-query"
import { MessagesSquare, ExternalLink } from "lucide-react"
import { integrationApi, type BarazaGroupDto } from "@/lib/api"

/**
 * Surfaces the user's WARD Baraza — the Telegram chat for their home ward — with
 * a prominent join CTA, shown on the community page at the ward level only.
 *
 * Design intent: the ward is where real-time chat adds the most value (small,
 * local, high-signal); upper levels (constituency/county/national) stay in the
 * app rather than becoming noisy mega-groups. So we push the ward Baraza here,
 * and if none is registered yet we nudge the user to ask their ward leader.
 */
export function WardBarazaCard({
  wardGroupId,
  wardName,
}: {
  wardGroupId?: string
  wardName?: string
}) {
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

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3.5"
      style={{
        background: "rgba(29,71,49,0.06)",
        border: "1px solid rgba(29,71,49,0.14)",
      }}
    >
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
          {baraza?.inviteLink
            ? "Your ward's group chat — coordinate with neighbours in real time."
            : "No Baraza yet — ask your ward leader to start a Telegram group so neighbours can coordinate."}
        </p>
      </div>

      {baraza?.inviteLink && (
        <a
          href={baraza.inviteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-bold text-cream"
          style={{ background: "#1D4731" }}
        >
          Join <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}
