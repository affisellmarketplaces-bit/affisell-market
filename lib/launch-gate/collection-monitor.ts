/**
 * Collection monitor — comparable snapshots of the presence-history collection, J+1 / J+7 stability, and what follows
 * for each engine (founder brief 2026-11-24 « Historical Collection Monitor »). PURE: it reads the JSON the existing
 * `report:presence-readiness --json` already produces (and, optionally, the activation-readiness JSON of the admin
 * route), and builds, compares and judges SNAPSHOTS. It connects to nothing, writes to no database, needs no table:
 * snapshots are files kept OUTSIDE the repository by the operator (`scripts/collection-snapshot.ts`).
 *
 * Rules:
 *  - a snapshot holds only enumerated values, counts, dates, a commit and an endpoint id — never a URL, a free text, an
 *    identifier of a reseller / product / order, or a raw error (`assertSnapshotClean` refuses anything else);
 *  - two snapshots of DIFFERENT environments are never compared (`compareSnapshots` → `comparable: false`); different
 *    application commits are compared but said;
 *  - a volume rising is a volume rising — never read as a quality improvement; quality is judged by checks, anomalies
 *    and the eight data-maturity dimensions, each with its own transition;
 *  - J+1 = a first TECHNICAL check; J+7 = a stability observation. Two identical reports are not proof: a window with
 *    no new event, or no reconciliation evidence, is « preuve insuffisante », never « stable »;
 *  - the monitor RECOMMENDS; it never executes a step, never changes a flag (`executesAutomatically: false`).
 */
import type { CheckStatus, PresenceReadinessReport } from "../listing-presence/integrity"
import { EXPECTED_TRIGGERS, PRESENCE_MIGRATION_NAME } from "../listing-presence/integrity"
import { LISTING_PRESENCE_SOURCES } from "../listing-presence/sources"
import type { ActivationReadinessReport, EngineId } from "../reseller-copilot/activation-readiness"
import { ENGINES } from "../reseller-copilot/activation-readiness"
import { captureProofLabel, sentinelForSnapshot, type SentinelResult, type SnapshotSentinel } from "../listing-presence/capture-sentinel"
import { engineMaturity, type DimensionId, type DimensionValue } from "./data-maturity"
import { ENGINE_OBSERVE_ORDER } from "./launch-gate"

export const SNAPSHOT_FORMAT = "affisell.collection-snapshot"
export const SNAPSHOT_VERSION = 1
export const SNAPSHOT_LABELS = ["etat_initial", "J+1", "J+7", "controle"] as const
export type SnapshotLabel = (typeof SNAPSHOT_LABELS)[number]

const HOUR = 3_600_000
const DAY = 24 * HOUR

const INTEGRITY_KEYS = [
  "events", "truncated", "futureEvents", "beforeTrackingStart", "chainBreaks", "createdNotFirst", "afterDeleted", "orderInversions", "duplicates",
  "orphanListings", "deletedButPresent", "stateMismatches", "createdWithoutEvent", "attributionMismatches", "preExistingListings",
  "reintroducedPairs", "relistings", "topResellerEventShare", "resellersWithEvents", "sentinelResidueListings",
] as const
type IntegrityKey = (typeof INTEGRITY_KEYS)[number]

export type SnapshotIntegrity = Partial<Record<IntegrityKey, number | boolean | null>> & {
  byKind: Record<string, number>
  bySource: Record<string, number>
  newestEventAt: string | null
}

export type SnapshotActivation = {
  data: { historyDays: number | null; periods: number; unjudgedPeriods: number; resellers: number; firstSales: number; unattributedShare: number | null }
  engines: Array<{ id: EngineId; level: number; state: string; resellersRequired: number; resellersMissing: number | null; gaps: Array<{ metric: string; required: number; available: number | null; missing: number | null }> }>
}

export type CollectionSnapshot = {
  format: typeof SNAPSHOT_FORMAT
  version: typeof SNAPSHOT_VERSION
  takenAt: string
  label: SnapshotLabel
  environment: { branch: "production" | "staging" | "local" | "unknown"; endpoint: string }
  appCommit: string | null
  schema: { migration: string; state: string; finishedAt: string | null; tableExists: boolean | null }
  global: CheckStatus
  checks: Array<{ id: string; section: string; status: CheckStatus; critical: boolean; executed: boolean }>
  triggers: Array<{ name: string; enabled: string; defects: number }>
  protection: { sessionReplicationRole: string | null; replicaDefaults: number | null; roleOwnsTable: boolean | null; roleHasTruncate: boolean | null }
  volumes: { listingsWithHistory: number; products: number; resellers: number; completePeriods: number; ongoingPeriods: number; unjudgedPeriods: number; periodsWithSale: number; censoredPeriods: number; historyDays: number | null } | null
  integrity: SnapshotIntegrity | null
  activation: SnapshotActivation | null
  /** Capture Sentinel result as it bears on THIS snapshot (same identified environment, within the validity window). */
  sentinel?: SnapshotSentinel | null
  anomalies: Anomaly[]
  limits: readonly string[]
}

