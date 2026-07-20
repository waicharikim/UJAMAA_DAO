import { redirect } from "next/navigation"

// Feed content moved to dashboard "Recent Activity" section.
export default function FeedPage() {
  redirect("/dashboard")
}
