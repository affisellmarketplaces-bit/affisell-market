/**
 * Listing presence — rebuilding the life of a product in a reseller's shop from the events the database records
 * (migration 20261124090000_listing_presence_history). PURE, client-safe, no import.
 *
 * Three kinds of time are never mixed:
 *  - EXACT: a boundary that is an event the database wrote (`effectiveAt`);
 *  - UNKNOWN START: a listing already in the shop when history began (no event before it). Its start is NOT invented:
 *    `start` is null, `startLowerBound` = the row's `createdAt` (it can not have been listed before it existed) and
 *    durations are counted only from `observedFrom` (= when history began), flagged `startKnown: false`;
 *  - ONGOING: a period with no end yet (`end` null). It is never treated as finished: its duration is « so far ».
 *
 * Several periods of one listing stay distinct: listed 3 Jan → withdrawn 18 Jan → listed again 2 Feb → withdrawn
 * 20 Feb gives TWO periods and one gap of 15 days, never one stretched period.
 *
 * When an event's `previousListed` disagrees with the state rebuilt so far (an event missing — history not recorded at
 * that time, the trigger dropped by hand…), the listing is flagged `consistent: false` and the period boundaries around
 * the gap are reported as unknown rather than guessed.
 */

export type PresenceKind = "created" | "listed" | "unlisted" | "deleted"

export type PresenceEvent = {
  kind: PresenceKind
  previousListed: boolean | null
  newListed: boolean | null
  effectiveAt: Date
  source?: string
}

export type ListingSnapshot = {
  /** The row as it is now; null when the listing was deleted. */
  current: { isListed: boolean; createdAt: Date } | null
  /** Events of THIS listing in write order (id ascending). */
  events: readonly PresenceEvent[]
  /** When presence history began (the migration's finished_at); null = history not available at all. */
  trackingStartedAt: Date | null
}

export type PresencePeriod = {
  /** null = started before history began (unknown). */
  start: Date | null
  startKnown: boolean
  /** Earliest the period can have started (the listing's creation), when the start is unknown. */
  startLowerBound: Date | null
  /** null = still listed (ongoing). */
  end: Date | null
  ongoing: boolean
  /** A boundary is uncertain because events are missing around it. */
  uncertain: boolean
  /** Who opened / closed it, as the database recorded it (null = unknown or not recorded). */
  startSource?: string | null
  endSource?: string | null
  /** Closed by a deletion of the listing (not a mere withdrawal). */
  endedByDeletion?: boolean
}

export type PresenceHistory = {
  status: "historique_exact" | "debut_inconnu" | "incoherent" | "indisponible"
  periods: PresencePeriod[]
  /** Moment from which durations are measured (history start, or the listing's creation if later). */
  observedFrom: Date | null
  withdrawals: number
  /** Listings again after a period on sale (a first listing after a creation « not listed » is not a relisting). */
  relistings: number
  /** Days between each withdrawal and the next relisting (exact boundaries only). */
  gapsDays: number[]
  deleted: boolean
  consistent: boolean
}

const DAY = 86_400_000