export const SNAPSHOT_LIMITS = [
  "les réglages des AUTRES sessions PostgreSQL (mode réplique) ne sont pas visibles : seul le rapprochement après coup le révèle",
  "un propriétaire de la table peut désactiver le déclencheur ; seul l'instantané suivant le voit",
  "aucune activité = aucun événement : une fenêtre calme ne prouve ni ne dément la capture",
  "comptes agrégés seulement : aucun revendeur, produit ou commande identifié",
] as const

// ── Sanitising ─────────────────────────────────────────────────────────────────────────────────────────────────────

const KNOWN_SOURCES = new Set<string>([...LISTING_PRESENCE_SOURCES])
const TRIGGER_NAMES = new Set(EXPECTED_TRIGGERS.map((t) => t.name))
const isIso = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null)
const endpointOf = (e: unknown) => (typeof e === "string" && /^ep-[a-z0-9-]{3,60}$/.test(e) ? e : "non_identifie")
const commitOf = (c: unknown) => (typeof c === "string" && /^[0-9a-f]{7,40}$/.test(c) ? c : null)
const CHECK_ID = /^[A-E]\d?_[a-z0-9_]{1,60}$/
const STATUSES = new Set(["PASS", "WARN", "BLOCKED", "UNKNOWN"])

/** Throws when a value could carry a secret, a URL, an address or free text. Run on every snapshot written or read. */
export function assertSnapshotClean(value: unknown): void {
  const text = JSON.stringify(value)
  const bad = [/postgres(ql)?:\/\//i, /:\/\//, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\bsk_(live|test)_/i, /\brk_(live|test)_/i, /password/i, /\bsecret\b/i, /Bearer /i]
  for (const re of bad) if (re.test(text)) throw new Error(`instantané refusé : contenu interdit (${re.source})`)
}

// ── Building a snapshot ────────────────────────────────────────────────────────────────────────────────────────────

export function buildCollectionSnapshot(i: {
  readiness: PresenceReadinessReport
  activation?: ActivationReadinessReport | null
  appCommit: string | null
  takenAt: Date
  label: SnapshotLabel
  /** Optional Capture Sentinel result (`probe:capture-sentinel` JSON). Counts only for the same identified environment. */
  sentinel?: SentinelResult | null
}): CollectionSnapshot {
  const r = i.readiness
  const f = r.facts ?? null
  const integ = f?.integrity ?? null
  let integrity: SnapshotIntegrity | null = null
  if (integ) {
    integrity = { byKind: {}, bySource: {}, newestEventAt: isIso(integ.newestEventAt) ? integ.newestEventAt : null }
    for (const k of INTEGRITY_KEYS) {
      const v = (integ as Record<string, unknown>)[k]
      integrity[k] = typeof v === "boolean" ? v : num(v)
    }
    for (const k of ["created", "listed", "unlisted", "deleted"]) integrity.byKind[k] = num(integ.byKind?.[k]) ?? 0
    for (const [k, v] of Object.entries(integ.bySource ?? {})) {
      const key = KNOWN_SOURCES.has(k) ? k : "source_non_reconnue"
      integrity.bySource[key] = (integrity.bySource[key] ?? 0) + (num(v) ?? 0)
    }
  }
  const a = i.activation ?? null
  const snap: CollectionSnapshot = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    takenAt: i.takenAt.toISOString(),
    label: i.label,
    environment: { branch: (["production", "staging", "local"] as const).find((b) => b === r.target?.branch) ?? "unknown", endpoint: endpointOf(r.target?.endpoint) },
    appCommit: commitOf(i.appCommit),
    schema: {
      migration: PRESENCE_MIGRATION_NAME,
      state: f ? f.migrationRow : "non_lu",
      finishedAt: f && isIso(f.migrationFinishedAt) ? f.migrationFinishedAt : null,
      tableExists: f ? f.tableExists : null,
    },
    global: STATUSES.has(r.global) ? r.global : "UNKNOWN",
    checks: r.checks
      .filter((c) => CHECK_ID.test(c.id) && STATUSES.has(c.status))
      .map((c) => ({ id: c.id, section: c.section, status: c.status, critical: Boolean(c.critical), executed: Boolean(c.executed) })),
    triggers: (f?.triggers ?? []).filter((t) => TRIGGER_NAMES.has(t.name)).map((t) => ({ name: t.name, enabled: /^(O|D|R|A|absent)$/.test(t.enabled) ? t.enabled : "inconnu", defects: num(t.defects) ?? 0 })),
    protection: {
      sessionReplicationRole: f && /^(origin|replica|local)$/.test(String(f.sessionReplicationRole)) ? f.sessionReplicationRole : null,
      replicaDefaults: f ? num(f.replicaDefaults) : null,
      roleOwnsTable: typeof f?.roleOwnsTable === "boolean" ? f.roleOwnsTable : null,
      roleHasTruncate: typeof f?.roleHasTruncate === "boolean" ? f.roleHasTruncate : null,
    },
    volumes: r.volumes
      ? {
          listingsWithHistory: r.volumes.listingsWithHistory, products: r.volumes.products, resellers: r.volumes.resellers, completePeriods: r.volumes.completePeriods,
          ongoingPeriods: r.volumes.ongoingPeriods, unjudgedPeriods: r.volumes.unjudgedPeriods, periodsWithSale: r.volumes.periodsWithSale,
          censoredPeriods: r.volumes.censoredPeriods, historyDays: num(r.volumes.historyDays),
        }
      : null,
    integrity,
    activation: a
      ? {
          data: { historyDays: num(a.data.historyDays), periods: a.data.periods, unjudgedPeriods: a.data.unjudgedPeriods, resellers: a.data.resellers, firstSales: a.data.firstSales, unattributedShare: num(a.data.unattributedShare) },
          engines: a.engines.map((e) => ({ id: e.id, level: e.level, state: e.state, resellersRequired: e.resellersRequired, resellersMissing: e.resellersMissing, gaps: e.gaps.map((g) => ({ metric: String(g.metric).slice(0, 60), required: g.required, available: g.available, missing: g.missing })) })),
        }
      : null,
    sentinel: null,
    anomalies: [],
    limits: SNAPSHOT_LIMITS,
  }
  snap.sentinel = i.sentinel ? sentinelForSnapshot(i.sentinel, snap) : null
  snap.anomalies = detectAnomalies(snap)
  assertSnapshotClean(snap)
  return snap
}

