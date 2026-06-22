/**
 * Idempotent try-on pilot: enable one apparel product for QA.
 *
 * Usage:
 *   TRYON_PILOT_GARMENT_URL="https://…/cutout.png" npm run tryon:pilot
 *   TRYON_PILOT_PRODUCT_ID="…" TRYON_PILOT_GARMENT_URL="…" npm run tryon:pilot
 */
import { isApparelProduct } from "@/lib/try-on/is-apparel-product"
import { prisma } from "@/lib/prisma"

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://affisell.com"

async function main() {
  const garmentUrl = process.env.TRYON_PILOT_GARMENT_URL?.trim()
  if (!garmentUrl) {
    console.error("[try-on-pilot]", {
      result: "missing_env",
      required: "TRYON_PILOT_GARMENT_URL",
    })
    process.exit(1)
  }

  const explicitProductId = process.env.TRYON_PILOT_PRODUCT_ID?.trim()

  let product: {
    id: string
    name: string
    categories: string[]
    category: { fullPath: string } | null
    affiliateProducts: Array<{ id: string }>
  } | null = null

  if (explicitProductId) {
    product = await prisma.product.findFirst({
      where: { id: explicitProductId, active: true, isDraft: false },
      select: {
        id: true,
        name: true,
        categories: true,
        category: { select: { fullPath: true } },
        affiliateProducts: {
          where: { isListed: true },
          select: { id: true },
          take: 1,
        },
      },
    })
  } else {
    const candidates = await prisma.product.findMany({
      where: { active: true, isDraft: false },
      select: {
        id: true,
        name: true,
        categories: true,
        category: { select: { fullPath: true } },
        affiliateProducts: {
          where: { isListed: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })
    product =
      candidates.find(
        (row) =>
          row.affiliateProducts.length > 0 &&
          isApparelProduct({
            categoryFullPath: row.category?.fullPath,
            legacyCategories: row.categories,
          })
      ) ?? null
  }

  if (!product) {
    console.error("[try-on-pilot]", { result: "no_apparel_product", explicitProductId })
    process.exit(1)
  }

  if (
    !isApparelProduct({
      categoryFullPath: product.category?.fullPath,
      legacyCategories: product.categories,
    })
  ) {
    console.error("[try-on-pilot]", { result: "not_apparel", productId: product.id })
    process.exit(1)
  }

  const listingId = product.affiliateProducts[0]?.id
  if (!listingId) {
    console.error("[try-on-pilot]", { result: "no_listed_affiliate_product", productId: product.id })
    process.exit(1)
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      tryOnEnabled: true,
      tryOnGarmentUrl: garmentUrl,
    },
    select: { id: true, tryOnEnabled: true, tryOnGarmentUrl: true },
  })

  const pdpUrl = `${APP_ORIGIN}/marketplace/${listingId}?tryon=true`

  console.log("[try-on-pilot]", {
    result: "enabled",
    productId: updated.id,
    productName: product.name,
    listingId,
    tryOnEnabled: updated.tryOnEnabled,
    pdpUrl,
  })
}

main()
  .catch((err) => {
    console.error("[try-on-pilot]", {
      result: "failed",
      message: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
