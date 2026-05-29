import type { PrismaClient } from "@prisma/client"

/**
 * Align legacy `Product.categories[]` string tags with taxonomy `category.fullPath` segments.
 * Keeps marketplace scope filters consistent with `categoryId`.
 */
export async function syncProductCategoryLabelsFromTaxonomy(
  client: PrismaClient,
  options?: { dryRun?: boolean }
): Promise<{ updated: number; skipped: number }> {
  const dryRun = options?.dryRun === true
  const products = await client.product.findMany({
    where: { categoryId: { not: null } },
    select: {
      id: true,
      categories: true,
      category: { select: { fullPath: true, name: true } },
    },
  })

  let updated = 0
  let skipped = 0

  for (const p of products) {
    const path = p.category?.fullPath?.trim()
    if (!path) {
      skipped += 1
      continue
    }

    const segments = path.split(" > ").map((s) => s.trim()).filter(Boolean)
    const leaf = segments[segments.length - 1] ?? p.category?.name ?? ""
    const nextLabels = [...new Set([path, ...segments, leaf].filter(Boolean))]
    const prev = [...(p.categories ?? [])].sort().join("|")
    const next = nextLabels.sort().join("|")

    if (prev === next) {
      skipped += 1
      continue
    }

    if (!dryRun) {
      await client.product.update({
        where: { id: p.id },
        data: { categories: nextLabels },
      })
    }
    updated += 1
  }

  console.log("[sync-product-category-labels]", { updated, skipped, dryRun })
  return { updated, skipped }
}
