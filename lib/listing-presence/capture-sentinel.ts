/**
 * Capture Sentinel — an ACTIVE proof that the presence-history capture works (founder brief 2026-11-24, portfolio row 47).
 *
 * The collection monitor reads what the database already holds. When no event appears it can not tell a quiet shop from
 * a broken capture. The sentinel makes a controlled change and checks the event the database really recorded.
 *
 * Architecture: « transactional probe ».
 * - ONE transaction creates its own synthetic merchant, product and listing, all with ids under `capture-sentinel-`.
 * - It runs five mutations through the same path the application uses (Prisma + the source declaration):
 *   create (unlisted) → list → unchanged save → unlist → delete.
 * - After each mutation it reads the event the trigger wrote, then ROLLS EVERYTHING BACK.
 * - PostgreSQL's own atomicity is the cleanup: nothing the probe wrote can survive, a real listing is never touched,
 *   and no commercial figure can count it.
 * - The session time zone is deliberately far from UTC (+12:45 / +13:45), so a capture that forgot the UTC conversion
 *   is off by ≥ 12 h and can not pass.
 *
 * Pure: the destination decision, the expected events, the evaluation and the monitor summary. The runner that talks to a
 * database is `capture-sentinel-run.ts`. Relative imports only (a `tsx` script loads it).
 */
export const SENTINEL_FORMAT = "affisell.capture-sentinel"
export const SENTINEL_VERSION = 1
export const SENTINEL_SOURCE = "capture_sentinel" as const
export const SENTINEL_ID_PREFIX = "capture-sentinel-"
/** +12:45 (+13:45 in summer): a capture that writes local time instead of UTC is off by at least 12 hours. */
export const SENTINEL_PROBE_TIME_ZONE = "Pacific/Chatham"
/**
 * How long a probe result vouches for a snapshot of the SAME environment (before or after it). What breaks a capture
 * comes with a change (deploy, migration, role setting, maintenance). Six hours keeps the result bound to the moment of
 * the snapshot it backs, at no cost: the probe writes nothing that survives.
 */
export const SENTINEL_VALIDITY_HOURS = 6

export type SentinelStatus = "PASS" | "FAIL" | "UNKNOWN" | "NOT_RUN"
export type SentinelEnvironment = { kind: "local" | "ci" | "staging"; branch: "local" | "staging"; endpoint: string }

/** What a probe result DOES NOT prove — printed with every result and kept in the snapshot. */
export const SENTINEL_LIMITS = [
  "prouve que CE mécanisme (déclencheur, fonction, déclaration de source, UTC) enregistre une mutation contrôlée, dans la session de la sonde",
  "ne prouve pas que toutes les mutations réelles sont capturées (une autre session en mode réplique, un propriétaire qui désactive le déclencheur)",
  "ne prouve pas que tous les événements réels sont attribués, ni que l'historique passé est complet",
  "ne prouve pas que les données sont suffisantes, ni qu'un moteur Copilot peut être activé",
  "sonde annulée (rollback) : la visibilité après validation pour les autres sessions n'est pas mesurée",
  "les numéros de séquence consommés par la sonde laissent des trous d'identifiants, sans signification",
] as const

// ── Destination: where a probe may run ────────────────────────────────────────────────────────────────────────────

export type SentinelDestination =
  | { allowed: true; environment: SentinelEnvironment }
  | {
      allowed: false
      code:
        | "url_absente"
        | "url_illisible"
        | "deploiement_vercel"
        | "production"
        | "staging_non_active"
        | "distante_non_identifiee"
        | "base_locale_non_jetable"
        | "base_protegee"
      reason: string
    }

/** A database name that says it is disposable (`affisell_test`, `sentinel_tmp`, `ci`…). */
const DISPOSABLE_DB = /(^|[_-])(test|tests|ci|sentinel|tmp|scratch)([_-]|$)/i
const PRODUCTION_MARKER = "misty-sea"
const STAGING_MARKER = "shy-wind"

