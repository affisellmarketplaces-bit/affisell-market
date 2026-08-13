#!/usr/bin/env node
/**
 * List live AffiliateProduct IDs for reseller boutique QA.
 * Usage: npm run boutique:listings
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

try {
  const rows = await prisma.affiliateProduct.findMany({
    where: { isListed: true },
    select: {
      id: true,
      customTitle: true,
      product: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  })

  if (rows.length === 0) {
    console.log("[boutique:listings] No isListed=true AffiliateProduct rows.")
    process.exit(0)
  }

  console.log("[boutique:listings] Live listings (AffiliateProduct.id):\n")
  for (const row of rows) {
    const title = row.customTitle?.trim() || row.product?.name || "(untitled)"
    const url = `http://localhost:3001/boutique/ma-boutique?productId=${encodeURIComponent(row.id)}`
    console.log(`  ${row.id}`)
    console.log(`    ${title.slice(0, 72)}${title.length > 72 ? "…" : ""}`)
    console.log(`    ${url}\n`)
  }
} catch (err) {
  console.error("[boutique:listings]", err instanceof Error ? err.message : err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