/** Reads a snapshot file's JSON back, refusing anything that is not one or carries forbidden content. */
export function parseSnapshot(json: unknown): CollectionSnapshot {
  const s = json as CollectionSnapshot
  if (!s || s.format !== SNAPSHOT_FORMAT || s.version !== SNAPSHOT_VERSION || !isIso(s.takenAt) || !s.environment) throw new Error("fichier qui n'est pas un instantané de collecte (format ou version)")
  assertSnapshotClean(s)
  return s
}

// ── Anomalies ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type Severity = "bloquant" | "majeur" | "mineur" | "info"
const ACTIVITY_AMBIGUOUS_CODES = new Set(["aucun_evenement", "aucun_nouvel_evenement", "plus_aucune_observation"])
export type Anomaly = { code: string; severity: Severity; explanation: string }

/** Newest event older than this while listings exist = « no new observation ». */
export const STALE_EVENT_HOURS = 48
/** One reseller carrying more than this share of the events = concentration (statistics, not integrity). */
export const CONCENTRATION_SHARE = 0.6

export function detectAnomalies(s: CollectionSnapshot, previous?: CollectionSnapshot | null): Anomaly[] {
  const out: Anomaly[] = []
  const proved = s.sentinel?.status === "confirmee"
  const add = (code: string, severity: Severity, explanation: string) =>
    // « No event » is ambiguous (quiet shop OR broken capture). A probe of the SAME environment that just proved the
    // capture settles it: a quiet shop. That is the only thing the probe changes here.
    out.push(proved && ACTIVITY_AMBIGUOUS_CODES.has(code) ? { code, severity: "info", explanation: `${explanation} — capture prouvée par la sonde du ${s.sentinel!.takenAt} : activité calme` } : { code, severity, explanation })
  const g = s.integrity
  if (s.sentinel?.status === "echouee") add("sonde_echouee", "bloquant", `la sonde de capture a échoué sur cette base (${s.sentinel.failed.join(", ") || "étape inconnue"}) : une mutation contrôlée ne produit pas l'événement attendu`)
  if (s.sentinel?.status === "inconcluante") add("sonde_inconcluante", "mineur", `sonde interrompue ou incomplète (${s.sentinel.unknown.join(", ") || "—"}) : à relancer`)
  const v = (k: IntegrityKey) => (g ? num(g[k]) ?? 0 : 0)

  if (s.schema.state === "non_lu") add("base_non_lue", "info", "le rapport ne contient aucun fait de base de données (mode statique ou destination refusée)")
  for (const t of s.triggers) {
    if (t.enabled === "absent") add(`declencheur_absent:${t.name}`, "bloquant", "le déclencheur n'existe pas : rien n'est enregistré")
    else if (t.enabled === "D") add(`declencheur_desactive:${t.name}`, "bloquant", "déclencheur désactivé (DISABLE TRIGGER) : les changements ne sont plus enregistrés")
    else if (t.enabled === "R") add(`declencheur_replica_seulement:${t.name}`, "bloquant", "le déclencheur ne s'exécute qu'en mode réplique : capture coupée en fonctionnement normal")
    if (t.defects > 0) add(`declencheur_non_conforme:${t.name}`, "bloquant", `${t.defects} écart(s) avec la définition attendue`)
  }
  if ((s.protection.replicaDefaults ?? 0) > 0) add("mode_replique_par_defaut", "bloquant", "un rôle ou la base a session_replication_role = replica par défaut : les déclencheurs ne s'exécutent pas")
  if (s.protection.roleHasTruncate) add("role_peut_vider_la_table", "mineur", "le rôle lecteur a le droit TRUNCATE (refusé par le déclencheur hors maintenance, mais à séparer)")
  if (!g) return out

  if (g.truncated) add("historique_tronque", "majeur", "lecture plafonnée : les contrôles d'intégrité ne portent pas sur tout l'historique")
  const sources = g.bySource ?? {}
  if ((sources.unattributed ?? 0) > 0) add("evenements_non_attribues", "majeur", `${sources.unattributed} événement(s) « unattributed » : un écrivain ne déclare pas sa source (le verrou CI couvre le code ; une écriture hors application est possible)`)
  if ((sources.source_non_reconnue ?? 0) > 0) add("source_non_reconnue", "majeur", "source enregistrée que les moteurs ne savent pas lire")
  if (v("chainBreaks") > 0) add("ruptures_de_chaine", "majeur", `${v("chainBreaks")} événement(s) dont l'état précédent ne suit pas le précédent : un changement n'a pas été enregistré`)
  if (v("createdNotFirst") > 0) add("creation_non_premiere", "majeur", "« created » après d'autres événements d'une même annonce")
  if (v("afterDeleted") > 0) add("evenement_apres_suppression", "majeur", "événement enregistré après la suppression de l'annonce")
  if (v("orderInversions") > 0) add("horodatage_inverse", "mineur", `${v("orderInversions")} événement(s) dont la date précède le précédent (horloges concurrentes)`)
  if (v("futureEvents") > 0) add("dates_futures", "majeur", "événements datés dans le futur : incohérence UTC ou horloge")
  if ((num(g.beforeTrackingStart) ?? 0) > 0) add("dates_avant_le_debut", "majeur", "événements datés avant le début de l'historique : incohérence UTC")
  if (v("duplicates") > 0) add("doublons", "majeur", `${v("duplicates")} événement(s) identique(s) en double`)
  if (v("createdWithoutEvent") > 0) add("periodes_manquantes", "majeur", `${v("createdWithoutEvent")} annonce(s) créée(s) après le début sans événement « created »`)
  if (v("stateMismatches") > 0) add("annonce_differente_de_son_historique", "majeur", `${v("stateMismatches")} annonce(s) dont l'état actuel contredit le dernier événement`)
  if (v("deletedButPresent") > 0) add("supprimee_mais_presente", "majeur", "annonce présente alors que l'historique dit « supprimée »")
  if (v("orphanListings") > 0) add("annonces_disparues", "mineur", `${v("orphanListings")} annonce(s) disparue(s) sans événement « deleted »`)
  if ((g.bySource?.capture_sentinel ?? 0) > 0 || v("sentinelResidueListings") > 0) add("residu_de_sonde", "bloquant", "des données de la sonde de capture ont survécu (elle annule toujours sa transaction) : à nettoyer (cleanupSentinelResidue) avant toute analyse")
  if (v("attributionMismatches") > 0) add("attribution_incoherente", "majeur", "événements rattachés à un autre revendeur ou produit que l'annonce")

  const events = v("events")
  const ageH = g.newestEventAt ? (Date.parse(s.takenAt) - Date.parse(g.newestEventAt)) / HOUR : null
  const started = s.schema.finishedAt ? (Date.parse(s.takenAt) - Date.parse(s.schema.finishedAt)) / HOUR : null
  if (started != null && started >= 24 && events === 0) add("aucun_evenement", "majeur", "plus de 24 h après le début, aucun événement : capture inactive OU aucune activité (à départager par le rapprochement)")
  if (ageH != null && ageH > STALE_EVENT_HOURS && (s.volumes?.listingsWithHistory ?? 0) > 0) add("plus_aucune_observation", "majeur", `dernier événement il y a ${Math.round(ageH)} h (seuil ${STALE_EVENT_HOURS} h)`)
  const share = num(g.topResellerEventShare)
  if (share != null && share > CONCENTRATION_SHARE && (num(g.resellersWithEvents) ?? 0) >= 2) add("concentration_revendeur", "mineur", `un revendeur porte ${Math.round(share * 100)} % des événements : représentativité limitée pour les moteurs`)

  if (previous && sameEnvironment(previous, s)) {
    const pe = num(previous.integrity?.events) ?? 0
    if (events < pe) add("historique_en_recul", "bloquant", `${pe - events} événement(s) en moins depuis l'instantané précédent : purge, rollback ou restauration`)
    const ph = previous.volumes?.historyDays ?? null
    if (ph != null && s.volumes?.historyDays != null && s.volumes.historyDays < ph) add("couverture_en_recul", "bloquant", "la profondeur d'historique a diminué")
    if ((previous.volumes?.completePeriods ?? 0) > (s.volumes?.completePeriods ?? 0)) add("periodes_en_recul", "majeur", "moins de périodes terminées qu'à l'instantané précédent")
    const gapH = (Date.parse(s.takenAt) - Date.parse(previous.takenAt)) / HOUR
    if (gapH >= 24 && events === pe && pe > 0) add("aucun_nouvel_evenement", "majeur", `aucun nouvel événement en ${Math.round(gapH)} h`)
  }
  return out
}

