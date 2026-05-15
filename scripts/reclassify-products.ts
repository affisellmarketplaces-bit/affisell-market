/**
 * Batch AI reclassification for supplier products (missing or stale category).
 *
 *   npm run reclassify-products
 *
 * Requires DATABASE_URL + OPENAI_API_KEY in .env / .env.local
 */

import { config } from "dotenv"
import PQueue from "p-queue"
import { PrismaClient } from "@prisma/client"

import { autoCategorizeProduct } from "../lib/product-auto-categorize"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()
const MS_DAY = 86_400_000

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }

  const cutoff = new Date(Date.now() - 7 * MS_DAY)
  const products = await prisma.product.findMany({
    where: {
      active: true,
      isDraft: false,
      OR: [{ categoryId: null }, { updatedAt: { lt: cutoff } }],
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: "asc" },
    take: 2000,
  })

  const queue = new PQueue({ intervalCap: 5, interval: 1000 })

  let applied = 0
  let queued = 0
  let skipped = 0
  let failed = 0

  for (const p of products) {
    void queue.add(async () => {
      const result = await autoCategorizeProduct(p.id, { force: true, client: prisma })
      if (!result.ok) {
        console.error(`[${p.id}] ${result.error}`)
        failed += 1
        return
      }
      if (result.applied) {
        applied += 1
        if ("needsReview" in result && result.needsReview) {
          queued += 1
          console.log(`[review] ${p.id} → ${result.breadcrumb}`)
        } else {
          console.log(`[applied] ${p.id} → ${result.breadcrumb} (${result.source})`)
        }
        return
      }
      skipped += 1
    })
  }

  await queue.onIdle()
  console.log(
    `Done. applied=${applied} queuedReview=${queued} skipped=${skipped} failed=${failed} total=${products.length}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
