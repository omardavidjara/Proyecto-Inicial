import type { MetadataRoute } from "next"

import { INDEXABLE_PATHS } from "@/lib/seo"

// Solo las páginas públicas de lib/seo.ts; las pantallas privadas exigen sesión y no deben rastrearse
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: [...INDEXABLE_PATHS], disallow: "/" },
  }
}
