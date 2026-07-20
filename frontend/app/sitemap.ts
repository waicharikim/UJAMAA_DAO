import type { MetadataRoute } from "next"

const SITE_URL = "https://ujamaadao.org"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: SITE_URL,               lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/about`,    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/auth/register`,   lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/auth/callback`,   lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/governance`,      lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${SITE_URL}/education`,       lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${SITE_URL}/groups`,          lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
  ]
}