// ── Comparing two snapshots ────────────────────────────────────────────────────────────────────────────────────────

export const sameEnvironment = (a: CollectionSnapshot, b: CollectionSnapshot) =>
  a.environment.branch === b.environment.branch && a.environment.endpoint === b.environment.endpoint && a.environment.endpoint !== "non_identifie"

export type Transition = "amelioration" | "stabilite" | "degradation" | "inconnue" | "non_applicable"
const RANK: Record<CheckStatus, number> = { PASS: 3, WARN: 2, BLOCKED: 0, UNKNOWN: -1 }

function statusTransition(a: CheckStatus | undefined, b: CheckStatus | undefined): Transition {
  if (!a || !b) return "non_applicable"
  if (a === "UNKNOWN" || b === "UNKNOWN") return a === b ? "inconnue" : b === "UNKNOWN" ? "degradation" : "inconnue"
  return RANK[b] > RANK[a] ? "amelioration" : RANK[b] < RANK[a] ? "degradation" : "stabilite"
}

function dimensionTransition(a: DimensionValue | undefined, b: DimensionValue | undefined): Transition {
  if (!a || !b) return "non_applicable"
  if (b === "inconnu") return "inconnue"
  if (a === "inconnu") return "inconnue"
  if (a === b) return "stabilite"
  return b === "satisfaisant" ? "amelioration" : "degradation"
}

