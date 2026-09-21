/**
 * Photo-only classification check (read-only): real product photos, no title → what does the classifier say?
 *   npx tsx scripts/eval-photo-only.ts
 */
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config()

import { buildCategoryBrowse } from "../lib/category-browse-shared"
import { classifyProductTaxonomy } from "../lib/ai/taxonomy-classifier"

async function main() {
  const prisma = new PrismaClient()
  const rows = await prisma.category.findMany({ select: { id: true, name: true, parentId: true, icon: true, order: true }, orderBy: [{ order: "asc" }, { name: "asc" }] })
  const products = await prisma.product.findMany({
    where: { isDraft: false, active: true, NOT: { images: { isEmpty: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { name: true, images: true },
  })
  await prisma.$disconnect()
  const browse = buildCategoryBrowse(rows)
  for (const p of products) {
    const img = p.images.find((u) => /^https:\/\//.test(u))
    if (!img) continue
    const t0 = Date.now()
    try {
      const r = await classifyProductTaxonomy({ title: "", imageUrl: img }, { browse, leafPaths: browse.leafPaths })
      console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s | real name: ${p.name.slice(0, 70)}`)
      console.log(`   sees: ${r?.identity.nameFr} (${r?.identity.photoShows?.slice(0, 80)})`)
      for (const k of r?.picks.slice(0, 2) ?? []) console.log(`   ${k.confidence.toFixed(2)} ${k.breadcrumb}`)
    } catch (e) {
      console.log(`ERR ${p.name.slice(0, 40)} ${(e as Error).message.slice(0, 100)}`)
    }
  }
}
void main()
