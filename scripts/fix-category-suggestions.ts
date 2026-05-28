import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const orphans = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, name: true }
  })
  console.log(`${orphans.length} produits sans catégorie:`, orphans)

  const badParents = await prisma.$queryRaw`
    SELECT p.id, p.name, c.name as category
    FROM "Product" p 
    JOIN "Category" c ON p."categoryId" = c.id 
    WHERE c."isLeaf" = false
  `
  console.log(`Produits mal classés:`, badParents)

  await prisma.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS category_name_trgm_idx ON "Category" USING gin (name gin_trgm_ops);`
  await prisma.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS product_name_trgm_idx ON "Product" USING gin (name gin_trgm_ops);`
  await prisma.$executeRaw`ANALYZE "Category"; ANALYZE "Product";`
  
  console.log('Index rebuild OK. Vide Redis: redis.del("search:*")')
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
