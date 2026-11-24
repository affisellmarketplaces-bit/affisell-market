/**
 * Instantané de la collecte de l'historique de présence (lib/launch-gate/collection-monitor.ts).
 *
 *   npm run report:collection-snapshot -- --readiness <rapport.json> --label etat_initial|J+1|J+7|controle
 *        [--activation <preparation-moteurs.json>] [--sentinel <sonde.json>] [--out <dossier hors dépôt>] [--stdout]
 *
 * <rapport.json> = la sortie de `report:presence-readiness -- --json`, produite à la main sur la destination.
 * <sonde.json> = la sortie de `probe:capture-sentinel` ; elle ne compte que pour la MÊME base identifiée, à ± 6 h.
 * Ne se connecte à AUCUNE base et à aucun réseau. Écrit un JSON assaini (comptes, statuts, dates, commit, endpoint)
 * dans ~/.affisell/collection-snapshots par défaut — JAMAIS dans le dépôt (refusé).
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { buildCollectionSnapshot, SNAPSHOT_LABELS, type SnapshotLabel } from "../lib/launch-gate/collection-monitor"
import type { SentinelResult } from "../lib/listing-presence/capture-sentinel"
import type { PresenceReadinessReport } from "../lib/listing-presence/integrity"
import type { ActivationReadinessReport } from "../lib/reseller-copilot/activation-readiness"

const arg = (n: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}
const fail = (msg: string) => {
  console.error(msg)
  process.exitCode = 2
}
const git = (args: string[]) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 }).trim()
  } catch {
    return null
  }
}

function main() {
  const readinessFile = arg("--readiness")
  const label = arg("--label") as SnapshotLabel | null
  if (!readinessFile) return fail("--readiness <fichier.json> requis (sortie de report:presence-readiness -- --json)")
  if (!label || !SNAPSHOT_LABELS.includes(label)) return fail(`--label requis : ${SNAPSHOT_LABELS.join(" | ")}`)
  let readiness: PresenceReadinessReport
  let activation: ActivationReadinessReport | null = null
  let sentinel: SentinelResult | null = null
  try {
    readiness = JSON.parse(readFileSync(readinessFile, "utf8"))
    if (!Array.isArray(readiness.checks)) throw new Error("shape")
    const act = arg("--activation")
    if (act) activation = JSON.parse(readFileSync(act, "utf8")) as ActivationReadinessReport
    const probe = arg("--sentinel")
    if (probe) sentinel = JSON.parse(readFileSync(probe, "utf8")) as SentinelResult
  } catch {
    return fail("fichier d'entrée illisible ou d'un autre format")
  }
  if (!readiness.target) return fail("le rapport ne dit pas quelle base il a lue (champ target) : instantané refusé — relancer report:presence-readiness à jour")
  let snapshot
  try {
    snapshot = buildCollectionSnapshot({ readiness, activation, sentinel, appCommit: git(["rev-parse", "HEAD"]), takenAt: new Date(), label })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "instantané refusé")
  }
  const json = JSON.stringify(snapshot, null, 2)
  if (process.argv.includes("--stdout")) {
    console.log(json)
    return
  }
  const dir = path.resolve(arg("--out") ?? path.join(os.homedir(), ".affisell", "collection-snapshots"))
  const repo = git(["rev-parse", "--show-toplevel"])
  if (repo && (dir === path.resolve(repo) || dir.startsWith(path.resolve(repo) + path.sep))) return fail("dossier de sortie DANS le dépôt : refusé (les instantanés opérationnels restent hors du dépôt)")
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${snapshot.environment.branch}-${snapshot.environment.endpoint}-${snapshot.takenAt.replace(/[:.]/g, "-")}-${label}.json`)
  writeFileSync(file, json, { mode: 0o600 })
  console.log(`instantané écrit : ${file}`)
}

main()
