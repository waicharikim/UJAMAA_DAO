import { Suspense } from "react"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-screen animate-pulse bg-slate-200" />}>
      <DashboardContent />
    </Suspense>
  )
}
