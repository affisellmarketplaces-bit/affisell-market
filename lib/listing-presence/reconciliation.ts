/**
 * Mutation / history reconciliation (founder brief 2026-11-24, portfolio row 48). Pure.
 *
 * The presence history (`ListingPresenceEvent`) is written by a trigger. This module confronts it with WITNESSES of real
 * mutations that are recorded ELSEWHERE, by mechanisms that do not depend on that trigger:
 *
 *  - `creation_prix` — the FIRST base-price row of a listing in `ListingPriceHistory`. It is written by ANOTHER database
 *    trigger (migration 20261117090000) in the SAME transaction as the listing's INSERT, whatever the writer. A created
 *    listing without a `created` event is a missed creation.
 *  - `retrait_journalise` — the AuditLog rows the replacement flow writes in the SAME transaction as its withdrawal
 *    (`affiliate.listing_replaced`, `affiliate.listing_withdrawn`). After them the listing is unlisted; the history must
 *    say so. The expected source is read from LISTING_MUTATION_REGISTRY, never copied.
 *  - `etat_courant` — the listing rows themselves:
 *    - a current `isListed` that contradicts the last event;
 *    - a listing created after the start with no `created` event;
 *    - a listing gone while its history never says « deleted ».
 *
 * Event-side anomalies (duplicates, chain breaks, dates) are NOT recomputed: they come from the integrity checks of
 * `report:presence-readiness` (one definition).
 *
 * Rules (brief):
 * - A witness whose expectation can not be established is NOT VERIFIABLE (with its reason), never « missing ».
 * - Unknown is never 0. Every rate carries its numerator, denominator, period, exclusions and interval.
 * - No witness, or a partial read, says « absence de preuve », never « fiable ».
 */
import { LISTING_MUTATION_REGISTRY } from "./mutation-registry"
import type { IntegrityFacts } from "./integrity"
import type { PresenceKind } from "./periods"

export const RECONCILIATION_VERSION = 1
/** A same-transaction witness and its event are a few milliseconds apart; minutes allow for clock reads, never hours. */
export const WITNESS_TOLERANCE_MS = 15 * 60_000
/**
 * `ListingPriceHistory.effectiveAt` and `AuditLog.createdAt` take CURRENT_TIMESTAMP in the WRITER's session time zone.
 * When the database's default time zone is not UTC, a witness can be off by up to 14 h: its distance to the start of the
 * history and to an event can not be trusted inside that margin.
 */
export const CLOCK_MARGIN_NON_UTC_MS = 14 * 3_600_000
export const RATE_MIN_DENOMINATOR = 20

export type WitnessClass = "creation_prix" | "retrait_journalise" | "etat_courant"
export const WITNESS_CLASSES: readonly WitnessClass[] = ["creation_prix", "retrait_journalise", "etat_courant"]

/** The AuditLog actions written in the same transaction as a withdrawal → the registry entry that declares its source. */
export const AUDIT_WITNESS_SOURCES: Readonly<Record<string, string>> = {
  "affiliate.listing_replaced": "lib/reseller-replacement/replace.server.ts#withdrawReplacedListing#updateMany",
  "affiliate.listing_withdrawn": "lib/reseller-replacement/replace.server.ts#withdrawListing#updateMany",
}

export type RecEvent = { listingId: string; kind: PresenceKind; previousListed: boolean | null; newListed: boolean | null; source: string; effectiveAt: Date }
export type RecListing = { id: string; isListed: boolean; createdAt: Date }
export type CreationWitness = { listingId: string; at: Date }
export type AuditWitness = { listingId: string; action: string; at: Date }

export type ReconciliationInput = {
  now: Date
  /** When the history began (migration applied / last retention purge). null = unknown → nothing verifiable. */
  trackingStart: Date | null
  /** 0 when the database's default time zone is UTC, else CLOCK_MARGIN_NON_UTC_MS. */
  clockMarginMs: number
  /** null = not readable (table absent / unread); `truncated` = read capped → no conclusion. */
  events: { rows: RecEvent[]; truncated: boolean } | null
  listings: { rows: RecListing[]; truncated: boolean } | null
  creations: { rows: CreationWitness[]; truncated: boolean } | null
  audits: { rows: AuditWitness[]; truncated: boolean } | null
  /** Event-side anomalies, from the integrity checks (not recomputed here). */
  integrity: IntegrityFacts | null
}

