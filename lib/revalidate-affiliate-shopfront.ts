import { revalidatePath, revalidateTag } from "next/cache"

import { prisma } from "@/lib/prisma"
import { bustShopCategoriesResponseCache } from "@/lib/shop-categories-response-cache"
import { shopTag } from "@/lib/shop-storefront-cache"

/** Bust ISR + `unstable_cache` after affiliate catalog mutations. */
export async function revalidateAffiliateShopfront(
  affiliateUserId: string
): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { userId: affiliateUserId },
    select: { slug: true },
  })
  if (!store?.slug) return null

  const slug = store.slug.trim().toLowerCase()
  revalidateTag(shopTag(slug), "max")
  revalidateTag("home-marketplace", "max")
  revalidatePath(`/shops/${slug}`)
  revalidatePath(`/shops/${slug}`, "layout")
  bustShopCategoriesResponseCache(slug)
  console.log("[shop-revalidate]", { slug, affiliateUserId })
  return slug
}
