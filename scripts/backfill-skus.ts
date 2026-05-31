/**
 * Backfill Product.affisellSku for rows missing internal SKU.
 * Run: npx tsx scripts/backfill-skus.ts
 */
import { generateAffisellSku } from "@/lib/sku/generate"
import { prisma } from "@/lib/prisma"

async function main() {
  const missing = await prisma.product.findMany({
    where: { affisellSku: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })

  console.log("[backfill-skus]", { count: missing.length })

  let updated = 0
  for (const row of missing) {
    const affisellSku = await generateAffisellSku()
    await prisma.product.update({
      where: { id: row.id },
      data: { affisellSku },
    })
    updated += 1
    console.log("[backfill-skus]", { productId: row.id, affisellSku, name: row.name })
  }

  console.log("[backfill-skus]", { updated })
}

main()
  .catch((e) => {
    console.error("[backfill-skus] failed", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
