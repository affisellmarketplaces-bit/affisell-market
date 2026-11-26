/**
 * READ-ONLY: is the reseller copilot right? Platform-wide, over the last 180 days of paid orders:
 * estimated (copilot model on the checkout snapshot) vs settled (settlement function) vs due vs paid (money that
 * actually moved), with bias, mean absolute error, a 95 % interval and a verdict per category (none under 30 orders).
 *
 *   npx tsx --conditions=react-server scripts/report-copilot-accuracy.ts            # human-readable
 *   npx tsx --conditions=react-server scripts/report-copilot-accuracy.ts --json
 *
 * Uses the DATABASE_URL of .env.local / .env — possibly PRODUCTION (reads only, through lib/prisma).
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const eur = (c: number) => `${(c / 100).toFixed(2)} €`

async function main() {
  const { loadCopilotAccuracy } = await import("../lib/copilot-insights.server")
  const r = await loadCopilotAccuracy({ affiliateId: null })
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ overall: r.overall, byCategory: r.byCategory }, null, 2))
    return
  }
  const o = r.overall
  console.log(`Orders: ${o.orders} · verdict: ${o.verdict}`)
  console.log(`Bias ${eur(o.biasCents)} ± ${o.biasCi95Cents == null ? "n/a" : eur(o.biasCi95Cents)} · MAE ${eur(o.maeCents)} · exact ${(o.exactShare * 100).toFixed(1)} %`)
  console.log(`Estimated ${eur(o.totals.estimated)} · settled ${eur(o.totals.settled)} · due ${eur(o.totals.due)} · paid ${eur(o.totals.paid)} · outstanding ${eur(o.totals.outstanding)} · recorded, not transferred ${eur(o.totals.recordedNotTransferred)}`)
  console.log(`Refunds: expected ${(o.expectedRefundShare * 100).toFixed(1)} % · realised ${(o.realisedRefundShare * 100).toFixed(1)} %`)
  for (const c of r.byCategory.slice(0, 30)) {
    console.log(`  ${c.key.padEnd(28)} ${String(c.stats.orders).padStart(6)} orders  ${c.stats.verdict.padEnd(18)} bias ${eur(c.stats.biasCents)}  MAE ${eur(c.stats.maeCents)}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[report-copilot-accuracy]", e instanceof Error ? e.message : e)
    process.exit(1)
  })
