/**
 * Batch AI reclassification for supplier products (missing or stale category).
 *
 *   npx tsx scripts/reclassify-products.ts
 *
 * Requires DATABASE_URL + OPENAI_API_KEY in .env / .env.local
 */

import { config } from "dotenv"
import PQueue from "p-queue"
import { PrismaClient } from "@prisma/client"

import { classifyAffisellProduct } from "../lib/ai/classify-product"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "../lib/category-browse"
import { CATEGORIES_AFFISELL } from "../lib/ai/categories"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()
const MS_DAY = 86_400_000

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY is required")
    process.exit(1)
  }

  const cutoff = new Date(Date.now() - 7 * MS_DAY)
  const products = await prisma.product.findMany({
    where: {
      OR: [{ categoryId: null }, { updatedAt: { lt: cutoff } }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
    },
    orderBy: { updatedAt: "asc" },
    take: 2000,
  })

  const catRows = await fetchAllCategoriesForBrowse(prisma)
  const { leafPaths } = buildCategoryBrowse(catRows)
  const allowedBreadcrumbs =
    leafPaths.length > 0 ? leafPaths.map((lp) => lp.breadcrumb) : [...CATEGORIES_AFFISELL]

  const queue = new PQueue({ intervalCap: 5, interval: 1000 })

  let updated = 0
  let queued = 0
  let skipped = 0

  for (const p of products) {
    void queue.add(async () => {
      const imageUrl =
        Array.isArray(p.images) && typeof p.images[0] === "string" && p.images[0].trim().length > 0
          ? p.images[0].trim()
          : undefined

      const { suggestions, error } = await classifyAffisellProduct(
        { title: p.name, description: p.description, imageUrl },
        { allowedBreadcrumbs, leafPaths }
      )

      if (error) {
        console.error(`[${p.id}]`, error)
        skipped += 1
        return
      }

      const top = suggestions[0]
      if (!top || !top.leafId) {
        skipped += 1
        return
      }

      if (top.confidence > 0.9) {
        await prisma.product.update({
          where: { id: p.id },
          data: { categoryId: top.leafId },
        })
        updated += 1
        console.log(`[update] ${p.id} → ${top.category} (${top.confidence.toFixed(2)})`)
        return
      }

      if (top.confidence > 0.6 && top.confidence <= 0.9) {
        await prisma.productReview.create({
          data: {
            productId: p.id,
            suggestedCategory: top.category,
            confidence: top.confidence,
            reason: top.reason,
          },
        })
        queued += 1
        console.log(`[review] ${p.id} → ${top.category} (${top.confidence.toFixed(2)})`)
      } else {
        skipped += 1
      }
    })
  }

  await queue.onIdle()
  console.log(`Done. updated=${updated} queuedReview=${queued} skipped=${skipped} total=${products.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
