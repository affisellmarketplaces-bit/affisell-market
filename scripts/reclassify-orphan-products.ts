/**
 * Assign leaf categories to products with categoryId = null (includes drafts/tests).
 *
 * Run: npm run reclassify-orphans
 */
import { config } from "dotenv"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

import { autoCategorizeProduct } from "@/lib/product-auto-categorize"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  })

  console.log("[reclassify-orphans]", { count: products.length })

  let applied = 0
  let skipped = 0
  let failed = 0

  for (const p of products) {
    const result = await autoCategorizeProduct(p.id, {
      force: true,
      allowDraft: true,
      client: prisma,
    })
    if (!result.ok) {
      console.error(`[fail] ${p.id} ${p.name.slice(0, 48)} → ${result.error}`)
      failed += 1
      continue
    }
    if (result.applied) {
      console.log(`[applied] ${p.id} → ${result.breadcrumb} (${result.source})`)
      applied += 1
    } else {
      console.log(`[skip] ${p.id} → ${result.reason ?? "skipped"}`)
      skipped += 1
    }
  }

  console.log("[reclassify-orphans] done", { applied, skipped, failed, total: products.length })
}

main()
  .catch((e) => {
    console.error("[reclassify-orphans]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