export type WitnessOutcome =
  | "rapprochee" // the expected event exists
  | "coherente_sans_evenement" // nothing had to change (already unlisted): consistent, proves nothing about the trigger
  | "manquante" // a mutation is proved and the history does not show it — confirmed anomaly
  | "provenance_discordante" // the event exists with a source the registry does not declare for that path
  | "non_attribuee" // the event exists with source « unattributed »
export type UnverifiableReason =
  | "avant_le_debut" // the witness predates (or is within the clock margin of) the history start
  | "etat_anterieur_inconnu" // the state before the mutation is not known from the history
  | "horloge_incertaine" // a matching event exists only outside the tolerance (possible time-zone shift)
  | "source_illisible" // the witness's own table is absent or unread

export type ClassResult = {
  witnessClass: WitnessClass
  available: boolean
  truncated: boolean
  witnesses: number
  outcomes: Record<WitnessOutcome, number>
  notVerifiable: Record<UnverifiableReason, number>
  /** Witnesses whose expectation could be established (denominator of every rate below). */
  verifiable: number
  /** Share recorded consistently = (verifiable − manquante) / verifiable, with a 95 % Wilson interval. null = no denominator. */
  rate: { numerator: number; denominator: number; value: number; low: number; high: number; enough: boolean } | null
}

export type DayLine = { day: string; verifiable: number; missing: number }

export type ReconciliationVerdict =
  | "indisponible"
  | "lecture_tronquee"
  | "anomalies_confirmees"
  | "attribution_a_verifier"
  | "aucune_anomalie_sur_le_perimetre_verifie"
  | "rien_de_verifiable"

export type ReconciliationReport = {
  version: typeof RECONCILIATION_VERSION
  generatedAt: string
  verdict: ReconciliationVerdict
  period: { from: string | null; to: string; clockMarginHours: number }
  classes: ClassResult[]
  /** Confirmed anomalies by kind (state witnesses split for reading). */
  confirmed: { creationsSansEvenement: number; retraitsSansEvenement: number; etatContreditHistorique: number; creeesSansCreated: number; suppressionsSansEvenement: number }
  /** Recorded mutations by attribution: known (registry source), unattributed, discordant. */
  attribution: { sourceAttendue: number; nonAttribuee: number; discordante: number }
  /** From the integrity checks — not recomputed. null = not read. */
  eventSide: { duplicates: number; chainBreaks: number; createdNotFirst: number; afterDeleted: number; futureEvents: number; beforeTrackingStart: number | null; orderInversions: number } | null
  /** Dated witnesses per UTC day (creation and logged withdrawal). */
  timeline: DayLine[]
  degradation: { kind: "rupture_datee" | "pertes_isolees" | "aucune" | "indeterminee"; firstMissingDay: string | null; lastCleanDay: string | null; quarantineDays: string[] }
  statements: string[]
  limits: readonly string[]
}

export const RECONCILIATION_LIMITS = [
  "seules les mutations qui laissent un témoin indépendant sont rapprochées : création (prix d'origine) et retrait journalisé ; les autres publications et retraits ne sont contrôlés que par l'état courant de l'annonce",
  "l'état courant ne voit que la DERNIÈRE mutation : un aller-retour (retirée puis remise) non enregistré entre deux lectures est invisible",
  "une annonce supprimée avant toute lecture et sans prix d'origine ne laisse aucun témoin",
  "les horodatages des témoins dépendent du fuseau de la session qui les écrit : hors UTC, une marge de 14 h est appliquée",
  "« aucune anomalie » ne vaut que sur le périmètre vérifié et sa période : ce n'est pas une preuve de fiabilité générale",
] as const

const day = (d: Date) => d.toISOString().slice(0, 10)

function wilson(k: number, n: number) {
  const z = 1.959964
  const p = k / n
  const den = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / den
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) }
}

function emptyClass(c: WitnessClass, available: boolean, truncated: boolean): ClassResult {
  return {
    witnessClass: c, available, truncated, witnesses: 0, verifiable: 0, rate: null,
    outcomes: { rapprochee: 0, coherente_sans_evenement: 0, manquante: 0, provenance_discordante: 0, non_attribuee: 0 },
    notVerifiable: { avant_le_debut: 0, etat_anterieur_inconnu: 0, horloge_incertaine: 0, source_illisible: 0 },
  }
}

