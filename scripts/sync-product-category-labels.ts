/**
 * Backfill Product.categories[] from category.fullPath (taxonomy alignment).
 *
 * Run: npm run sync:category-labels
 */
import { config } from "dotenv"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

import { syncProductCategoryLabelsFromTaxonomy } from "@/lib/sync-product-category-labels"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  await syncProductCategoryLabelsFromTaxonomy(prisma, { dryRun })
}

main()
  .catch((e) => {
    console.error("[sync-product-category-labels]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
