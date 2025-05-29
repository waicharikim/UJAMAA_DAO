"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  gradient = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white p-8 shadow-sm",
        gradient && "bg-gradient-to-br from-blue-50 via-white to-purple-50",
        className,
      )}
    >
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      )}

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack || (() => window.history.back())}
                className="mb-4 -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                {title}
              </h1>
              {badge && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {badge}
                </Badge>
              )}
            </div>

            {description && <p className="text-lg text-slate-600 max-w-2xl">{description}</p>}
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
