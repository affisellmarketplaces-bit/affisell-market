/**
 * Smoke test: keyword search + listing classification (no HTTP auth).
 *
 * Run: npm run verify:category-suggestions
 */
import { config } from "dotenv"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

import { suggestLeafCategoriesFromProductText } from "@/lib/category-title-match"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "@/lib/category-browse"
import { suggestListingCategories } from "@/lib/supplier-suggest-listing"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

const CASES = [
  {
    label: "Montre connectée",
    title: "Montre connectée sport GPS cardio sommeil",
    description: "",
  },
  {
    label: "Trottinette",
    title:
      "Scooter-Trottinette électrique tout-terrain pour adultes, trottinette électrique, 1000W",
    description: "",
  },
  {
    label: "PlayStation Portal",
    title: "Sony Playstation Portal - Lecteur à distance pour PS5 Blanc",
    description: "",
  },
] as const

async function main() {
  const rows = await fetchAllCategoriesForBrowse(prisma)
  const { leafPaths } = buildCategoryBrowse(rows)
  console.log("[verify-category-suggestions]", {
    leafCount: leafPaths.length,
    groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
  })

  for (const c of CASES) {
    const keyword = suggestLeafCategoriesFromProductText(c.title, c.description, leafPaths, 3)
    const listing = await suggestListingCategories(c.title, c.description, prisma, {
      bullets: [],
    })
    console.log(`\n--- ${c.label} ---`)
    console.log("keyword top:", keyword.map((k) => k.breadcrumb))
    console.log("listing:", {
      source: listing.source,
      recommended: listing.recommendedLeafId,
      suggestions: listing.suggestions.slice(0, 3).map((s) => ({
        breadcrumb: s.breadcrumb,
        confidence: s.confidence,
      })),
    })
  }
}

main()
  .catch((e) => {
    console.error("[verify-category-suggestions]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