const isLoopbackHost = (h: string) => h === "localhost" || h === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
const sentinelDatabaseName = (u: URL) => decodeURIComponent(u.pathname.replace(/^\//, "").split("/")[0] ?? "")

function hostDb(url: string): { host: string; port: string; db: string } | null {
  try {
    const u = new URL(url)
    if (!/^postgres(ql)?:$/i.test(u.protocol)) return null
    return { host: u.hostname.toLowerCase().replace(/^\[|\]$/g, ""), port: u.port || "5432", db: sentinelDatabaseName(u) }
  } catch {
    return null
  }
}

/**
 * Decides, BEFORE any connection, whether a probe may run against this URL. In this version only a disposable LOCAL
 * database qualifies: a loopback host, a database name that says « test », and nothing that matches a protected URL.
 * Production is refused. Staging is recognised and refused as « prepared, not enabled ». Anything that can not be
 * classified with certainty is refused. Never returns or prints the URL.
 */
export function decideSentinelDestination(args: {
  url: string | undefined | null
  protectedUrls: ReadonlyArray<string | undefined | null>
  env: Record<string, string | undefined>
}): SentinelDestination {
  const refuse = (code: Extract<SentinelDestination, { allowed: false }>["code"], reason: string): SentinelDestination => ({ allowed: false, code, reason })
  const url = args.url?.trim()
  if (!url) return refuse("url_absente", "aucune base de test désignée (DATABASE_URL_TEST) : aucune connexion")
  if (args.env.VERCEL || args.env.VERCEL_ENV) return refuse("deploiement_vercel", "exécution sur un déploiement Vercel : la sonde ne s'exécute jamais dans un déploiement")
  const target = hostDb(url)
  if (!target) return refuse("url_illisible", "adresse de base illisible : aucune connexion")
  if (target.host.includes(PRODUCTION_MARKER)) return refuse("production", "base de PRODUCTION : la sonde ne s'y exécute jamais")
  if (target.host.includes(STAGING_MARKER)) {
    return refuse("staging_non_active", "base de STAGING reconnue : variante préparée (docs/CAPTURE-SENTINEL.md §5) mais non activée — aucune connexion")
  }
  if (!isLoopbackHost(target.host)) return refuse("distante_non_identifiee", "base distante non identifiée : impossible de prouver qu'elle est jetable — aucune connexion")
  if (!DISPOSABLE_DB.test(target.db)) return refuse("base_locale_non_jetable", "base locale dont le nom ne dit pas « test » : peut-être la base de développement — aucune connexion")
  for (const p of args.protectedUrls) {
    const other = p ? hostDb(p) : null
    if (other && other.host === target.host && other.port === target.port && other.db === target.db) {
      return refuse("base_protegee", "la base de test est aussi une base déclarée ailleurs (DATABASE_URL…) : aucune connexion")
    }
  }
  const ci = args.env.CI === "true" && args.env.GITHUB_ACTIONS === "true"
  return { allowed: true, environment: { kind: ci ? "ci" : "local", branch: "local", endpoint: "non_identifie" } }
}

// ── What the probe does, and what each mutation must leave ──────────────────────────────────────────────────────────

export type SentinelStepId = "create" | "list" | "noop" | "unlist" | "delete"
export type ExpectedEvent = { kind: "created" | "listed" | "unlisted" | "deleted"; previousListed: boolean | null; newListed: boolean | null }

export const SENTINEL_STEPS: ReadonlyArray<{ id: SentinelStepId; mutation: string; expect: ExpectedEvent | null }> = [
  { id: "create", mutation: "création de l'annonce de test, non publiée", expect: { kind: "created", previousListed: null, newListed: false } },
  { id: "list", mutation: "publication (isListed false → true)", expect: { kind: "listed", previousListed: false, newListed: true } },
  { id: "noop", mutation: "enregistrement sans changement de présence (isListed reste true, position modifiée)", expect: null },
  { id: "unlist", mutation: "retrait (isListed true → false)", expect: { kind: "unlisted", previousListed: true, newListed: false } },
  { id: "delete", mutation: "suppression de l'annonce de test", expect: { kind: "deleted", previousListed: false, newListed: null } },
]

export type SentinelIds = { runId: string; supplierId: string; affiliateId: string; productId: string; listingId: string; actorId: string }

export function sentinelIds(runId: string): SentinelIds {
  const r = runId.replace(/[^a-z0-9]/gi, "").slice(0, 24).toLowerCase() || "run"
  const p = `${SENTINEL_ID_PREFIX}${r}`
  return { runId: r, supplierId: `${p}-s`, affiliateId: `${p}-a`, productId: `${p}-p`, listingId: `${p}-l`, actorId: `sentinel:${r}` }
}

export type ObservedEvent = {
  kind: string
  previousListed: boolean | null
  newListed: boolean | null
  source: string
  actorId: string | null
  affiliateProductId: string
  affiliateId: string
  productId: string
  /** UTC ISO, as read back. */
  effectiveAt: string
}

export type StepObservation = {
  id: SentinelStepId
  mutation: "ok" | "failed" | "not_run"
  /** Database clock in UTC read right before / after the mutation, ISO. */
  before: string | null
  after: string | null
  /** Events of the test listing that appeared with this mutation (read inside the transaction). */
  events: ObservedEvent[]
}

export type SentinelObservations = {
  takenAt: string
  historyTableExists: boolean | null
  setup: "ok" | "failed" | "not_run"
  steps: StepObservation[]
  /** Inside the transaction, after the delete: is the test listing gone? */
  listingGoneInTransaction: boolean | null
  /** How the transaction ended. */
  ending: "rolled_back" | "interrupted" | "not_started"
  /** Read AFTER the transaction, outside it: what survived (all must be 0). */
  residue: { listings: number; events: number; products: number; users: number; priceRows: number } | null
}

export type SentinelCheck = { id: string; status: SentinelStatus; detail: string }

export type SentinelResult = {
  format: typeof SENTINEL_FORMAT
  version: typeof SENTINEL_VERSION
  takenAt: string
  runId: string | null
  environment: SentinelEnvironment | null
  mode: "rollback"
  timeZone: typeof SENTINEL_PROBE_TIME_ZONE
  overall: SentinelStatus
  checks: SentinelCheck[]
  /** Longest delay between a mutation's start and its recorded event, in ms (inside the transaction). */
  captureDelayMsMax: number | null
  refusal: string | null
  limits: readonly string[]
  executesAutomatically: false
}

const same = (a: ObservedEvent, e: ExpectedEvent) => a.kind === e.kind && a.previousListed === e.previousListed && a.newListed === e.newListed

function overallOf(checks: SentinelCheck[]): SentinelStatus {
  if (checks.every((c) => c.status === "NOT_RUN")) return "NOT_RUN"
  if (checks.some((c) => c.status === "FAIL")) return "FAIL"
  // A step that did not run without any failure explaining it leaves the proof incomplete.
  if (checks.some((c) => c.status === "UNKNOWN" || c.status === "NOT_RUN")) return "UNKNOWN"
  return "PASS"
}

/** A result that says the probe did not run, and why. */
export function sentinelNotRun(takenAt: Date, refusal: string, environment: SentinelEnvironment | null = null): SentinelResult {
  return {
    format: SENTINEL_FORMAT, version: SENTINEL_VERSION, takenAt: takenAt.toISOString(), runId: null, environment, mode: "rollback", timeZone: SENTINEL_PROBE_TIME_ZONE,
    overall: "NOT_RUN", checks: [], captureDelayMsMax: null, refusal, limits: SENTINEL_LIMITS, executesAutomatically: false,
  }
}

/**
 * Judges what the runner observed. Every step is proved by the EVENT read back from the history table — a successful
 * statement or transaction is never taken as proof.
 */
export function evaluateSentinel(o: SentinelObservations, ids: SentinelIds, environment: SentinelEnvironment): SentinelResult {
  const checks: SentinelCheck[] = []
  const add = (id: string, status: SentinelStatus, detail: string) => checks.push({ id, status, detail })
  if (o.historyTableExists === false) return { ...sentinelNotRun(new Date(o.takenAt), "historique_absent : la migration de l'historique de présence n'est pas appliquée sur cette base", environment), runId: ids.runId }
  add("preparation", o.setup === "ok" ? "PASS" : o.setup === "failed" ? "FAIL" : "NOT_RUN", o.setup === "ok" ? "marchand, produit et annonce de test créés dans la transaction" : "préparation de la sonde impossible")

  const all: ObservedEvent[] = []
  let delayMax: number | null = null
  for (const def of SENTINEL_STEPS) {
    const s = o.steps.find((x) => x.id === def.id)
    if (!s || s.mutation === "not_run") {
      add(`mutation:${def.id}`, "NOT_RUN", def.mutation)
      add(`evenement:${def.id}`, "NOT_RUN", "mutation non exécutée")
      continue
    }
    add(`mutation:${def.id}`, s.mutation === "ok" ? "PASS" : "FAIL", s.mutation === "ok" ? `${def.mutation} : exécutée` : `${def.mutation} : refusée par la base (aucun événement attendu, transaction annulée)`)
    if (s.mutation === "failed") {
      add(`evenement:${def.id}`, s.events.length === 0 ? "PASS" : "FAIL", s.events.length === 0 ? "mutation refusée : aucun événement, comme attendu" : "événement enregistré pour une mutation refusée")
      continue
    }
    all.push(...s.events)
    if (!def.expect) {
      add(`evenement:${def.id}`, s.events.length === 0 ? "PASS" : "FAIL", s.events.length === 0 ? "idempotence : aucun événement pour un enregistrement sans changement de présence" : `${s.events.length} événement(s) parasite(s) pour un enregistrement sans changement`)
    } else if (s.events.length === 0) {
      add(`evenement:${def.id}`, "FAIL", `événement absent : « ${def.expect.kind} » attendu, rien d'enregistré`)
    } else if (s.events.length > 1) {
      add(`evenement:${def.id}`, "FAIL", `doublon : ${s.events.length} événements pour une seule mutation`)
    } else {
      const e = s.events[0]!
      const wrong: string[] = []
      if (!same(e, def.expect)) wrong.push(`attendu ${def.expect.kind} ${def.expect.previousListed}→${def.expect.newListed}, enregistré ${e.kind} ${e.previousListed}→${e.newListed}`)
      if (e.affiliateProductId !== ids.listingId || e.affiliateId !== ids.affiliateId || e.productId !== ids.productId) wrong.push("annonce, revendeur ou produit différents de la mutation")
      add(`evenement:${def.id}`, wrong.length === 0 ? "PASS" : "FAIL", wrong.length === 0 ? `« ${e.kind} » ${String(e.previousListed)} → ${String(e.newListed)} enregistré une fois` : `événement incorrect : ${wrong.join(" ; ")}`)
    }
    const t0 = s.before ? Date.parse(s.before) : NaN
    for (const e of s.events) {
      const d = Date.parse(e.effectiveAt) - t0
      if (Number.isFinite(d)) delayMax = Math.max(delayMax ?? 0, d)
    }
  }

  // Provenance and identification: every event of the probe carries the probe's source and actor, and its own ids.
  if (all.length === 0) {
    add("provenance", "NOT_RUN", "aucun événement à examiner")
    add("identification", "NOT_RUN", "aucun événement à examiner")
  } else {
    const badSource = all.filter((e) => e.source !== SENTINEL_SOURCE).length
    const badActor = all.filter((e) => e.actorId !== ids.actorId).length
    add("provenance", badSource + badActor === 0 ? "PASS" : "FAIL", badSource + badActor === 0 ? `source « ${SENTINEL_SOURCE} » et acteur de la sonde sur ${all.length} événement(s)` : `${badSource} source(s) et ${badActor} acteur(s) différents de la déclaration`)
    const foreign = all.filter((e) => !e.affiliateProductId.startsWith(SENTINEL_ID_PREFIX) || !e.affiliateId.startsWith(SENTINEL_ID_PREFIX) || !e.productId.startsWith(SENTINEL_ID_PREFIX)).length
    add("identification", foreign === 0 ? "PASS" : "FAIL", foreign === 0 ? `tous les identifiants commencent par « ${SENTINEL_ID_PREFIX} »` : `${foreign} événement(s) hors de la sonde`)
  }

  // UTC: each event's time must fall between the UTC clock read before and after its mutation — in a session whose
  // time zone is +12:45 or more away from UTC.
  const timed = o.steps.filter((s) => s.mutation === "ok" && s.events.length > 0)
  if (timed.length === 0) add("utc", "NOT_RUN", "aucun événement horodaté")
  else {
    let unreadable = 0
    const off: number[] = []
    for (const s of timed) {
      const a = s.before ? Date.parse(s.before) : NaN
      const b = s.after ? Date.parse(s.after) : NaN
      for (const e of s.events) {
        const t = Date.parse(e.effectiveAt)
        if (![a, b, t].every(Number.isFinite)) unreadable++
        else if (t < a || t > b) off.push(Math.round(((t < a ? t - a : t - b) / 3_600_000) * 10) / 10)
      }
    }
    if (off.length > 0) add("utc", "FAIL", `${off.length} horodatage(s) hors de la fenêtre UTC de la mutation (écart ${off.join(", ")} h) — fuseau de session ${SENTINEL_PROBE_TIME_ZONE}`)
    else if (unreadable > 0) add("utc", "UNKNOWN", `${unreadable} horodatage(s) illisible(s)`)
    else add("utc", "PASS", `horodatages dans la fenêtre UTC de leur mutation, session en ${SENTINEL_PROBE_TIME_ZONE}`)
  }

  // Chain: the events of the probe follow each other (each previous state = the last new state).
  if (all.length < 2) add("chaine", "NOT_RUN", "moins de deux événements")
  else {
    let breaks = 0
    for (let i = 1; i < all.length; i++) if (all[i]!.previousListed !== all[i - 1]!.newListed) breaks++
    add("chaine", breaks === 0 ? "PASS" : "FAIL", breaks === 0 ? "chaque état précédent suit le dernier état enregistré" : `${breaks} rupture(s) de chaîne`)
  }

  const deleteRan = o.steps.find((s) => s.id === "delete")?.mutation === "ok"
  add("etat_final", !deleteRan ? "NOT_RUN" : o.listingGoneInTransaction === true ? "PASS" : o.listingGoneInTransaction === false ? "FAIL" : "UNKNOWN",
    !deleteRan ? "suppression non exécutée" : o.listingGoneInTransaction ? "l'annonce de test n'existe plus après sa suppression" : "état final de l'annonce de test non conforme ou illisible")

  add("annulation", o.ending === "rolled_back" ? "PASS" : o.ending === "interrupted" ? "UNKNOWN" : "NOT_RUN",
    o.ending === "rolled_back" ? "transaction annulée par la sonde (rollback)" : o.ending === "interrupted" ? "transaction interrompue avant son annulation (PostgreSQL l'annule) — voir isolation" : "transaction non démarrée")
  if (!o.residue) add("isolation", "UNKNOWN", "résidu non lisible après la transaction")
  else {
    const left = Object.entries(o.residue).filter(([, n]) => n > 0)
    add("isolation", left.length === 0 ? "PASS" : "FAIL", left.length === 0 ? "après la transaction : aucune annonce, aucun événement, aucun produit, aucun compte, aucun prix de la sonde" : `résidu après la transaction : ${left.map(([k, n]) => `${k}=${n}`).join(", ")}`)
  }

  const checksOut = o.ending === "interrupted"
    ? checks.map((c) => (c.status === "NOT_RUN" && (c.id.startsWith("mutation:") || c.id.startsWith("evenement:")) ? { ...c, status: "UNKNOWN" as const, detail: `${c.detail} — sonde interrompue` } : c))
    : checks
  return {
    format: SENTINEL_FORMAT, version: SENTINEL_VERSION, takenAt: o.takenAt, runId: ids.runId, environment, mode: "rollback", timeZone: SENTINEL_PROBE_TIME_ZONE,
    overall: overallOf(checksOut), checks: checksOut, captureDelayMsMax: delayMax, refusal: null, limits: SENTINEL_LIMITS, executesAutomatically: false,
  }
}

// ── For the collection monitor ─────────────────────────────────────────────────────────────────────────────────────

export type SentinelSnapshotStatus = "confirmee" | "echouee" | "inconcluante" | "expiree" | "non_executee" | "environnement_non_verifie"

export type SnapshotSentinel = {
  status: SentinelSnapshotStatus
  takenAt: string | null
  overall: SentinelStatus | null
  environment: { kind: string; branch: string; endpoint: string } | null
  failed: string[]
  unknown: string[]
  captureDelayMsMax: number | null
  hoursFromSnapshot: number | null
}

const CHECK_ID_RE = /^[a-z_]{1,30}(:[a-z]{1,12})?$/

/**
 * What a probe result says about ONE snapshot. A probe counts only for the SAME identified environment (branch +
 * endpoint) within `SENTINEL_VALIDITY_HOURS` of the snapshot. A local or CI probe never vouches for a staging snapshot.
 */
export function sentinelForSnapshot(result: SentinelResult | null | undefined, snapshot: { takenAt: string; environment: { branch: string; endpoint: string } }): SnapshotSentinel {
  const base: SnapshotSentinel = { status: "non_executee", takenAt: null, overall: null, environment: null, failed: [], unknown: [], captureDelayMsMax: null, hoursFromSnapshot: null }
  if (!result || result.format !== SENTINEL_FORMAT || result.overall === "NOT_RUN") return base
  const env = result.environment
  const hours = (Date.parse(snapshot.takenAt) - Date.parse(result.takenAt)) / 3_600_000
  const out: SnapshotSentinel = {
    ...base,
    takenAt: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(result.takenAt) ? result.takenAt : null,
    overall: result.overall,
    environment: env ? { kind: String(env.kind), branch: String(env.branch), endpoint: /^ep-[a-z0-9-]{3,60}$/.test(env.endpoint) ? env.endpoint : "non_identifie" } : null,
    failed: result.checks.filter((c) => c.status === "FAIL" && CHECK_ID_RE.test(c.id)).map((c) => c.id),
    unknown: result.checks.filter((c) => c.status === "UNKNOWN" && CHECK_ID_RE.test(c.id)).map((c) => c.id),
    captureDelayMsMax: typeof result.captureDelayMsMax === "number" ? result.captureDelayMsMax : null,
    hoursFromSnapshot: Number.isFinite(hours) ? Math.round(hours * 10) / 10 : null,
  }
  const identified = snapshot.environment.endpoint !== "non_identifie" && out.environment?.endpoint !== "non_identifie"
  if (!identified || !out.environment || out.environment.branch !== snapshot.environment.branch || out.environment.endpoint !== snapshot.environment.endpoint) return { ...out, status: "environnement_non_verifie" }
  if (out.hoursFromSnapshot == null || Math.abs(out.hoursFromSnapshot) > SENTINEL_VALIDITY_HOURS) return { ...out, status: "expiree" }
  return { ...out, status: result.overall === "PASS" ? "confirmee" : result.overall === "FAIL" ? "echouee" : "inconcluante" }
}

/** The plain-language reading the brief asks for, from the probe status and the passive report. */
export function captureProofLabel(sentinel: SnapshotSentinel | null | undefined, passiveHealthy: boolean): string {
  switch (sentinel?.status ?? "non_executee") {
    case "confirmee":
      return passiveHealthy ? "collecte fonctionnelle confirmée par sonde" : "sonde réussie, mais le rapport passif signale un problème"
    case "echouee":
      return "sonde échouée : la capture ne produit pas l'événement attendu"
    case "inconcluante":
      return "sonde inconcluante"
    case "expiree":
      return passiveHealthy ? "collecte fonctionnelle mais non testée récemment (sonde expirée)" : "sonde expirée"
    case "environnement_non_verifie":
      return "environnement non vérifié : la sonde ne porte pas sur la base de cet instantané"
    default:
      return passiveHealthy ? "collecte fonctionnelle mais non testée récemment (sonde non exécutée)" : "sonde non exécutée"
  }
}

export { DISPOSABLE_DB as SENTINEL_DISPOSABLE_DB_RE }
