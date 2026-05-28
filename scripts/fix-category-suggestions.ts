/**
 * Diagnostic + index rebuild for category / product name search (pg_trgm).
 *
 * Run: npm run fix:category-suggestions
 */
import { config } from "dotenv"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

async function main() {
  const orphans = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, name: true },
  })
  console.log(`[fix-category-suggestions] ${orphans.length} produits sans catégorie:`, orphans)

  const badParents = await prisma.$queryRaw<
    Array<{ id: string; name: string; category: string }>
  >`
    SELECT p.id, p.name, c.name as category
    FROM "Product" p
    JOIN "Category" c ON p."categoryId" = c.id
    WHERE c."isLeaf" = false
  `
  console.log("[fix-category-suggestions] Produits mal classés:", badParents)

  // Prisma wraps $executeRaw in a transaction — CONCURRENTLY is not allowed.
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS category_name_trgm_idx ON "Category" USING gin (name gin_trgm_ops);`
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS product_name_trgm_idx ON "Product" USING gin (name gin_trgm_ops);`
  await prisma.$executeRaw`ANALYZE "Category";`
  await prisma.$executeRaw`ANALYZE "Product";`

  console.log(
    "[fix-category-suggestions] Index rebuild OK. Si cache Redis custom: redis-cli --scan --pattern 'search:*' | xargs redis-cli DEL"
  )
}

main()
  .catch((e) => {
    console.error("[fix-category-suggestions]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
