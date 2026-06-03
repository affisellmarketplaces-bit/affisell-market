import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

export async function collectCatalogHealthSignals(): Promise<SentinelSignalInput[]> {
  const [listedWithoutCategory, orphansActive, onNonLeaf, listedSkus] = await Promise.all([
    prisma.affiliateProduct.count({
      where: {
        isListed: true,
        product: { active: true, isDraft: false, categoryId: null },
      },
    }),
    prisma.product.count({ where: { active: true, isDraft: false, categoryId: null } }),
    prisma.product.count({
      where: { categoryId: { not: null }, category: { isLeaf: false } },
    }),
    prisma.affiliateProduct.count({
      where: {
        isListed: true,
        affiliate: { role: "AFFILIATE", store: { isNot: null } },
        product: { active: true, isDraft: false },
      },
    }),
  ])

  const out: SentinelSignalInput[] = []

  if (listedWithoutCategory > 0 || orphansActive > 0) {
    out.push({
      severity: "P0",
      domain: "catalog",
      code: "catalog.uncategorized_listings",
      title: "Listed products missing leaf category",
      detail: `${listedWithoutCategory} listed SKU(s) and ${orphansActive} active product(s) without categoryId — filters and discovery break.`,
      metric: listedWithoutCategory + orphansActive,
      playbook: "run-discovery-bootstrap",
    })
  }

  if (onNonLeaf > 0) {
    out.push({
      severity: "P0",
      domain: "catalog",
      code: "catalog.non_leaf_category",
      title: "Products on non-leaf taxonomy nodes",
      detail: `${onNonLeaf} product(s) point to a parent category — reclassify to a leaf.`,
      metric: onNonLeaf,
      playbook: "run-discovery-bootstrap",
    })
  }

  if (listedSkus < 20) {
    out.push({
      severity: "P1",
      domain: "catalog",
      code: "catalog.low_listed_skus",
      title: "Low live storefront listings",
      detail: `Only ${listedSkus} listed SKU(s) — marketplace discovery needs more supply.`,
      metric: listedSkus,
    })
  }

  return out
}
