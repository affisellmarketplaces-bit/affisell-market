import "server-only"

import { revalidateTag } from "next/cache"

import { listingCardImageCacheTag } from "@/lib/listing-card-image-shared"
import { prisma } from "@/lib/prisma"

/** Bust WebP thumbnail cache after listing or supplier image mutations. */
export function revalidateListingCardImage(listingId: string): void {
  const id = listingId.trim()
  if (!id) return
  revalidateTag(listingCardImageCacheTag(id), "max")
  console.log("[listing-card-image]", { listingId: id, result: "revalidated" })
}

/** Supplier product gallery change — refresh all affiliate cards using that SKU. */
export async function revalidateListingCardImagesForProduct(productId: string): Promise<void> {
  const pid = productId.trim()
  if (!pid) return

  const rows = await prisma.affiliateProduct.findMany({
    where: { productId: pid },
    select: { id: true },
    take: 500,
  })

  for (const row of rows) {
    revalidateListingCardImage(row.id)
  }

  console.log("[listing-card-image]", {
    productId: pid,
    listingCount: rows.length,
    result: "revalidated",
  })
}

export async function revalidateListingCardImages(listingIds: string[]): Promise<void> {
  const unique = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  for (const id of unique) {
    revalidateListingCardImage(id)
  }
}
