/**
 * Unlist and deactivate internal QA products (3-way split, VAT flow).
 * Safe to re-run.
 */
import { Prisma } from "@prisma/client"

import {
  INTERNAL_TEST_PRODUCT_IDS,
  INTERNAL_TEST_PRODUCT_NAMES,
} from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

async function main() {
  const nameFilters: Prisma.ProductWhereInput[] = INTERNAL_TEST_PRODUCT_NAMES.map((name) => ({
    name: { equals: name, mode: "insensitive" },
  }))

  const products = await prisma.product.findMany({
    where: {
      OR: [...nameFilters, { id: { in: [...INTERNAL_TEST_PRODUCT_IDS] } }],
    },
    select: { id: true, name: true, active: true },
  })

  if (products.length === 0) {
    console.log("No internal test products found in database.")
    return
  }

  const ids = products.map((p) => p.id)
  console.log("Found:", products.map((p) => `${p.id} (${p.name})`).join(", "))

  const [productUpdate, listingUpdate] = await prisma.$transaction([
    prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { active: false, isDraft: true },
    }),
    prisma.affiliateProduct.updateMany({
      where: { productId: { in: ids } },
      data: { isListed: false },
    }),
  ])

  console.log(
    `Updated ${productUpdate.count} product(s), unlisted ${listingUpdate.count} affiliate listing(s).`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