export type SnapshotComparison =
  | { comparable: false; reason: string }
  | {
      comparable: true
      from: { takenAt: string; label: SnapshotLabel; appCommit: string | null }
      to: { takenAt: string; label: SnapshotLabel; appCommit: string | null }
      /** Capture proof at the later snapshot, in words (Capture Sentinel + passive report). */
      captureProof: string
      hoursBetween: number
      sameCommit: boolean
      global: { from: CheckStatus; to: CheckStatus; transition: Transition }
      checks: Array<{ id: string; from: CheckStatus | null; to: CheckStatus | null; transition: Transition }>
      /** Volumes are DELTAS, never a quality verdict. */
      volumes: Record<string, { from: number | null; to: number | null; delta: number | null }>
      anomalies: { new: Anomaly[]; resolved: Anomaly[]; persisting: Anomaly[] }
      dimensions: Array<{ engine: EngineId; dimension: DimensionId; from: DimensionValue | null; to: DimensionValue | null; transition: Transition }>
    }

const asActivation = (a: SnapshotActivation | null): ActivationReadinessReport | null =>
  a
    ? ({
        generatedAt: "",
        migrationApplied: true,
        trackingStartedAt: null,
        data: { ...a.data, coversBlindSpotWindow: false, censoredShare: null, resellersWithSale: 0, fullyFollowedSales: 0, fullyFollowedResellers: 0, salesCadencePerDay: null, productsAtProductTier: 0, productsAtJudgingFloors: 0 },
        engines: a.engines.map((e) => ({ ...e, name: e.id, flag: "", mode: "", dimensions: { technique: 0, donnees: 0, statistique: 0, securite: 0 }, levelLabel: "", mainDependency: "", etaDays: null, etaBasis: "", risk: "faible", exitConditions: [], nextAction: "", testsNeeded: [] })),
        sequence: [],
        checklist: [],
        limits: [],
      } as unknown as ActivationReadinessReport)
    : null

const asReadiness = (s: CollectionSnapshot): PresenceReadinessReport =>
  ({ generatedAt: s.takenAt, global: s.global, checks: s.checks.map((c) => ({ ...c, title: c.id, evidence: [] })), volumes: s.volumes } as unknown as PresenceReadinessReport)

/** The eight dimensions of one engine at a snapshot (stability uses the previous snapshot when given). */
export function snapshotMaturity(s: CollectionSnapshot, engine: EngineId, previous?: CollectionSnapshot | null) {
  return engineMaturity(engine, {
    now: new Date(s.takenAt),
    readiness: s.schema.state === "non_lu" ? null : asReadiness(s),
    activation: asActivation(s.activation),
    lastEventAt: s.integrity?.newestEventAt ? new Date(s.integrity.newestEventAt) : null,
    previous: previous && sameEnvironment(previous, s) ? asActivation(previous.activation) : null,
  })
}

export function compareSnapshots(a: CollectionSnapshot, b: CollectionSnapshot): SnapshotComparison {
  if (!sameEnvironment(a, b))
    return { comparable: false, reason: `environnements différents ou non identifiés (${a.environment.branch}/${a.environment.endpoint} ≠ ${b.environment.branch}/${b.environment.endpoint}) : jamais comparés comme une même base` }
  const [x, y] = Date.parse(a.takenAt) <= Date.parse(b.takenAt) ? [a, b] : [b, a]
  const ids = [...new Set([...x.checks.map((c) => c.id), ...y.checks.map((c) => c.id)])].sort()
  const vol = (s: CollectionSnapshot, k: string): number | null => (s.volumes ? num((s.volumes as Record<string, unknown>)[k]) : null) ?? (k === "events" ? num(s.integrity?.events) : null)
  const volumes: Record<string, { from: number | null; to: number | null; delta: number | null }> = {}
  for (const k of ["events", "listingsWithHistory", "products", "resellers", "completePeriods", "ongoingPeriods", "unjudgedPeriods", "periodsWithSale", "historyDays"]) {
    const f = vol(x, k)
    const t = vol(y, k)
    volumes[k] = { from: f, to: t, delta: f != null && t != null ? t - f : null }
  }
  const key = (an: Anomaly) => an.code
  const ya = detectAnomalies(y, x)
  const xa = new Set(x.anomalies.map(key))
  const yk = new Set(ya.map(key))
  const dimensions: Extract<SnapshotComparison, { comparable: true }>["dimensions"] = []
  for (const engine of ENGINES.map((e) => e.id)) {
    const m0 = snapshotMaturity(x, engine)
    const m1 = snapshotMaturity(y, engine, x)
    for (const d of m1.dimensions) {
      const before = m0.dimensions.find((q) => q.id === d.id)?.value
      dimensions.push({ engine, dimension: d.id, from: before ?? null, to: d.value, transition: d.id === "stabilite" ? (d.value === "inconnu" ? "inconnue" : d.value === "satisfaisant" ? "stabilite" : "degradation") : dimensionTransition(before, d.value) })
    }
  }
  return {
    comparable: true,
    from: { takenAt: x.takenAt, label: x.label, appCommit: x.appCommit },
    to: { takenAt: y.takenAt, label: y.label, appCommit: y.appCommit },
    captureProof: captureProofLabel(y.sentinel, (y.global === "PASS" || y.global === "WARN") && !ya.some((an) => an.severity === "bloquant")),
    hoursBetween: Math.round(((Date.parse(y.takenAt) - Date.parse(x.takenAt)) / HOUR) * 10) / 10,
    sameCommit: x.appCommit != null && x.appCommit === y.appCommit,
    global: { from: x.global, to: y.global, transition: statusTransition(x.global, y.global) },
    checks: ids.map((id) => {
      const f = x.checks.find((c) => c.id === id)?.status
      const t = y.checks.find((c) => c.id === id)?.status
      return { id, from: f ?? null, to: t ?? null, transition: statusTransition(f, t) }
    }),
    volumes,
    anomalies: { new: ya.filter((q) => !xa.has(q.code)), resolved: x.anomalies.filter((q) => !yk.has(q.code)), persisting: ya.filter((q) => xa.has(q.code)) },
    dimensions,
  }
}

