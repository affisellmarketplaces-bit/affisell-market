#!/usr/bin/env npx tsx
/**
 * Local runner for payout reconciliation cron.
 *
 * Usage:
 *   npm run reconcile:payouts
 *   npm run reconcile:payouts -- --limit=100
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
  const limit = Math.max(1, Number(arg("limit") ?? "1000") || 1000)
  const result = await reconcilePayouts(limit)
  console.log("[reconcile]", result)
}

main()
  .catch((error) => {
    console.error("[reconcile]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
