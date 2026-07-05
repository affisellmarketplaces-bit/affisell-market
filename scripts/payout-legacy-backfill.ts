#!/usr/bin/env npx tsx
/**
 * Backfill pre-unification phantom payouts (ledger / payoutAt without Stripe Connect).
 *
 * Usage:
 *   npm run payout:legacy:scan
 *   npm run payout:legacy:backfill -- --dry-run
 *   npm run payout:legacy:backfill -- --execute --limit=20
 *   npm run payout:legacy:backfill -- --execute --order-id=clxxx
 *   npm run payout:legacy:backfill -- --mark-phantom-all
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

import {
  markAllPhantomLegacyLedgerRows,
  remediateLegacyPayoutBatch,
  remediateLegacyPayoutOrder,
  scanLegacyPayoutOrders,
} from "@/lib/payout-legacy-backfill"
import { prisma } from "@/lib/prisma"

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.split("=").slice(1).join("=")
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  const orderId = arg("order-id")
  const limit = Math.max(1, Number(arg("limit") ?? "50") || 50)
  const dryRun = hasFlag("dry-run") || (!hasFlag("execute") && !hasFlag("mark-phantom-all"))
  const execute = hasFlag("execute")
  const markPhantomAll = hasFlag("mark-phantom-all")

  if (markPhantomAll) {
    if (dryRun && !execute) {
      const scan = await scanLegacyPayoutOrders({ limit: 1000 })
      console.log("[payout-legacy-backfill]", {
        action: "mark_phantom_dry_run",
        phantomLedgerRows: scan.phantomLedgerRows,
        needsRemediation: scan.needsRemediation,
      })
      return
    }
    const count = await markAllPhantomLegacyLedgerRows()
    console.log("[payout-legacy-backfill]", { action: "mark_phantom_all", count })
  }

  if (orderId) {
    const scan = await scanLegacyPayoutOrders({ orderId })
    console.log("[payout-legacy-backfill]", { action: "scan_one", scan })
    if (execute || hasFlag("dry-run")) {
      const result = await remediateLegacyPayoutOrder(orderId, {
        dryRun: !execute,
        runTransfers: execute,
      })
      console.log("[payout-legacy-backfill]", { action: execute ? "remediate_one" : "dry_run_one", result })
    }
    return
  }

  const scan = await scanLegacyPayoutOrders({ limit })
  console.log("[payout-legacy-backfill]", {
    action: "scan",
    scannedOrders: scan.scannedOrders,
    needsRemediation: scan.needsRemediation,
    phantomLedgerRows: scan.phantomLedgerRows,
    sample: scan.orders.slice(0, 10),
  })

  if (execute) {
    const batch = await remediateLegacyPayoutBatch({ limit, dryRun: false })
    console.log("[payout-legacy-backfill]", {
      action: "batch_remediate",
      remediated: batch.results.length,
      success: batch.results.filter((r) => !r.skippedReason).length,
      skipped: batch.results.filter((r) => r.skippedReason).length,
      results: batch.results,
    })
  } else if (hasFlag("dry-run")) {
    const batch = await remediateLegacyPayoutBatch({ limit, dryRun: true })
    console.log("[payout-legacy-backfill]", {
      action: "batch_dry_run",
      wouldRemediate: batch.results.length,
      results: batch.results,
    })
  }
}

main()
  .catch((error) => {
    console.error("[payout-legacy-backfill]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
