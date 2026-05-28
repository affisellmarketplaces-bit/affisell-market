/**
 * Taxonomy health report (Category tree + product linkage).
 *
 * Run: npx tsx scripts/check-categories.ts
 * Output: category-report.json (project root)
 */
import { config } from "dotenv"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

async function main() {
  const [total, l1, sampleL2, categoryRows, leafCount, productsTotal] = await Promise.all([
    prisma.category.count(),
    prisma.category.findMany({
      where: { level: 1, parentId: null },
      select: {
        id: true,
        name: true,
        slug: true,
        googleId: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { level: 2 },
      take: 10,
      select: { id: true, name: true, slug: true, parentId: true, googleId: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ select: { id: true, isLeaf: true, googleId: true } }),
    prisma.category.count({ where: { isLeaf: true } }),
    prisma.product.count(),
  ])

  const categoryIds = categoryRows.map((c) => c.id)
  const withGoogleId = categoryRows.filter((c) => c.googleId != null).length

  const [productsWithoutCategory, productsInvalidCategory, productsOnNonLeaf] = await Promise.all([
    prisma.product.count({ where: { categoryId: null } }),
    categoryIds.length === 0
      ? prisma.product.count({ where: { categoryId: { not: null } } })
      : prisma.product.count({
          where: { categoryId: { not: null, notIn: categoryIds } },
        }),
    prisma.product.count({
      where: { categoryId: { not: null }, category: { isLeaf: false } },
    }),
  ])

  const result = {
    totalCategories: total,
    totalL1: l1.length,
    totalLeaves: leafCount,
    categoriesWithGoogleId: withGoogleId,
    isGoogleTaxonomy: withGoogleId > 0 && withGoogleId >= Math.floor(total * 0.5),
    l1Categories: l1,
    sampleL2,
    products: {
      total: productsTotal,
      withoutCategoryId: productsWithoutCategory,
      invalidCategoryId: productsInvalidCategory,
      onNonLeafCategory: productsOnNonLeaf,
      orphanCount: productsWithoutCategory + productsInvalidCategory,
    },
  }

  const json = JSON.stringify(result, null, 2)
  console.log(json)
  writeFileSync(resolve(process.cwd(), "category-report.json"), json)
  console.log("\nFichier créé: category-report.json")
}

main()
  .catch((e) => {
    console.error("[check-categories]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