// ── J+1 / J+7 stability ────────────────────────────────────────────────────────────────────────────────────────────

export type StabilityVerdict = "stable" | "instable" | "preuve_insuffisante" | "comparaison_impossible" | "observation_trop_precoce"
export type StabilityAssessment = { checkpoint: "J+1" | "J+7"; verdict: StabilityVerdict; criteria: Array<{ criterion: string; met: boolean | null; detail: string }>; executesAutomatically: false }

/** Signals that a quiet period produces just as well as a broken capture (decided by the reconciliation, not alone). */
export const ACTIVITY_AMBIGUOUS = ACTIVITY_AMBIGUOUS_CODES

/** Hours after the collection start each checkpoint needs at least (J+1 ≥ 20 h, J+7 ≥ 6.5 days). */
export const CHECKPOINT_MIN_HOURS = { "J+1": 20, "J+7": 156 } as const

/**
 * `baseline` = the state at (or right after) the start; `current` = the J+1 or J+7 snapshot; for J+7 `j1` = the J+1
 * snapshot (stability needs two successive readings after the start, not one). Criteria are documented in
 * docs/COLLECTION-MONITOR.md and never derived from volumes that do not exist yet.
 */
export function assessStability(checkpoint: "J+1" | "J+7", baseline: CollectionSnapshot, current: CollectionSnapshot, j1?: CollectionSnapshot | null): StabilityAssessment {
  const criteria: StabilityAssessment["criteria"] = []
  const done = (verdict: StabilityVerdict): StabilityAssessment => ({ checkpoint, verdict, criteria, executesAutomatically: false })
  if (!sameEnvironment(baseline, current) || (j1 && !sameEnvironment(j1, current))) {
    criteria.push({ criterion: "meme_environnement", met: false, detail: "instantanés d'environnements différents ou non identifiés" })
    return done("comparaison_impossible")
  }
  const start = current.schema.finishedAt ? Date.parse(current.schema.finishedAt) : null
  if (start == null) {
    criteria.push({ criterion: "debut_de_collecte_connu", met: null, detail: "date d'application de la migration non lue" })
    return done("preuve_insuffisante")
  }
  const hours = (Date.parse(current.takenAt) - start) / HOUR
  criteria.push({ criterion: "delai_depuis_le_debut", met: hours >= CHECKPOINT_MIN_HOURS[checkpoint], detail: `${Math.round(hours)} h depuis le début (minimum ${CHECKPOINT_MIN_HOURS[checkpoint]} h)` })
  if (hours < CHECKPOINT_MIN_HOURS[checkpoint]) return done("observation_trop_precoce")

  const anomalies = detectAnomalies(current, baseline)
  const blocking = anomalies.filter((a) => a.severity === "bloquant")
  // « No new event » can be a quiet shop OR a broken capture: it withholds the proof, it never proves instability.
  const major = anomalies.filter((a) => a.severity === "majeur" && !ACTIVITY_AMBIGUOUS.has(a.code))
  const triggersOk = current.triggers.length > 0 && current.triggers.every((t) => t.enabled === "O" || t.enabled === "A") && current.triggers.every((t) => t.defects === 0)
  criteria.push({ criterion: "declencheurs_actifs_et_conformes", met: current.triggers.length === 0 ? null : triggersOk, detail: current.triggers.length === 0 ? "état des déclencheurs non lu" : triggersOk ? "tous présents, actifs, conformes" : "au moins un absent, désactivé ou non conforme" })
  criteria.push({ criterion: "rapport_global", met: current.global === "PASS" || current.global === "WARN" ? true : current.global === "UNKNOWN" ? null : false, detail: `rapport ${current.global}` })
  criteria.push({ criterion: "aucune_anomalie_bloquante", met: blocking.length === 0, detail: blocking.map((a) => a.code).join(", ") || "aucune" })
  const newEvents = (num(current.integrity?.events) ?? 0) - (num(baseline.integrity?.events) ?? 0)
  // A confirmed probe of the same environment taken AFTER the baseline proves the capture when the shops were quiet.
  const probedSince = (t: string) => current.sentinel?.status === "confirmee" && !!current.sentinel.takenAt && Date.parse(current.sentinel.takenAt) > Date.parse(t)
  const probeNote = (t: string) => (probedSince(t) ? ` ; aucun événement réel mais capture prouvée par la sonde du ${current.sentinel!.takenAt}` : "")
  criteria.push({ criterion: "nouveaux_evenements", met: current.integrity ? newEvents > 0 || probedSince(baseline.takenAt) : null, detail: current.integrity ? `${newEvents} événement(s) depuis l'état initial${newEvents > 0 ? "" : probeNote(baseline.takenAt)}` : "intégrité non lue" })
  // Only a conclusive probe adds a criterion: an absent or expired probe never makes a window with real events weaker.
  if (current.sentinel && (current.sentinel.status === "confirmee" || current.sentinel.status === "echouee")) criteria.push({ criterion: "sonde_de_capture", met: current.sentinel.status === "confirmee" ? true : current.sentinel.status === "echouee" ? false : null, detail: captureProofLabel(current.sentinel, current.global === "PASS" || current.global === "WARN") })
  const reconciled = current.integrity ? (num(current.integrity.stateMismatches) ?? 0) === 0 && (num(current.integrity.createdWithoutEvent) ?? 1) === 0 : null
  criteria.push({ criterion: "annonces_concordent_avec_historique", met: reconciled, detail: "état actuel des annonces = dernier événement ; toute annonce créée après le début a son « created »" })
  const unattrNew = (current.integrity?.bySource?.unattributed ?? 0) - (baseline.integrity?.bySource?.unattributed ?? 0)
  criteria.push({ criterion: "provenance_des_nouveaux_evenements", met: current.integrity ? unattrNew === 0 : null, detail: `${unattrNew} nouvel(s) événement(s) « unattributed »` })
  const chrono = ["ruptures_de_chaine", "creation_non_premiere", "evenement_apres_suppression", "dates_futures", "dates_avant_le_debut", "doublons"]
  const chronoBad = anomalies.filter((a) => chrono.includes(a.code))
  criteria.push({ criterion: "coherence_des_evenements", met: current.integrity ? chronoBad.length === 0 : null, detail: chronoBad.map((a) => a.code).join(", ") || "aucune rupture, doublon ni date incohérente" })
  if (checkpoint === "J+7") {
    criteria.push({ criterion: "controle_J+1_disponible", met: j1 ? true : null, detail: j1 ? `J+1 du ${j1.takenAt}` : "aucun instantané J+1 : la stabilité demande deux lectures après le début" })
    if (j1) {
      const progressed = (num(current.integrity?.events) ?? 0) > (num(j1.integrity?.events) ?? 0)
      const probed = !progressed && probedSince(j1.takenAt)
      criteria.push({ criterion: "progression_depuis_J+1", met: progressed || probed, detail: progressed ? "événements en hausse depuis J+1" : probed ? `aucun événement réel depuis J+1${probeNote(j1.takenAt)}` : "aucun événement depuis J+1" })
      const regress = detectAnomalies(current, j1).filter((a) => a.severity === "bloquant")
      criteria.push({ criterion: "aucune_regression_depuis_J+1", met: regress.length === 0, detail: regress.map((a) => a.code).join(", ") || "aucune" })
      const periods = (current.volumes?.completePeriods ?? 0) + (current.volumes?.ongoingPeriods ?? 0)
      criteria.push({ criterion: "periodes_reconstruites", met: current.volumes ? periods > 0 : null, detail: current.volumes ? `${periods} période(s)` : "volumes non calculés" })
    }
  }
  if (blocking.length > 0 || criteria.some((c) => c.met === false && ["declencheurs_actifs_et_conformes", "rapport_global", "aucune_regression_depuis_J+1"].includes(c.criterion))) return done("instable")
  if (criteria.some((c) => c.met === null || c.met === false)) return done(major.length > 0 || criteria.some((c) => c.met === false && c.criterion === "coherence_des_evenements") ? "instable" : "preuve_insuffisante")
  return done("stable")
}

