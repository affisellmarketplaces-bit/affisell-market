#!/usr/bin/env npx tsx
/**
 * Rapport lecture seule — grilles commission Affisell + fournisseur→affilié.
 * N'écrit rien en DB.
 *
 * Usage: npx tsx scripts/show-affisell-commission-grid.ts
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"

import {
  AFFISELL_TAXONOMY_EXTENSION_PATHS,
  COMMISSION_GRID_MAP,
  formatBpsPercent,
  GRID_ENTRY_COUNT,
} from "@/lib/commission-grid-config"
import { countCategoriesForGridEntry } from "@/lib/commission-grid-resolve"
import { loadTaxonomyEnRows } from "@/lib/commission-grid-taxonomy"

const prisma = new PrismaClient()

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 1) + "…" : s.padEnd(n)
}

async function main() {
  const taxonomy = loadTaxonomyEnRows()

  const [totalCategories, affisellDistinct, supplierDistinct, productsWithCategory] =
    await Promise.all([
    prisma.category.count(),
    prisma.category.groupBy({
      by: ["affisellCommissionRateBps"],
      _count: true,
    }),
    prisma.category.groupBy({
      by: ["supplierCommissionRateBps"],
      _count: true,
    }),
    prisma.product.count({ where: { categoryId: { not: null } } }),
  ])

  console.log("\n[commission-grid] État actuel (DB)\n")
  console.log(`  Catégories en base           : ${totalCategories}`)
  console.log(`  Produits avec categoryId     : ${productsWithCategory}`)
  console.log("  Affisell (plateforme):")
  for (const row of affisellDistinct) {
    const bps = row.affisellCommissionRateBps ?? 0
    console.log(
      `    ${formatBpsPercent(bps).padStart(6)} (${bps} bps) → ${row._count} catégories`
    )
  }
  console.log("  Fournisseur → affilié:")
  for (const row of supplierDistinct) {
    const bps = row.supplierCommissionRateBps ?? 0
    const label = row.supplierCommissionRateBps == null ? "null (héritage)" : formatBpsPercent(bps)
    console.log(`    ${label} → ${row._count} catégories`)
  }

  console.log("\n[commission-grid] Grille métier — Affisell + Fournisseur\n")
  console.log(
    "|",
    pad("Catégorie métier", 28),
    "|",
    pad("Aff.", 7),
    "|",
    pad("DB Aff", 7),
    "|",
    pad("Fourn.", 7),
    "|",
    pad("DB Fourn", 8),
    "|",
    pad("Nœuds", 12),
    "|"
  )
  console.log(
    "|",
    "-".repeat(28),
    "|",
    "-".repeat(7),
    "|",
    "-".repeat(7),
    "|",
    "-".repeat(7),
    "|",
    "-".repeat(8),
    "|",
    "-".repeat(12),
    "|"
  )

  let totalGoogleNodes = 0
  let totalExtensionNodes = 0
  const assignedGoogleIds = new Set<number>()

  for (const [key, entry] of Object.entries(COMMISSION_GRID_MAP)) {
    const match = await countCategoriesForGridEntry(prisma, taxonomy, entry)
    for (const id of match.googleIds) assignedGoogleIds.add(id)

    totalGoogleNodes += match.googleIdCount
    totalExtensionNodes += match.affisellExtensionCount

    const nodeLabel =
      match.affisellExtensionCount > 0
        ? `${match.googleIdCount} + ${match.affisellExtensionCount} ext`
        : String(match.googleIdCount)

    const affisellDb = await prisma.category.groupBy({
      by: ["affisellCommissionRateBps"],
      where: {
        OR: [
          ...(match.googleIds.length > 0 ? [{ googleId: { in: match.googleIds } }] : []),
          ...(match.affisellCategoryIds.length > 0
            ? [{ id: { in: match.affisellCategoryIds } }]
            : []),
        ],
      },
      _count: true,
    })
    const supplierDb = await prisma.category.groupBy({
      by: ["supplierCommissionRateBps"],
      where: {
        OR: [
          ...(match.googleIds.length > 0 ? [{ googleId: { in: match.googleIds } }] : []),
          ...(match.affisellCategoryIds.length > 0
            ? [{ id: { in: match.affisellCategoryIds } }]
            : []),
        ],
      },
      _count: true,
    })

    const affisellDbLabel =
      affisellDb.length === 0
        ? "—"
        : affisellDb.length === 1
          ? formatBpsPercent(affisellDb[0]!.affisellCommissionRateBps ?? 0)
          : "mixte"
    const supplierDbLabel =
      supplierDb.length === 0
        ? "—"
        : supplierDb.length === 1
          ? formatBpsPercent(supplierDb[0]!.supplierCommissionRateBps ?? 0)
          : "mixte"

    console.log(
      "|",
      pad(entry.label, 28),
      "|",
      pad(formatBpsPercent(entry.affisellBps), 7),
      "|",
      pad(affisellDbLabel, 7),
      "|",
      pad(formatBpsPercent(entry.supplierBps), 7),
      "|",
      pad(supplierDbLabel, 8),
      "|",
      pad(nodeLabel, 12),
      "|"
    )

    if (match.googleIdCount === 0 && match.googleIds.length > 0) {
      console.log(`  ⚠ ${key}: ${match.googleIds.length} googleIds taxonomy, 0 en DB — vérifier import`)
    }
    if (match.affisellExtensionCount === 0 && entry.affisellFullPaths.length > 0) {
      console.log(
        `  ⚠ ${key}: extension Affisell manquante — lancer node scripts/taxonomy-upsert-extensions.mjs`
      )
    }
  }

  const unmappedInDb = await prisma.category.count({
    where: {
      googleId: { not: null, notIn: [...assignedGoogleIds] },
    },
  })

  const extensionsInDb = await prisma.category.count({
    where: { googleId: null, fullPath: { in: [...AFFISELL_TAXONOMY_EXTENSION_PATHS] } },
  })

  console.log("\nRésumé")
  console.log(`  Entrées grille métier        : ${GRID_ENTRY_COUNT}`)
  console.log(`  Extensions Affisell en DB    : ${extensionsInDb} / ${AFFISELL_TAXONOMY_EXTENSION_PATHS.length}`)
  console.log(`  Nœuds Google couverts       : ${assignedGoogleIds.size} (taxonomy-en)`)
  console.log(`  Nœuds Google en DB (match)  : ${totalGoogleNodes}`)
  console.log(`  Nœuds extension (match)     : ${totalExtensionNodes}`)
  console.log(`  Nœuds Google non mappés     : ${unmappedInDb} (restent à 10 % par défaut)`)
  console.log("\nAppliquer : npx tsx scripts/setup-commission.ts [--phase=both|affisell|supplier] [--dry-run]\n")
}

main()
  .catch((error) => {
    console.error("[affisell-commission-grid]", error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
