import type { Metadata } from "next"

const SITE_URL = "https://ujamaadao.org"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  let title = "Community Group | UjamaaDAO"
  let description =
    "Join this community group on UjamaaDAO — connecting neighbours, building wards."

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/community/${id}`,
      { next: { revalidate: 60 } }
    )
    if (res.ok) {
      const json = await res.json()
      const group = json?.data ?? json
      if (group?.name) {
        title = `${group.name} | UjamaaDAO`
        description = group.description
          ? `${String(group.description).slice(0, 160)}…`
          : description
      }
    }
  } catch {
    // network not available at build time — use fallback
  }

  const url = `${SITE_URL}/groups/${id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "UjamaaDAO",
      type: "website",
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

export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
