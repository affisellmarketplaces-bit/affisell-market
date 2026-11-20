import type { Prisma } from "@prisma/client"

import { DEMO_LAB_TAG } from "@/lib/demo/demo-accounts-shared"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment"

/** Internal QA / Stripe test SKUs — never show on buyer marketplace or shop PDP. */
export const INTERNAL_TEST_PRODUCT_NAMES = [
  "Test 3Way Split",
  "Test Three Way Split",
  "Produit Test TVA Affisell",
] as const

export const INTERNAL_TEST_PRODUCT_IDS = [
  "test_product_3way",
  "cmpiddd890003thlps6tp",
] as const

export const excludeInternalTestProductsWhere: Prisma.ProductWhereInput = {
  NOT: {
    OR: [
      ...INTERNAL_TEST_PRODUCT_NAMES.map((name) => ({
        name: { equals: name, mode: "insensitive" as const },
      })),
      { id: { in: [...INTERNAL_TEST_PRODUCT_IDS] } },
      { id: { startsWith: "test_" } },
      { name: { startsWith: "Test ", mode: "insensitive" as const } },
      { name: { contains: "test tva", mode: "insensitive" as const } },
      // Demo Lab sandbox SKUs (`@demo.affisell.com` accounts) are never offered to real shoppers in PRODUCTION —
      // browsing, PDP or checkout (founder decision 2026-11-19: demo data strictly apart). Previews keep them for the
      // Demo Lab walkthrough. Same NOT key as before, so callers that spread this object keep one exclusion clause.
      ...(resolveRuntimeEnvironment() === "production" ? [{ tags: { has: DEMO_LAB_TAG } }] : []),
    ],
  },
}

/** Product rows visible to shoppers (catalog, PDP, checkout). */
export const buyerMarketplaceProductWhere: Prisma.ProductWhereInput = {
  active: true,
  isDraft: false,
  ...excludeInternalTestProductsWhere,
}

/** Listed affiliate SKU on the public marketplace. */
export const buyerListedAffiliateProductWhere: Prisma.AffiliateProductWhereInput = {
  ...affiliateRoleMarketplaceWhere,
  isListed: true,
  product: buyerMarketplaceProductWhere,
}

export function isInternalTestProductName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase()
  if (!n) return false
  if (INTERNAL_TEST_PRODUCT_NAMES.some((label) => n === label.toLowerCase())) return true
  if (n.startsWith("test ")) return true
  if (n.includes("test tva")) return true
  return false
}

export function isInternalTestProductId(id: string | null | undefined): boolean {
  const v = (id ?? "").trim()
  if (!v) return false
  if (INTERNAL_TEST_PRODUCT_IDS.includes(v as (typeof INTERNAL_TEST_PRODUCT_IDS)[number])) return true
  if (v.startsWith("test_")) return true
  return false
}

export function isInternalTestProduct(args: {
  id?: string | null
  name?: string | null
}): boolean {
  return isInternalTestProductId(args.id) || isInternalTestProductName(args.name)
}
