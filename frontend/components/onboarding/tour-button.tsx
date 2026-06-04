"use client"

import { HelpCircle } from "lucide-react"

/** Small on-demand "take the tour" affordance. Wire onClick to a useSectionTour replay(). */
export function TourButton({
  onClick,
  label = "Take the tour",
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 transition-colors hover:opacity-80 flex-shrink-0"
      style={{ background: "rgba(201,146,42,0.10)", color: "#C9922A" }}
    >
      <HelpCircle className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
