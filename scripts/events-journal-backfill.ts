/**
 * Rebuild the business journal (event spine S2) from the source tables.
 *
 *   npx tsx --conditions=react-server scripts/events-journal-backfill.ts --since 2026-01-01   (dry run: counts only)
 *   EVENTS_JOURNAL=on npx tsx --conditions=react-server scripts/events-journal-backfill.ts --since 2026-01-01 --apply
 *
 * Idempotent (deterministic eventIds: re-running writes nothing new). Reads the sources, writes AffisellTrackEvent only.
 * (`--conditions=react-server`: the projector is a server-only module.)
 * Requires the `event_spine` migration (verify with `npm run schema:verify`). Production needs
 * AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint> (scripts/lib/production-guard.mjs).
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { assertNotProductionByAccident } from "./lib/production-guard.mjs"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const since = new Date(arg("since") ?? "")
  if (Number.isNaN(since.getTime())) throw new Error("--since <YYYY-MM-DD> is required")
  const until = arg("until") ? new Date(arg("until")!) : new Date()
  const apply = process.argv.includes("--apply")
  if (apply) assertNotProductionByAccident("scripts/events-journal-backfill.ts")
  const { projectBusinessJournal } = await import("../lib/events/journal-projector.server")
  const result = await projectBusinessJournal({ since, until, dryRun: !apply })
  console.log(JSON.stringify(result, null, 2))
  if (apply && !result.enabled) console.error("EVENTS_JOURNAL is not 'on': nothing was written")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[events-journal-backfill]", e instanceof Error ? e.message : e)
    process.exit(1)
  })
