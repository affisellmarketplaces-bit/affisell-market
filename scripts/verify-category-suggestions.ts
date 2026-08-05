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
    label: "Montre (titre court)",
    title: "Montre",
    description: "",
  },
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
  {
    label: "Peluche Michael Jackson",
    title: "Nouvelle collection : Figurine en peluche Michael Jackson pour",
    description: "",
  },
  {
    label: "Gloss lèvres",
    title: "Gloss à lèvres repulpant hydratant",
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
        source: s.suggestionSource,
      })),
    })
    if (c.label.startsWith("Montre (titre")) {
      const ok = listing.suggestions.some((s) => /Bijoux\s*>\s*Montres/i.test(s.breadcrumb))
      if (!ok) {
        console.error("FAIL: expected Bijoux > Montres for plain Montre")
        process.exitCode = 1
      }
    }
    if (c.label.startsWith("Montre connect")) {
      const jewelry = listing.suggestions.some((s) => /Bijoux\s*>\s*Montres/i.test(s.breadcrumb))
      const activity = listing.suggestions.some((s) => /Moniteurs d'activité/i.test(s.breadcrumb))
      if (jewelry || !activity) {
        console.error("FAIL: Montre connectée should suggest activity monitors, not jewelry", {
          jewelry,
          activity,
        })
        process.exitCode = 1
      }
    }
    if (c.label.startsWith("Peluche Michael")) {
      const plush = listing.suggestions.some((s) => /Peluches/i.test(s.breadcrumb))
      const pet = listing.suggestions.some((s) =>
        /aquarium|collerettes|animaux de compagnie/i.test(s.breadcrumb)
      )
      if (!plush || pet) {
        console.error("FAIL: plush figurine should suggest Jeux et jouets > Peluches, not pets", {
          plush,
          pet,
          top: listing.suggestions[0]?.breadcrumb,
        })
        process.exitCode = 1
      }
    }
    if (c.label.startsWith("Gloss lèvres")) {
      const lip = listing.suggestions.some((s) =>
        /maquillage pour les levres|brillant a levres|soins des levres|baumes a levres/i.test(
          s.breadcrumb.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        )
      )
      const wrong = listing.suggestions.some((s) =>
        /slips de sport|cyclisme|adhesif|decoration du corps|paillettes pour le corps/i.test(
          s.breadcrumb.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        )
      )
      if (!lip || wrong) {
        console.error("FAIL: lip gloss should suggest lip cosmetics, not unrelated leaves", {
          lip,
          wrong,
          top: listing.suggestions[0]?.breadcrumb,
        })
        process.exitCode = 1
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("[verify-category-suggestions]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
