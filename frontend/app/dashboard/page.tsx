import { Suspense } from "react"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-2xl bg-[#F0EBE0] m-8" />}>
      <DashboardContent />
    </Suspense>
  )
}
