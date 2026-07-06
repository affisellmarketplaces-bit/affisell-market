import { revalidatePath, revalidateTag } from "next/cache"

import { prisma } from "@/lib/prisma"
import { supplierTag } from "@/lib/supplier-storefront-cache"

/** Bust ISR + `unstable_cache` after supplier catalog mutations. */
export async function revalidateSupplierShopfront(
  supplierUserId: string
): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { userId: supplierUserId },
    select: { slug: true },
  })
  if (!store?.slug) return null

  const slug = store.slug.trim().toLowerCase()
  revalidateTag(supplierTag(slug), "max")
  revalidatePath(`/store/supplier/${slug}`)
  revalidatePath(`/store/supplier/${slug}`, "layout")
  console.log("[supplier-revalidate]", { slug, supplierUserId })
  return slug
}
