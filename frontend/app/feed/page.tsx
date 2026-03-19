"use client"

import { ActivityFeed } from "@/components/feed/activity-feed"

export default function FeedPage() {
  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
      <ActivityFeed />
    </div>
  )
}
