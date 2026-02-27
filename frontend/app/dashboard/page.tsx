import { Suspense } from "react"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-screen animate-pulse rounded-2xl"
          style={{ background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)" }}
        />
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