/** The launch gate's checkpoint value: only « stable » is PASS; instability BLOCKED; anything else UNKNOWN. */
export const toGateCheckpoint = (s: StabilityAssessment | null): CheckStatus => (!s ? "UNKNOWN" : s.verdict === "stable" ? "PASS" : s.verdict === "instable" ? "BLOCKED" : "UNKNOWN")

// ── What follows for each engine (a recommendation, never an execution) ────────────────────────────────────────────

export type EngineDecisionStatus =
  | "pret_techniquement"
  | "donnees_insuffisantes"
  | "historique_insuffisant"
  | "dependance_non_satisfaite"
  | "anomalie_bloquante"
  | "maturite_inconnue"
  | "observation_autorisable_sous_conditions"

export type EngineDecision = { engine: EngineId; order: number; status: EngineDecisionStatus; reasons: string[]; requiresAuthorization: string; executesAutomatically: false }

export function engineObservationDecisions(current: CollectionSnapshot, j7: StabilityAssessment | null, previous?: CollectionSnapshot | null): EngineDecision[] {
  const blocking = detectAnomalies(current, previous ?? null).filter((a) => a.severity === "bloquant")
  const out: EngineDecision[] = []
  let earlierOk = true
  for (const [idx, engine] of ENGINE_OBSERVE_ORDER.entries()) {
    const reasons: string[] = []
    let status: EngineDecisionStatus
    const m = snapshotMaturity(current, engine, previous ?? null)
    const dim = (id: DimensionId) => m.dimensions.find((d) => d.id === id)?.value ?? "inconnu"
    if (blocking.length > 0) {
      status = "anomalie_bloquante"
      reasons.push(...blocking.map((a) => a.code))
    } else if (!j7 || j7.verdict !== "stable") {
      status = j7?.verdict === "instable" ? "anomalie_bloquante" : "maturite_inconnue"
      reasons.push(`contrôle J+7 : ${j7?.verdict ?? "non fait"}`)
    } else if (!earlierOk) {
      status = "dependance_non_satisfaite"
      reasons.push(`${ENGINE_OBSERVE_ORDER[idx - 1]} doit d'abord pouvoir passer en observation`)
    } else if (!current.activation) {
      status = "pret_techniquement"
      reasons.push("collecte stable ; maturité des données non mesurée (préparation des moteurs non fournie)")
    } else if (dim("couverture_temporelle") === "insuffisant") {
      status = "historique_insuffisant"
      reasons.push(m.dimensions.find((d) => d.id === "couverture_temporelle")!.evidence)
    } else if (["diversite", "suffisance", "completude", "provenance"].some((d) => dim(d as DimensionId) === "insuffisant")) {
      status = "donnees_insuffisantes"
      reasons.push(...m.dimensions.filter((d) => d.value === "insuffisant").map((d) => `${d.id} : ${d.evidence}`))
    } else if (m.dimensions.some((d) => d.value === "inconnu")) {
      status = "maturite_inconnue"
      reasons.push(...m.dimensions.filter((d) => d.value === "inconnu").map((d) => `${d.id} : ${d.evidence}`))
    } else {
      status = "observation_autorisable_sous_conditions"
      reasons.push("collecte stable et données mûres ; reste l'autorisation écrite E propre à ce moteur")
    }
    // An engine is « done » for the dependency chain only when it could be observed; anything else holds the next ones.
    earlierOk = earlierOk && (status === "observation_autorisable_sous_conditions" || status === "pret_techniquement")
    out.push({ engine, order: idx + 1, status, reasons, requiresAuthorization: `autorisation écrite E pour ${engine} (launch gate)`, executesAutomatically: false })
  }
  return out
}

