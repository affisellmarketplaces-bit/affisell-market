/**
 * CI: compare a chain-built database with the strict schema-drift baseline (docs/SCHEMA-DRIFT-BASELINE.md).
 *
 *   npx tsx scripts/ci/check-schema-drift.ts --label <name> --diff <prisma-diff.sql> --catalog <catalog.txt>
 *                                            [--baseline prisma/schema-drift-baseline.json] [--expect-reject <marker>]
 *
 * Reads FILES only (the prisma diff script and a catalogue dump produced by scripts/ci/migration-chain-check.sh):
 * no database connection, no network. Prints the report (and appends it to $GITHUB_STEP_SUMMARY when set).
 * Exit 0 = conforms, 1 = rejected. With --expect-reject <marker> (negative tests): exit 0 only when the verdict is a
 * rejection AND the report contains <marker>; a negative test that is accepted is itself a failure.
 */
import { appendFileSync, readFileSync } from "node:fs"
import path from "node:path"

import { compareToBaseline, formatDriftReport, type SchemaDriftBaseline } from "../../lib/schema-drift/baseline"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

const root = path.resolve(__dirname, "../..")
const label = arg("label") ?? "base"
const diffFile = arg("diff")
const catalogFile = arg("catalog")
const baselineFile = arg("baseline") ?? path.join(root, "prisma/schema-drift-baseline.json")
const expectReject = arg("expect-reject")
if (!diffFile || !catalogFile) {
  console.error("usage: check-schema-drift.ts --label <name> --diff <file> --catalog <file> [--baseline <file>] [--expect-reject <marker>]")
  process.exit(2)
}

let baseline: SchemaDriftBaseline | null = null
let verdictText: string
let ok: boolean
try {
  baseline = JSON.parse(readFileSync(baselineFile, "utf8")) as SchemaDriftBaseline
  const v = compareToBaseline(baseline, readFileSync(diffFile, "utf8"), readFileSync(catalogFile, "utf8"))
  verdictText = formatDriftReport(v, label, baseline)
  ok = v.ok
} catch (e) {
  verdictText = `## Dérive de schéma — ${label} : REJETÉE\n\nLecture impossible : ${(e as Error).message}`
  ok = false
}

console.log(verdictText)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${verdictText}\n\n`)

if (expectReject !== undefined) {
  const proved = !ok && verdictText.includes(expectReject)
  console.log(proved
    ? `NEGATIVE TEST OK — « ${label} » rejeté, et le rapport nomme « ${expectReject} »`
    : `::error::NEGATIVE TEST FAILED — « ${label} » ${ok ? "a été ACCEPTÉ" : `rejeté sans nommer « ${expectReject} »`}`)
  process.exit(proved ? 0 : 1)
}
process.exit(ok ? 0 : 1)