function finishClass(r: ClassResult): ClassResult {
  const o = r.outcomes
  r.verifiable = o.rapprochee + o.coherente_sans_evenement + o.manquante + o.provenance_discordante + o.non_attribuee
  if (r.verifiable > 0 && !r.truncated) {
    const k = r.verifiable - o.manquante
    r.rate = { numerator: k, denominator: r.verifiable, value: k / r.verifiable, ...wilson(k, r.verifiable), enough: r.verifiable >= RATE_MIN_DENOMINATOR }
  }
  return r
}

/** Sources the registry declares for every path that can make this kind of change. */
export function registrySourcesFor(change: "create" | "unlist"): Set<string> {
  return new Set(LISTING_MUTATION_REGISTRY.filter((e) => e.changes.includes(change)).flatMap((e) => e.sources))
}
export function registrySourcesOfKey(key: string): Set<string> {
  return new Set(LISTING_MUTATION_REGISTRY.find((e) => e.key === key)?.sources ?? [])
}

function attributeOutcome(source: string, expected: Set<string>): WitnessOutcome {
  if (source === "unattributed") return "non_attribuee"
  return expected.has(source) ? "rapprochee" : "provenance_discordante"
}

export function reconcileMutations(input: ReconciliationInput): ReconciliationReport {
  const start = input.trackingStart
  const margin = Math.max(0, input.clockMarginMs)
  const verifiableAfter = start ? start.getTime() + margin : Number.POSITIVE_INFINITY
  const eventsOk = input.events !== null && !input.events.truncated
  const byListing = new Map<string, RecEvent[]>()
  for (const e of input.events?.rows ?? []) {
    const list = byListing.get(e.listingId) ?? []
    list.push(e)
    byListing.set(e.listingId, list)
  }
  for (const list of byListing.values()) list.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime())
  const timeline = new Map<string, DayLine>()
  const mark = (at: Date, missing: boolean) => {
    const k = day(at)
    const line = timeline.get(k) ?? { day: k, verifiable: 0, missing: 0 }
    line.verifiable++
    if (missing) line.missing++
    timeline.set(k, line)
  }
  const confirmed = { creationsSansEvenement: 0, retraitsSansEvenement: 0, etatContreditHistorique: 0, creeesSansCreated: 0, suppressionsSansEvenement: 0 }

  // ── creation_prix ────────────────────────────────────────────────────────────────────────────────────────────────
  const creation = emptyClass("creation_prix", input.creations !== null, Boolean(input.creations?.truncated) || !eventsOk)
  const createSources = registrySourcesFor("create")
  for (const w of input.creations?.rows ?? []) {
    creation.witnesses++
    if (!eventsOk) continue
    const created = byListing.get(w.listingId)?.find((e) => e.kind === "created")
    if (created) {
      const o = attributeOutcome(created.source, createSources)
      creation.outcomes[o]++
      if (w.at.getTime() >= verifiableAfter) mark(w.at, false)
    } else if (w.at.getTime() >= verifiableAfter) {
      creation.outcomes.manquante++
      confirmed.creationsSansEvenement++
      mark(w.at, true)
    } else creation.notVerifiable.avant_le_debut++
  }
  if (input.creations === null) creation.notVerifiable.source_illisible++

  // ── retrait_journalise ───────────────────────────────────────────────────────────────────────────────────────────
  const withdrawal = emptyClass("retrait_journalise", input.audits !== null, Boolean(input.audits?.truncated) || !eventsOk)
  for (const w of input.audits?.rows ?? []) {
    const key = AUDIT_WITNESS_SOURCES[w.action]
    if (!key) continue
    withdrawal.witnesses++
    if (!eventsOk) continue
    if (w.at.getTime() < verifiableAfter) {
      withdrawal.notVerifiable.avant_le_debut++
      continue
    }
    const evs = byListing.get(w.listingId) ?? []
    const near = evs.find((e) => e.kind === "unlisted" && Math.abs(e.effectiveAt.getTime() - w.at.getTime()) <= WITNESS_TOLERANCE_MS)
    if (near) {
      withdrawal.outcomes[attributeOutcome(near.source, registrySourcesOfKey(key))]++
      mark(w.at, false)
      continue
    }
    // The state before the withdrawal: events of EARLIER transactions (the witness carries its transaction's start time,
    // its own event can only be later — and it was not found above).
    const before = evs.filter((e) => e.effectiveAt.getTime() <= w.at.getTime()).at(-1)
    if (before && before.newListed === false) {
      // Already unlisted before the withdrawal: the update changed nothing, no event was due.
      withdrawal.outcomes.coherente_sans_evenement++
      mark(w.at, false)
      continue
    }
    const far = evs.find((e) => e.kind === "unlisted" && Math.abs(e.effectiveAt.getTime() - w.at.getTime()) <= CLOCK_MARGIN_NON_UTC_MS)
    if (far) {
      withdrawal.notVerifiable.horloge_incertaine++
      continue
    }
    if (before && before.newListed === true) {
      // Listed according to the history, a withdrawal committed, and no « unlisted » event: missed.
      withdrawal.outcomes.manquante++
      confirmed.retraitsSansEvenement++
      mark(w.at, true)
      continue
    }
    withdrawal.notVerifiable.etat_anterieur_inconnu++
  }
  if (input.audits === null) withdrawal.notVerifiable.source_illisible++

  // ── etat_courant ─────────────────────────────────────────────────────────────────────────────────────────────────
  const state = emptyClass("etat_courant", input.listings !== null, Boolean(input.listings?.truncated) || !eventsOk)
  const present = new Set<string>()
  for (const l of input.listings?.rows ?? []) {
    present.add(l.id)
    state.witnesses++
    if (!eventsOk) continue
    const evs = byListing.get(l.id)
    if (!evs || evs.length === 0) {
      if (l.createdAt.getTime() >= verifiableAfter) {
        state.outcomes.manquante++
        confirmed.creeesSansCreated++
      } else state.notVerifiable.etat_anterieur_inconnu++ // older than the history and never changed since: nothing to compare
      continue
    }
    const last = evs[evs.length - 1]!
    if (last.kind === "deleted") {
      // The row exists while its history says deleted: the event side already counts it (deletedButPresent).
      state.outcomes.manquante++
      confirmed.etatContreditHistorique++
      continue
    }
    if (last.newListed !== l.isListed) {
      state.outcomes.manquante++
      confirmed.etatContreditHistorique++
    } else state.outcomes[last.source === "unattributed" ? "non_attribuee" : "rapprochee"]++
  }
  if (input.listings && !input.listings.truncated && eventsOk) {
    for (const [id, evs] of byListing) {
      if (present.has(id)) continue
      const last = evs[evs.length - 1]!
      if (last.kind !== "deleted") {
        state.witnesses++
        state.outcomes.manquante++
        confirmed.suppressionsSansEvenement++
      }
    }
  }
  if (input.listings === null) state.notVerifiable.source_illisible++

  const classes = [creation, withdrawal, state].map(finishClass)

  // ── attribution of what WAS recorded ─────────────────────────────────────────────────────────────────────────────
  const attribution = { sourceAttendue: 0, nonAttribuee: 0, discordante: 0 }
  for (const c of classes) {
    attribution.sourceAttendue += c.outcomes.rapprochee
    attribution.nonAttribuee += c.outcomes.non_attribuee
    attribution.discordante += c.outcomes.provenance_discordante
  }

  // ── timeline / degradation ───────────────────────────────────────────────────────────────────────────────────────
  const lines = [...timeline.values()].sort((a, b) => a.day.localeCompare(b.day))
  const missingDays = lines.filter((l) => l.missing > 0).map((l) => l.day)
  const cleanDays = lines.filter((l) => l.missing === 0).map((l) => l.day)
  let degradation: ReconciliationReport["degradation"]["kind"] = "indeterminee"
  if (lines.length > 0) {
    if (missingDays.length === 0) degradation = "aucune"
    else {
      const first = lines.findIndex((l) => l.missing > 0)
      // Every dated witness from the first loss onwards is lost → the capture stopped that day.
      const tail = lines.slice(first)
      degradation = tail.every((l) => l.missing === l.verifiable) && first > 0 ? "rupture_datee" : "pertes_isolees"
    }
  }

  const ev = input.integrity
  const eventSide = ev
    ? { duplicates: ev.duplicates, chainBreaks: ev.chainBreaks, createdNotFirst: ev.createdNotFirst, afterDeleted: ev.afterDeleted, futureEvents: ev.futureEvents, beforeTrackingStart: ev.beforeTrackingStart, orderInversions: ev.orderInversions }
    : null

  const missing = classes.reduce((s, c) => s + c.outcomes.manquante, 0)
  const verifiable = classes.reduce((s, c) => s + c.verifiable, 0)
  const truncated = classes.some((c) => c.truncated) || Boolean(input.events?.truncated)
  let verdict: ReconciliationVerdict
  if (!start || input.events === null) verdict = "indisponible"
  else if (missing > 0) verdict = "anomalies_confirmees" // a proved loss stands even on a partial read
  else if (truncated) verdict = "lecture_tronquee"
  else if (verifiable === 0) verdict = "rien_de_verifiable"
  else if (attribution.discordante + attribution.nonAttribuee > 0) verdict = "attribution_a_verifier"
  else verdict = "aucune_anomalie_sur_le_perimetre_verifie"

  const statements: string[] = []
  if (verdict === "indisponible") statements.push("rapprochement impossible : historique absent ou début de collecte inconnu — rien n'est conclu")
  if (verdict === "lecture_tronquee") statements.push("lecture plafonnée : aucun taux n'est donné, aucune absence d'anomalie n'est affirmée")
  if (verdict === "rien_de_verifiable") statements.push("aucun témoin vérifiable sur la période : absence de preuve, pas preuve d'absence")
  if (margin > 0) statements.push(`fuseau par défaut de la base différent d'UTC : marge de ${Math.round(margin / 3_600_000)} h appliquée après le début de la collecte`)
  for (const c of classes) {
    if (c.rate && !c.rate.enough) statements.push(`${c.witnessClass} : ${c.rate.denominator} témoin(s) vérifiable(s) seulement (< ${RATE_MIN_DENOMINATOR}) — taux indicatif`)
  }
  if (verdict === "aucune_anomalie_sur_le_perimetre_verifie") statements.push("aucune anomalie sur le périmètre vérifié : vaut pour ces témoins et cette période seulement")

  return {
    version: RECONCILIATION_VERSION,
    generatedAt: input.now.toISOString(),
    verdict,
    period: { from: start ? start.toISOString() : null, to: input.now.toISOString(), clockMarginHours: Math.round(margin / 3_600_000) },
    classes,
    confirmed,
    attribution,
    eventSide,
    timeline: lines,
    degradation: { kind: degradation, firstMissingDay: missingDays[0] ?? null, lastCleanDay: cleanDays.at(-1) ?? null, quarantineDays: missingDays },
    statements,
    limits: RECONCILIATION_LIMITS,
  }
}

