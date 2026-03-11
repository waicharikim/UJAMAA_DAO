import { Suspense, use } from "react"
import { GroupDetail } from "@/components/groups/group-detail"
import { GroupMembers } from "@/components/groups/group-members"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Suspense fallback={<GroupDetailSkeleton />}>
              <GroupDetail groupId={id} />
            </Suspense>
          </div>
          <div>
            <Suspense fallback={<GroupMembersSkeleton />}>
              <GroupMembers groupId={id} />
            </Suspense>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function GroupDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded-xl w-1/2" style={{ background: "rgba(201,146,42,0.1)" }} />
      <div className="h-4 rounded-xl w-3/4" style={{ background: "rgba(201,146,42,0.07)" }} />
      <div className="h-4 rounded-xl w-1/2" style={{ background: "rgba(201,146,42,0.07)" }} />
    </div>
  )
}

function GroupMembersSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full" style={{ background: "rgba(201,146,42,0.1)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded-xl w-3/4" style={{ background: "rgba(201,146,42,0.07)" }} />
            <div className="h-3 rounded-xl w-1/2" style={{ background: "rgba(201,146,42,0.05)" }} />
          </div>
        </div>
      ))}
    </div>
  )
}
