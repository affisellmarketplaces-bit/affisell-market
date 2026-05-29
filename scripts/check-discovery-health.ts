/**
 * Prioritized marketplace discovery + catalog health report.
 *
 * Run: npm run check:discovery
 */
import { config } from "dotenv"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

type Priority = "P0" | "P1" | "P2" | "P3"

type Action = {
  priority: Priority
  title: string
  why: string
  command?: string
  metric?: string | number
}

async function main() {
  const [
    totalProducts,
    activeProducts,
    listedSkus,
    orphansAll,
    orphansActive,
    onNonLeaf,
    emptyLegacyTags,
    listedWithoutCategory,
    totalCategories,
    leaves,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true, isDraft: false } }),
    prisma.affiliateProduct.count({
      where: {
        isListed: true,
        affiliate: { role: "AFFILIATE", store: { isNot: null } },
        product: { active: true, isDraft: false },
      },
    }),
    prisma.product.count({ where: { categoryId: null } }),
    prisma.product.count({ where: { active: true, categoryId: null } }),
    prisma.product.count({
      where: { categoryId: { not: null }, category: { isLeaf: false } },
    }),
    prisma.product.count({
      where: { categoryId: { not: null }, categories: { isEmpty: true } },
    }),
    prisma.affiliateProduct.count({
      where: {
        isListed: true,
        product: { active: true, isDraft: false, categoryId: null },
      },
    }),
    prisma.category.count(),
    prisma.category.count({ where: { isLeaf: true } }),
  ])

  const actions: Action[] = []

  if (listedWithoutCategory > 0 || orphansActive > 0) {
    actions.push({
      priority: "P0",
      title: "Classer les produits sans catégorie (feuille Google)",
      why: "Sans categoryId, filtres rayon et facettes ne montrent pas les SKU.",
      command: "npm run discovery:bootstrap",
      metric: `listedOrphans=${listedWithoutCategory}, activeOrphans=${orphansActive}`,
    })
  }

  if (listedSkus < 50) {
    actions.push({
      priority: "P0",
      title: "Augmenter le catalogue listé (fournisseurs + affiliés)",
      why: "La découverte Amazon ne convertit qu’avec assez d’annonces visibles.",
      metric: `listedSkus=${listedSkus}`,
    })
  }

  if (onNonLeaf > 0) {
    actions.push({
      priority: "P0",
      title: "Corriger produits sur catégorie non-feuille",
      why: "categoryId doit pointer vers une feuille taxonomie.",
      command: "npm run reclassify-active-catalog",
      metric: onNonLeaf,
    })
  }

  if (emptyLegacyTags > 0) {
    actions.push({
      priority: "P1",
      title: "Synchroniser Product.categories[] avec fullPath",
      why: "Aligne filtres legacy et subtree categoryId.",
      command: "npm run sync:category-labels",
      metric: emptyLegacyTags,
    })
  }

  actions.push({
    priority: "P1",
    title: "Indexer pg_trgm (recherche acheteur)",
    why: "Autocomplete + ?q= utilisent similarity Postgres.",
    command: "npm run index:marketplace-search",
  })

  if (listedSkus >= 20) {
    actions.push({
      priority: "P2",
      title: "Sync auto fournisseur (Shopify / stock-prix)",
      why: "Réduit le travail manuel fondateur — UI « coming soon ».",
    })
  }

  actions.push({
    priority: "P3",
    title: "Moteur dédié (Meilisearch) si > ~1000 SKU listés",
    why: "pg_trgm suffit pour petit catalogue; scale ensuite.",
    metric: `listedSkus=${listedSkus}`,
  })

  const order: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  actions.sort((a, b) => order[a.priority] - order[b.priority])

  const report = {
    generatedAt: new Date().toISOString(),
    metrics: {
      totalProducts,
      activeProducts,
      listedSkus,
      orphansAll,
      orphansActive,
      onNonLeaf,
      emptyLegacyTags,
      listedWithoutCategory,
      totalCategories,
      leaves,
    },
    actions,
  }

  console.log(JSON.stringify(report, null, 2))
  writeFileSync(resolve(process.cwd(), "discovery-health.json"), JSON.stringify(report, null, 2))
  console.log("\n[check:discovery] Fichier: discovery-health.json")
  console.log("[check:discovery] Prochaine action:", actions[0]?.command ?? actions[0]?.title)
}

main()
  .catch((e) => {
    console.error("[check:discovery]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
