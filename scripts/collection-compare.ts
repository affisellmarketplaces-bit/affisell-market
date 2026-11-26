/**
 * Comparaison déterministe de deux instantanés de collecte + stabilité J+1 / J+7 + recommandation par moteur
 * (lib/launch-gate/collection-monitor.ts). Ne lit que des fichiers ; aucune base, aucun réseau, rien n'est exécuté.
 *
 *   npm run report:collection-compare -- --from <a.json> --to <b.json>
 *        [--check J+1|J+7 --baseline <etat_initial.json> [--j1 <J+1.json>]] [--json]
 */
import { readFileSync } from "node:fs"

import { assessStability, compareSnapshots, engineObservationDecisions, formatMonitorReport, parseSnapshot } from "../lib/launch-gate/collection-monitor"

const arg = (n: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}
const load = (f: string) => parseSnapshot(JSON.parse(readFileSync(f, "utf8")))

function main() {
  const fromF = arg("--from")
  const toF = arg("--to")
  if (!fromF || !toF) {
    console.error("--from <instantané.json> et --to <instantané.json> requis")
    process.exitCode = 2
    return
  }
  let from, to, baseline, j1
  try {
    from = load(fromF)
    to = load(toF)
    const b = arg("--baseline")
    baseline = b ? load(b) : null
    const j = arg("--j1")
    j1 = j ? load(j) : null
  } catch (e) {
    console.error(e instanceof Error ? e.message : "instantané illisible")
    process.exitCode = 2
    return
  }
  const comparison = compareSnapshots(from, to)
  const check = arg("--check")
  const stability = check === "J+1" || check === "J+7" ? assessStability(check, baseline ?? from, to, j1) : null
  const decisions = stability?.checkpoint === "J+7" ? engineObservationDecisions(to, stability, j1 ?? from) : null
  const report = { comparison, stability, decisions }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatMonitorReport(report))
  if (!comparison.comparable) process.exitCode = 2
}

main()
