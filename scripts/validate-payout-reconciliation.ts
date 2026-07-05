#!/usr/bin/env npx tsx
/**
 * Phase 7 — Full payout reconciliation validation report.
 *
 * Usage:
 *   npm run validate:payouts
 *   npm run validate:payouts -- --limit=500
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

import { reconcilePayouts } from "@/lib/cron/reconcile-payouts"
import { prisma } from "@/lib/prisma"

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.split("=").slice(1).join("=")
}

async function main() {
  const limit = Math.max(1, Number(arg("limit") ?? "5000") || 5000)

  console.log("[validate-payouts]", { limit, metric: "scan_start" })

  const result = await reconcilePayouts(limit)

  const byKind = new Map<string, number>()
  for (const d of result.divergences) {
    byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1)
  }

  console.log("[validate-payouts]", {
    scanned: result.scanned,
    settled: result.settled,
    skippedNoPayout: result.skippedNoPayout,
    divergenceCount: result.divergences.length,
    byKind: Object.fromEntries(byKind),
    result: result.divergences.length === 0 ? "PASS" : "FAIL",
  })

  if (result.divergences.length > 0) {
    console.log("\n--- Divergences ---")
    for (const d of result.divergences.slice(0, 50)) {
      console.log(
        JSON.stringify({
          orderId: d.orderId,
          kind: d.kind,
          expectedCents: d.expectedCents,
          actualCents: d.actualCents,
          deltaCents: d.deltaCents,
          detail: d.detail ?? null,
        })
      )
    }
    if (result.divergences.length > 50) {
      console.log(`… and ${result.divergences.length - 50} more`)
    }
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error("[validate-payouts]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
