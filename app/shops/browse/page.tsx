import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CustomerMarketplaceBrowse } from "@/app/shops/browse/customer-marketplace-browse"
import { prisma } from "@/lib/prisma"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Marketplace — Affisell",
  description: "Parcourez les annonces des boutiques revendeur Affisell.",
  robots: { index: true, follow: true },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toUrlSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value)
    else if (Array.isArray(value) && value[0]) params.set(key, value[0])
  }
  return params
}

/** Public buyer catalog — SEO indexable; category slugs redirect to `/browse/{slug}`. */
export default async function CustomerMarketplaceBrowsePage({ searchParams }: PageProps) {
  const params = toUrlSearchParams(await searchParams)

  const scopeId =
    params.get("subcategoryId") ??
    params.get("subcategory") ??
    params.get("categoryId") ??
    params.get("category")

  if (scopeId?.trim()) {
    const category = await prisma.category.findUnique({
      where: { id: scopeId.trim() },
      select: { slug: true },
    })
    if (category?.slug) {
      redirect(categoryBrowsePath(category.slug))
    }
  }

  return <CustomerMarketplaceBrowse />
}
