"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  showBackButton?: boolean
  onBack?: () => void
  actions?: React.ReactNode
  className?: string
  gradient?: boolean
}

export function PageHeader({
  title,
  description,
  badge,
  showBackButton,
  onBack,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl p-8", className)}
      style={{
        background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)",
        border: "1px solid rgba(212,145,30,0.18)",
      }}
    >
      {/* Subtle amber glow top-right */}
      <div
        className="pointer-events-none absolute -top-12 right-8 h-32 w-32 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, rgba(212,145,30,0.35) 0%, transparent 70%)" }}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack || (() => window.history.back())}
                className="mb-4 -ml-2 text-[#0E0B08]/50 hover:text-[#0E0B08] hover:bg-[rgba(201,146,42,0.08)]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display font-bold text-3xl text-[#1A120B]">{title}</h1>
              {badge && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(212,145,30,0.12)",
                    color: "#C9922A",
                    border: "1px solid rgba(212,145,30,0.25)",
                  }}
                >
                  {badge}
                </span>
              )}
            </div>

            {description && (
              <p className="text-base max-w-2xl" style={{ color: "rgba(26,18,11,0.55)" }}>
                {description}
              </p>
            )}
          </div>

          {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