/** Text rendering of a comparison + stability + decisions (aggregates only). */
export function formatMonitorReport(r: { comparison: SnapshotComparison; stability: StabilityAssessment | null; decisions: EngineDecision[] | null }): string {
  const out: string[] = []
  const c = r.comparison
  if (!c.comparable) return `COMPARAISON IMPOSSIBLE — ${c.reason}`
  out.push(`Suivi de la collecte — ${c.from.label} (${c.from.takenAt}) → ${c.to.label} (${c.to.takenAt}), ${c.hoursBetween} h`)
  out.push(c.sameCommit ? `Commit applicatif identique (${c.to.appCommit})` : `COMMITS DIFFÉRENTS : ${c.from.appCommit ?? "inconnu"} → ${c.to.appCommit ?? "inconnu"}`)
  out.push(`Rapport global : ${c.global.from} → ${c.global.to} (${c.global.transition})`, `Preuve de capture : ${c.captureProof}`, "", "CONTRÔLES")
  for (const k of c.checks) out.push(`  ${k.id} : ${k.from ?? "—"} → ${k.to ?? "—"} (${k.transition})`)
  out.push("", "VOLUMES (écarts — jamais un verdict de qualité)")
  for (const [k, v] of Object.entries(c.volumes)) out.push(`  ${k} : ${v.from ?? "?"} → ${v.to ?? "?"}${v.delta != null ? ` (${v.delta >= 0 ? "+" : ""}${v.delta})` : ""}`)
  out.push("", "ANOMALIES")
  for (const a of c.anomalies.new) out.push(`  NOUVELLE [${a.severity}] ${a.code} — ${a.explanation}`)
  for (const a of c.anomalies.persisting) out.push(`  PERSISTANTE [${a.severity}] ${a.code} — ${a.explanation}`)
  for (const a of c.anomalies.resolved) out.push(`  RÉSOLUE ${a.code}`)
  out.push("", "HUIT DIMENSIONS PAR MOTEUR (transition)")
  for (const engine of ENGINES.map((e) => e.id)) out.push(`  ${engine} : ${c.dimensions.filter((d) => d.engine === engine).map((d) => `${d.dimension}=${d.transition}`).join(" · ")}`)
  if (r.stability) {
    out.push("", `STABILITÉ ${r.stability.checkpoint} : ${r.stability.verdict}`)
    for (const k of r.stability.criteria) out.push(`  [${k.met === true ? "oui" : k.met === false ? "NON" : "?"}] ${k.criterion} — ${k.detail}`)
  }
  if (r.decisions) {
    out.push("", "MOTEURS — recommandation, aucune exécution (autorisation E distincte par moteur)")
    for (const d of r.decisions) out.push(`  ${d.order}. ${d.engine} : ${d.status} — ${d.reasons.join(" ; ")}`)
  }
  return out.join("\n")
}

export { DAY as MONITOR_DAY_MS }
