#!/usr/bin/env npx tsx
/**
 * Applique les grilles commission Affisell (phase 1) et fournisseur→affilié (phase 2).
 *
 * Usage:
 *   npx tsx scripts/setup-commission.ts --dry-run
 *   npx tsx scripts/setup-commission.ts --phase=affisell
 *   npx tsx scripts/setup-commission.ts --phase=supplier
 *   npx tsx scripts/setup-commission.ts --phase=both
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"

import { affisellCommissionRateBpsToPercent } from "@/lib/affisell-platform-commission"
import {
  buildCategoryAffisellBpsPlan,
  buildCategorySupplierBpsPlan,
  summarizeCommissionPlan,
  type CategoryCommissionTarget,
} from "@/lib/commission-grid-apply"
import { COMMISSION_GRID_MAP, formatBpsPercent } from "@/lib/commission-grid-config"
import { supplierCommissionRateBpsToPercent } from "@/lib/supplier-commission-rate"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

type CommissionPhase = "affisell" | "supplier" | "both"

function parsePhase(): CommissionPhase {
  const arg = process.argv.find((a) => a.startsWith("--phase="))
  const value = arg?.split("=")[1]?.trim()
  if (value === "affisell" || value === "supplier" || value === "both") return value
  return "both"
}

function logPlanSummary(label: string, plan: CategoryCommissionTarget[], formatPercent: (bps: number) => number) {
  const summary = summarizeCommissionPlan(plan)
  console.log(`\n[setup-commission] ${label}\n`)
  console.log(`  Catégories en base          : ${summary.total}`)
  console.log(`  Déjà à jour                 : ${summary.unchanged}`)
  console.log(`  À mettre à jour             : ${summary.updated}`)
  console.log(`  Mode                        : ${dryRun ? "dry-run" : "apply"}`)

  console.log("\n  Répartition cible:")
  const sortedBps = [...summary.byTargetBps.entries()].sort((a, b) => a[0] - b[0])
  for (const [bps, count] of sortedBps) {
    console.log(
      `    ${formatBpsPercent(bps).padStart(6)} (${bps} bps) → ${count} catégories`
    )
  }

  const changes = plan.filter((row) => row.currentBps !== row.targetBps)
  if (changes.length > 0) {
    console.log("\n  Exemples de changements:")
    for (const row of changes.slice(0, 8)) {
      const from =
        row.currentBps == null ? "null" : `${formatPercent(row.currentBps)}%`
      const to = `${formatPercent(row.targetBps)}%`
      console.log(`    · ${row.fullPath}: ${from} → ${to}`)
    }
    if (changes.length > 8) {
      console.log(`    … +${changes.length - 8} autres`)
    }
  }

  return { summary, changes }
}

async function applyPlan(
  changes: CategoryCommissionTarget[],
  field: "affisellCommissionRateBps" | "supplierCommissionRateBps"
): Promise<number> {
  const byTargetBps = new Map<number, string[]>()
  for (const row of changes) {
    const ids = byTargetBps.get(row.targetBps) ?? []
    ids.push(row.id)
    byTargetBps.set(row.targetBps, ids)
  }

  let updated = 0
  for (const [bps, ids] of byTargetBps) {
    const result = await prisma.category.updateMany({
      where: { id: { in: ids } },
      data: { [field]: bps },
    })
    updated += result.count
  }
  return updated
}

async function main() {
  const phase = parsePhase()
  console.log("\n[setup-commission] Grilles métier Affisell\n")
  console.log(`  Entrées grille              : ${Object.keys(COMMISSION_GRID_MAP).length}`)
  console.log(`  Phase                       : ${phase}`)

  let totalUpdated = 0

  if (phase === "affisell" || phase === "both") {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        googleId: true,
        fullPath: true,
        affisellCommissionRateBps: true,
      },
    })
    const plan = buildCategoryAffisellBpsPlan(categories)
    const { changes } = logPlanSummary("Phase 1 — Affisell plateforme", plan, affisellCommissionRateBpsToPercent)
    if (!dryRun && changes.length > 0) {
      totalUpdated += await applyPlan(changes, "affisellCommissionRateBps")
    }
  }

  if (phase === "supplier" || phase === "both") {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        googleId: true,
        fullPath: true,
        supplierCommissionRateBps: true,
      },
    })
    const plan = buildCategorySupplierBpsPlan(categories)
    const { changes } = logPlanSummary(
      "Phase 2 — Fournisseur → affilié",
      plan,
      supplierCommissionRateBpsToPercent
    )
    if (!dryRun && changes.length > 0) {
      totalUpdated += await applyPlan(changes, "supplierCommissionRateBps")
    }
  }

  console.log("\n[setup-commission]", {
    result: dryRun ? "dry-run" : "applied",
    phase,
    updated: dryRun ? undefined : totalUpdated,
  })
}

main()
  .catch((error) => {
    console.error("[setup-commission]", error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