/** Rebuilds the periods of one listing. Never invents a date. */
export function rebuildPresence(s: ListingSnapshot): PresenceHistory {
  const empty: PresenceHistory = { status: "indisponible", periods: [], observedFrom: null, withdrawals: 0, relistings: 0, gapsDays: [], deleted: false, consistent: true }
  if (!s.trackingStartedAt) return empty
  const events = s.events
  const createdAt = s.current?.createdAt ?? null
  const first = events[0]
  const createdTracked = first?.kind === "created"
  // State before the first event: known from the event itself (previousListed), else from the row today.
  let listed: boolean | null = createdTracked ? null : first ? first.previousListed : (s.current?.isListed ?? null)
  const observedFrom = createdTracked ? first!.effectiveAt : createdAt && createdAt > s.trackingStartedAt ? createdAt : s.trackingStartedAt

  const periods: PresencePeriod[] = []
  let open: PresencePeriod | null = null
  if (listed === true) {
    open = { start: null, startKnown: false, startLowerBound: createdAt, end: null, ongoing: true, uncertain: false }
  }
  let consistent = true
  let withdrawals = 0
  let relistings = 0
  let deleted = false
  // Mutable state shared with the helpers (an object, so the closures' writes are visible to the loop).
  const st = { lastEndAt: null as Date | null, lastEndExact: false, hadPeriod: listed === true }
  const gapsDays: number[] = []

  const close = (at: Date | null, uncertain: boolean, source: string | null = null, deletion = false) => {
    if (!open) return
    open.end = at
    open.endSource = source
    open.endedByDeletion = deletion
    open.ongoing = false
    open.uncertain = open.uncertain || uncertain
    periods.push(open)
    st.lastEndAt = at
    st.lastEndExact = at != null && !uncertain
    st.hadPeriod = true
    open = null
  }
  const openAt = (at: Date | null, uncertain: boolean, source: string | null = null) => {
    open = { start: at, startKnown: at != null && !uncertain, startLowerBound: at ? null : createdAt, end: null, ongoing: true, uncertain, startSource: source, endSource: null }
    st.lastEndAt = null
  }

  for (const e of events) {
    if (e.kind !== "created" && listed !== null && e.previousListed !== listed) {
      // An event is missing: the state changed without being recorded. Do not guess when.
      consistent = false
      if (listed && open) close(null, true)
      else if (!listed && e.previousListed) openAt(null, true)
      listed = e.previousListed
    }
    if (e.kind === "created") {
      if (e.newListed) openAt(e.effectiveAt, false, e.source ?? null)
      listed = Boolean(e.newListed)
    } else if (e.kind === "listed") {
      if (st.hadPeriod) relistings++ // a « remise en vente »: the product had been on sale before
      if (st.lastEndAt && st.lastEndExact) gapsDays.push((e.effectiveAt.getTime() - st.lastEndAt.getTime()) / DAY)
      openAt(e.effectiveAt, false, e.source ?? null)
      listed = true
    } else if (e.kind === "unlisted") {
      withdrawals++
      close(e.effectiveAt, false, e.source ?? null)
      listed = false
    } else if (e.kind === "deleted") {
      if (listed) {
        withdrawals++
        close(e.effectiveAt, false, e.source ?? null, true)
      }
      deleted = true
      listed = null
    }
  }
  // The row today must agree with the last event; otherwise something was not recorded.
  if (!deleted && s.current && listed !== null && listed !== s.current.isListed) {
    consistent = false
    if (listed && open) close(null, true)
    else if (!listed) openAt(null, true)
    listed = s.current.isListed
  }
  if (open) periods.push(open)
  const unknownStart = periods.some((p) => !p.startKnown)
  return {
    status: !consistent ? "incoherent" : unknownStart ? "debut_inconnu" : "historique_exact",
    periods,
    observedFrom,
    withdrawals,
    relistings,
    gapsDays: gapsDays.map((d) => Math.round(d * 100) / 100),
    deleted,
    consistent,
  }
}

export type PresenceDurations = {
  /** Listed days inside [from, to), counted only where presence is known. */
  listedDays: number
  /** Days of the window during which presence is unknown (before history began, or around a missing event). */
  unknownDays: number
  /** Number of distinct periods touching the window. */
  periods: number
  /** True when every day of the window has a known state. */
  exact: boolean
}

/**
 * Listed days of one listing inside a window — what « performance per listing-day » needs. A period of unknown start
 * counts only from `observedFrom`; days before history began, and days around a missing event, are `unknownDays`,
 * never assumed listed or unlisted.
 */
export function listedDaysInWindow(h: PresenceHistory, from: Date, to: Date): PresenceDurations {
  const f = from.getTime()
  const t = to.getTime()
  if (h.status === "indisponible" || !h.observedFrom || t <= f) return { listedDays: 0, unknownDays: Math.max(0, (t - f) / DAY), periods: 0, exact: false }
  const obs = h.observedFrom.getTime()
  let listed = 0
  let unknown = Math.max(0, Math.min(t, obs) - f)
  let count = 0
  for (const p of h.periods) {
    const ps = p.start ? p.start.getTime() : obs
    const pe = p.end ? p.end.getTime() : t
    const lo = Math.max(f, ps, obs)
    const hi = Math.min(t, pe)
    if (p.uncertain) {
      // An uncertain period is not counted as listed: its unknown edge is unknown time.
      if (hi > lo) unknown += hi - lo
      if (hi > lo) count++
      continue
    }
    if (hi > lo) {
      listed += hi - lo
      count++
    }
  }
  return { listedDays: round2(listed / DAY), unknownDays: round2(unknown / DAY), periods: count, exact: unknown === 0 }
}

/** Totals over a listing's whole known life (until `now`). */
export function presenceSummary(h: PresenceHistory, now: Date): {
  status: PresenceHistory["status"]
  periods: number
  activePeriods: number
  finishedPeriods: number
  withdrawals: number
  relistings: number
  cumulativeListedDays: number
  cumulativeExact: boolean
  medianGapDays: number | null
  observedFrom: Date | null
} {
  const d = h.observedFrom ? listedDaysInWindow(h, h.observedFrom, now) : null
  const gaps = [...h.gapsDays].sort((a, b) => a - b)
  const median = gaps.length === 0 ? null : gaps.length % 2 ? gaps[(gaps.length - 1) / 2]! : round2((gaps[gaps.length / 2 - 1]! + gaps[gaps.length / 2]!) / 2)
  return {
    status: h.status,
    periods: h.periods.length,
    activePeriods: h.periods.filter((p) => p.ongoing).length,
    finishedPeriods: h.periods.filter((p) => !p.ongoing).length,
    withdrawals: h.withdrawals,
    relistings: h.relistings,
    cumulativeListedDays: d?.listedDays ?? 0,
    cumulativeExact: h.status === "historique_exact",
    medianGapDays: median,
    observedFrom: h.observedFrom,
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100