/** Counts only, for the readiness facts / snapshots (no identifier, no free text). */
export type ReconciliationFacts = {
  verdict: ReconciliationVerdict
  periodFrom: string | null
  clockMarginHours: number
  classes: Array<{ witnessClass: WitnessClass; available: boolean; truncated: boolean; witnesses: number; verifiable: number; missing: number; discordant: number; unattributed: number; notVerifiable: number; rate: number | null; rateLow: number | null; enough: boolean }>
  confirmedMissing: number
  degradation: ReconciliationReport["degradation"]["kind"]
  firstMissingDay: string | null
  quarantineDays: number
}

export function reconciliationFacts(r: ReconciliationReport): ReconciliationFacts {
  return {
    verdict: r.verdict,
    periodFrom: r.period.from,
    clockMarginHours: r.period.clockMarginHours,
    classes: r.classes.map((c) => ({
      witnessClass: c.witnessClass, available: c.available, truncated: c.truncated, witnesses: c.witnesses, verifiable: c.verifiable,
      missing: c.outcomes.manquante, discordant: c.outcomes.provenance_discordante, unattributed: c.outcomes.non_attribuee,
      notVerifiable: Object.values(c.notVerifiable).reduce((s, n) => s + n, 0),
      rate: c.rate ? Math.round(c.rate.value * 10_000) / 10_000 : null, rateLow: c.rate ? Math.round(c.rate.low * 10_000) / 10_000 : null, enough: c.rate?.enough ?? false,
    })),
    confirmedMissing: r.classes.reduce((s, c) => s + c.outcomes.manquante, 0),
    degradation: r.degradation.kind,
    firstMissingDay: r.degradation.firstMissingDay,
    quarantineDays: r.degradation.quarantineDays.length,
  }
}

