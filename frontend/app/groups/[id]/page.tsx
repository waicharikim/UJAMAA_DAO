import { Suspense } from "react"
import { GroupDetail } from "@/components/groups/group-detail"
import { GroupMembers } from "@/components/groups/group-members"
import { ProtectedRoute } from "@/components/auth/protected-route"

interface GroupPageProps {
  params: {
    id: string
  }
}

export default function GroupPage({ params }: GroupPageProps) {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Suspense fallback={<GroupDetailSkeleton />}>
              <GroupDetail groupId={params.id} />
            </Suspense>
          </div>
          <div>
            <Suspense fallback={<GroupMembersSkeleton />}>
              <GroupMembers groupId={params.id} />
            </Suspense>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function GroupDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-1/2 mb-4" />
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
      <div className="h-4 bg-slate-200 rounded w-1/2" />
    </div>
  )
}

function GroupMembersSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-1" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
