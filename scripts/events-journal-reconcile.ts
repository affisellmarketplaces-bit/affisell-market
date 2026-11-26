/**
 * READ-ONLY: does the business journal (S2) match its source tables over a window?
 *
 *   npx tsx --conditions=react-server scripts/events-journal-reconcile.ts --since 2026-01-01 [--until 2026-11-01]
 *
 * Rebuilds the expected events with the projection's own code and compares them with AffisellTrackEvent:
 * missing events, orphan events, and the refund rate the margin guard would read (journal vs sources).
 * Writes nothing. Exit codes: 0 consistent · 1 error or a source/the journal unreadable (nothing proven) · 6 inconsistent (re-run the backfill on the window, then again).
 * (`--conditions=react-server`: server-only modules.)
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const since = new Date(arg("since") ?? "")
  if (Number.isNaN(since.getTime())) throw new Error("--since <YYYY-MM-DD> is required")
  const until = arg("until") ? new Date(arg("until")!) : new Date()
  const { reconcileBusinessJournal, reconcileExitCode } = await import("../lib/events/journal-reconcile.server")
  const result = await reconcileBusinessJournal({ since, until })
  console.log(JSON.stringify(result, null, 2))
  return reconcileExitCode(result)
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("[events-journal-reconcile]", e instanceof Error ? e.message : e)
    process.exit(1)
  })
