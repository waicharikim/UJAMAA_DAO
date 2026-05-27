import type { Metadata } from "next"

const SITE_URL = "https://ujamaadao.org"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ proposalId: string }>
}): Promise<Metadata> {
  const { proposalId } = await params

  // Attempt a lightweight fetch from the public API — fall back to generic tags
  let title = "Community Proposal | UjamaaDAO"
  let description =
    "Review and vote on this community proposal on the UjamaaDAO governance platform."

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/governance/${proposalId}`,
      { next: { revalidate: 60 } }
    )
    if (res.ok) {
      const json = await res.json()
      const proposal = json?.data ?? json
      if (proposal?.title) {
        title = `${proposal.title} | UjamaaDAO`
        description = proposal.description
          ? `${String(proposal.description).slice(0, 160)}…`
          : description
      }
    }
  } catch {
    // network not available at build time — use fallback
  }

  const url = `${SITE_URL}/proposals/${proposalId}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "UjamaaDAO",
      type: "article",
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: url },
  }
}

export default function ProposalDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
