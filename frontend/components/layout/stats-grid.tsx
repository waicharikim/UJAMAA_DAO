"use client"

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatItem {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: LucideIcon
  color: string
  description?: string
}

interface StatsGridProps {
  stats: StatItem[]
  className?: string
}

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", className)}>
      {stats.map((stat, index) => {
        const Icon = stat.icon

        return (
          <div
            key={index}
            className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-gold"
            style={{
              background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)",
              border: "1px solid rgba(212,145,30,0.14)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", stat.color)}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              {stat.change && (
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={
                    stat.changeType === "positive"
                      ? { color: "#1E3D2F", background: "rgba(30,61,47,0.1)" }
                      : stat.changeType === "negative"
                        ? { color: "#B03A1E", background: "rgba(176,58,30,0.1)" }
                        : { color: "rgba(26,18,11,0.45)", background: "rgba(26,18,11,0.06)" }
                  }
                >
                  {stat.change}
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="text-[28px] font-bold text-[#1A120B] leading-none">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </div>
              <div className="text-sm font-semibold text-[#1A120B]/60 pt-1">{stat.title}</div>
              {stat.description && <div className="text-xs text-[#1A120B]/40">{stat.description}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
