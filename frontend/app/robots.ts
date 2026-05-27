import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth/", "/about"],
        disallow: ["/dashboard", "/profile", "/economy", "/admin", "/api/"],
      },
    ],
    sitemap: "https://ujamaadao.org/sitemap.xml",
  }
}
