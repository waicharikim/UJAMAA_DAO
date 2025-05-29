"use client"

import { Card, CardContent } from "@/components/ui/card"
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
          <Card
            key={index}
            className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-slate-50"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", stat.color)}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                {stat.change && (
                  <div
                    className={cn(
                      "text-sm font-medium px-2 py-1 rounded-full",
                      stat.changeType === "positive" && "text-green-700 bg-green-100",
                      stat.changeType === "negative" && "text-red-700 bg-red-100",
                      stat.changeType === "neutral" && "text-slate-700 bg-slate-100",
                    )}
                  >
                    {stat.change}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold text-slate-900">
                  {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                </div>
                <div className="text-sm font-medium text-slate-600">{stat.title}</div>
                {stat.description && <div className="text-xs text-slate-500">{stat.description}</div>}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
