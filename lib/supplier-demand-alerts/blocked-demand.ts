/**
 * Demand blocked by an unavailable product — tell the SUPPLIER, once, with the fix (founder brief 2026-11-19
 * « Transformer la demande bloquée en opportunité fournisseur »). Pure, client-safe.
 *
 * Five kinds of facts, NEVER mixed and never presented as one another:
 *  - observed orders      paid orders of the product (`Order.paidAt`) — a fact;
 *  - reseller demand      live reseller listings (`AffiliateProduct.isListed`) — registered distribution, a fact,
 *                         NOT a sale;
 *  - unavailability       the product can not be bought today (one shared rule: `listingProblem` + Affisell holds +
 *                         the unconfirmed-quantity marker) — a fact; its start = the FIRST TIME this monitor saw it
 *                         (« constatée depuis le … au plus tard »), never invented;
 *  - demand that failed   paid checkout lines that could not become an order because the product was not available
 *                         (`payment.unallocated_line`, reasons `insufficient_stock` / `listing_inactive`) — a fact;
 *  - estimate             what the previous 30-day pace would have produced over the unavailable days — labelled an
 *                         ESTIMATE, only with enough orders, never « commandes perdues ».
 * A visit, a page view or an interest is never counted (Affisell records none here, and none would be a lost order).
 *
 * Who is told: only the supplier who owns the product, only for a cause IT can fix (stock, unconfirmed quantity,
 * its own pause / unpublished sheet, missing commission). A product held by Affisell (recall, suspension) or awaiting
 * Affisell's review is never an alert to the supplier: it has nothing to do. The supplier never sees a reseller's
 * identity or figures: counts of its OWN product only.
 *
 * Rollout `SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE` = `off` | `observe` (DEFAULT: measures what would be sent, sends
 * nothing) | `enforce` (one bell per supplier and per day) — read per run. Enforce = founder decision.
 */

export const SUPPLIER_BLOCKED_DEMAND_NOTIF = "SUPPLIER_BLOCKED_DEMAND"
export const SUPPLIER_BLOCKED_DEMAND_PATH = "/dashboard/supplier/catalog-health#blocked-demand"

export type SupplierBlockedDemandMode = "off" | "observe" | "enforce"

export function readSupplierBlockedDemandMode(
  raw: string | undefined | null = process.env.SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE
): SupplierBlockedDemandMode {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "off" || v === "0" || v === "false") return "off"
  if (v === "enforce") return "enforce"
  return "observe"
}

/** Causes the supplier can fix itself, by the normal catalogue path. */
export const SUPPLIER_FIXABLE_CAUSES = ["out_of_stock", "stock_unconfirmed", "paused_by_supplier", "no_commission"] as const
export type SupplierFixableCause = (typeof SUPPLIER_FIXABLE_CAUSES)[number]
/** Every state a listed product can be in; `null` = sellable. */
export type UnavailabilityCause = SupplierFixableCause | "held_by_affisell" | "awaiting_review" | "hold_unverifiable"

export function isSupplierFixable(cause: UnavailabilityCause | null): cause is SupplierFixableCause {
  return cause !== null && (SUPPLIER_FIXABLE_CAUSES as ReadonlyArray<string>).includes(cause)
}

/** What restores availability — always through the normal catalogue path, never done automatically. */
export const FIX_FOR_CAUSE: Record<SupplierFixableCause, "update_stock" | "confirm_stock" | "reactivate" | "set_commission"> = {
  out_of_stock: "update_stock",
  stock_unconfirmed: "confirm_stock",
  paused_by_supplier: "reactivate",
  no_commission: "set_commission",
}

/**
 * Cause of unavailability, most decisive first. `holds` null = unreadable → `hold_unverifiable` (never read as « no
 * hold »: telling a supplier to reactivate a recalled product would be wrong).
 */
export function unavailabilityCause(f: {
  holds: ReadonlyArray<string> | null
  awaitingReview: boolean
  stockUnconfirmed: boolean
  active: boolean
  isDraft: boolean
  hasExplicitCommission: boolean
  availableUnits: number | null
}): UnavailabilityCause | null {
  if (f.holds === null) return f.active && !f.isDraft ? sellableOr(f) : "hold_unverifiable"
  if (f.holds.length > 0) return "held_by_affisell"
  if (f.awaitingReview) return "awaiting_review"
  return sellableOr(f)
}

function sellableOr(f: {
  stockUnconfirmed: boolean
  active: boolean
  isDraft: boolean
  hasExplicitCommission: boolean
  availableUnits: number | null
}): UnavailabilityCause | null {
  if (f.stockUnconfirmed && (f.availableUnits ?? 0) === 0) return "stock_unconfirmed"
  if (!f.active || f.isDraft) return "paused_by_supplier"
  if (!f.hasExplicitCommission) return "no_commission"
  if (f.availableUnits === 0) return "out_of_stock"
  return null
}

// ---------------------------------------------------------------------------------------------------------------
// Episodes: when did the unavailability start, and is it over?
// ---------------------------------------------------------------------------------------------------------------

export const EPISODE_STATE_ACTION = "supplier.blocked_demand_episode"

export function episodeStateId(productId: string): string {
  return `supplier-blocked-demand:${productId}`
}

export type EpisodeState = {
  open: boolean
  cause: UnavailabilityCause
  /** First time the monitor saw the product unavailable (ISO). */
  since: string
  resolvedAt: string | null
}

export function parseEpisodeState(raw: unknown): EpisodeState | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.open !== "boolean" || typeof r.since !== "string" || typeof r.cause !== "string") return null
  if (Number.isNaN(Date.parse(r.since))) return null
  return {
    open: r.open,
    cause: r.cause as UnavailabilityCause,
    since: r.since,
    resolvedAt: typeof r.resolvedAt === "string" ? r.resolvedAt : null,
  }
}

/**
 * Next state of a product's episode. Unavailable: keep the running episode (its `since` never moves, the cause is
 * refreshed), or open a new one now. Sellable: close the running one. `changed` = something to write.
 */
export function nextEpisode(
  prev: EpisodeState | null,
  cause: UnavailabilityCause | null,
  now: Date
): { state: EpisodeState | null; changed: boolean; opened: boolean; resolved: boolean } {
  if (cause === null) {
    if (prev?.open) return { state: { ...prev, open: false, resolvedAt: now.toISOString() }, changed: true, opened: false, resolved: true }
    return { state: prev, changed: false, opened: false, resolved: false }
  }
  if (prev?.open) {
    if (prev.cause === cause) return { state: prev, changed: false, opened: false, resolved: false }
    return { state: { ...prev, cause }, changed: true, opened: false, resolved: false }
  }
  return { state: { open: true, cause, since: now.toISOString(), resolvedAt: null }, changed: true, opened: true, resolved: false }
}

/** One alert per product and episode: a resolved problem that comes back is a NEW episode (new start date). */
export function episodeKey(since: string): string {
  return since.slice(0, 10)
}

export function blockedDemandAlertId(productId: string, since: string): string {
  return `supplier-blocked-demand-alert:${productId}:${episodeKey(since)}`
}

export function blockedDemandObservedId(productId: string, since: string): string {
  return `supplier-blocked-demand-observed:${productId}:${episodeKey(since)}`
}

export function supplierDigestId(supplierId: string, now: Date): string {
  return `supplier-blocked-demand-digest:${supplierId}:${now.toISOString().slice(0, 10)}`
}

// ---------------------------------------------------------------------------------------------------------------
// Qualification: is there REAL demand behind the unavailability?
// ---------------------------------------------------------------------------------------------------------------

/** ≥ 2 paid orders in the 30 days before the unavailability, or ≥ 1 paid line that failed because of it. */
export const MIN_ORDERS_BEFORE = 2
export const MIN_FAILED_LINES = 1
/** An estimate needs a pace that is not one order: ≥ 5 orders in the reference 30 days. */
export const MIN_ORDERS_FOR_ESTIMATE = 5
export const REFERENCE_DAYS = 30

export type BlockedDemandFacts = {
  productId: string
  productName: string
  supplierId: string
  cause: UnavailabilityCause | null
  /** Live reseller listings — shops showing the product. */
  liveListings: number
  /** Paid orders in the 30 days before the episode start. */
  ordersBefore: number
  /** Paid orders since the episode start (some may have gone through before stock reached 0). */
  ordersSince: number
  lastPaidAt: Date | null
  /** Paid lines that could not become an order because the product was not available, since the episode start. */
  failedPaidLines: number
  /** Episode start (first observation); null = not observed yet by the monitor. */
  since: Date | null
}

export type BlockedDemandAlert = {
  productId: string
  productName: string
  supplierId: string
  cause: SupplierFixableCause
  fix: (typeof FIX_FOR_CAUSE)[SupplierFixableCause]
  why: "orders_before" | "failed_lines" | "both"
  observed: { ordersBefore: number; ordersSince: number; failedPaidLines: number; liveListings: number; lastPaidAt: string | null }
  since: string | null
  daysUnavailable: number | null
  /** ESTIMATE, labelled: orders the previous pace would have produced over the unavailable days (range ≈ 95 %). */
  estimate: { orders: number; low: number; high: number } | null
}

export function qualifyBlockedDemand(f: BlockedDemandFacts, now: Date): BlockedDemandAlert | null {
  if (!isSupplierFixable(f.cause)) return null
  if (f.liveListings < 1) return null
  const byOrders = f.ordersBefore >= MIN_ORDERS_BEFORE
  const byFailed = f.failedPaidLines >= MIN_FAILED_LINES
  if (!byOrders && !byFailed) return null
  const days = f.since ? Math.max(0, Math.floor((now.getTime() - f.since.getTime()) / 86_400_000)) : null
  let estimate: BlockedDemandAlert["estimate"] = null
  if (days !== null && days >= 1 && f.ordersBefore >= MIN_ORDERS_FOR_ESTIMATE) {
    const mean = (f.ordersBefore / REFERENCE_DAYS) * days
    const sd = Math.sqrt(mean)
    estimate = {
      orders: Math.round(mean * 10) / 10,
      low: Math.max(0, Math.floor(mean - 1.96 * sd)),
      high: Math.ceil(mean + 1.96 * sd),
    }
  }
  return {
    productId: f.productId,
    productName: f.productName,
    supplierId: f.supplierId,
    cause: f.cause,
    fix: FIX_FOR_CAUSE[f.cause],
    why: byOrders && byFailed ? "both" : byOrders ? "orders_before" : "failed_lines",
    observed: {
      ordersBefore: f.ordersBefore,
      ordersSince: f.ordersSince,
      failedPaidLines: f.failedPaidLines,
      liveListings: f.liveListings,
      lastPaidAt: f.lastPaidAt ? f.lastPaidAt.toISOString() : null,
    },
    since: f.since ? f.since.toISOString() : null,
    daysUnavailable: days,
    estimate,
  }
}

/** Most failed demand first, then most orders before, then longest unavailable. */
export function rankAlerts(alerts: ReadonlyArray<BlockedDemandAlert>): BlockedDemandAlert[] {
  return [...alerts].sort(
    (a, b) =>
      b.observed.failedPaidLines - a.observed.failedPaidLines ||
      b.observed.ordersBefore - a.observed.ordersBefore ||
      (b.daysUnavailable ?? 0) - (a.daysUnavailable ?? 0) ||
      a.productId.localeCompare(b.productId)
  )
}

/** Groups NEW alerts per supplier: ONE bell per supplier (single product or a summary). */
export function planSupplierDigests(newAlerts: ReadonlyArray<BlockedDemandAlert>) {
  const by = new Map<string, BlockedDemandAlert[]>()
  for (const a of newAlerts) by.set(a.supplierId, [...(by.get(a.supplierId) ?? []), a])
  return [...by.entries()]
    .map(([supplierId, items]) => ({ supplierId, items: rankAlerts(items), kind: items.length > 1 ? ("digest" as const) : ("single" as const) }))
    .sort((a, b) => b.items.length - a.items.length || a.supplierId.localeCompare(b.supplierId))
}

/**
 * A digest already in a supplier's bell becomes OBSOLETE when none of its products is still blocked (fixed meanwhile):
 * it is then marked read rather than left as a false alarm. Pure decision.
 */
export function digestIsObsolete(productIds: ReadonlyArray<string>, stillBlocked: ReadonlySet<string>): boolean {
  return productIds.length > 0 && productIds.every((id) => !stillBlocked.has(id))
}

// ---------------------------------------------------------------------------------------------------------------
// Supplier preference (no migration: one AuditLog row per supplier, default = in-app ON).
// ---------------------------------------------------------------------------------------------------------------

export const SUPPLIER_ALERT_PREF_ACTION = "supplier.alert_preference"
export function supplierAlertPreferenceId(supplierId: string): string {
  return `supplier-alert-preference:${supplierId}`
}
export type SupplierAlertPreference = { blockedDemandInApp: boolean; locale: string }
export const DEFAULT_SUPPLIER_ALERT_PREFERENCE: SupplierAlertPreference = { blockedDemandInApp: true, locale: "fr" }

export function parseSupplierAlertPreference(raw: unknown): SupplierAlertPreference {
  if (!raw || typeof raw !== "object") return DEFAULT_SUPPLIER_ALERT_PREFERENCE
  const r = raw as Record<string, unknown>
  return {
    blockedDemandInApp: typeof r.blockedDemandInApp === "boolean" ? r.blockedDemandInApp : true,
    locale: typeof r.locale === "string" && /^[a-z]{2}$/.test(r.locale) ? r.locale : "fr",
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Observe-mode measurement (counts only).
// ---------------------------------------------------------------------------------------------------------------

export const BLOCKED_DEMAND_OBSERVATION_ACTION = "supplier.blocked_demand_observation"
export const BLOCKED_DEMAND_OBSERVED_ACTION = "supplier.blocked_demand_observed"
export function blockedDemandObservationId(now: Date): string {
  return `supplier-blocked-demand-observation:${now.toISOString().slice(0, 10)}`
}

export type BlockedDemandObservation = {
  day: string
  listedProducts: number
  unavailable: number
  byCause: Record<string, number>
  /** Unavailable with real demand and a cause the supplier can fix. */
  qualifying: number
  suppliersQualifying: number
  /** Alerts `enforce` would have created today (new episodes), and the bells (one per supplier). */
  wouldNotifyNew: number
  wouldNotifySuppliers: number
  wouldSkipPreference: number
  episodesOpened: number
  episodesResolved: number
  failedPaidLines: number
  truncated: boolean
}

export function summarizeBlockedDemand(args: {
  now: Date
  listedProducts: number
  causes: ReadonlyArray<UnavailabilityCause>
  qualifying: ReadonlyArray<BlockedDemandAlert>
  newAlerts: ReadonlyArray<BlockedDemandAlert>
  prefOff: ReadonlySet<string>
  episodesOpened: number
  episodesResolved: number
  truncated: boolean
}): BlockedDemandObservation {
  const byCause: Record<string, number> = {}
  for (const c of args.causes) byCause[c] = (byCause[c] ?? 0) + 1
  const sendable = args.newAlerts.filter((a) => !args.prefOff.has(a.supplierId))
  return {
    day: args.now.toISOString().slice(0, 10),
    listedProducts: args.listedProducts,
    unavailable: args.causes.length,
    byCause,
    qualifying: args.qualifying.length,
    suppliersQualifying: new Set(args.qualifying.map((a) => a.supplierId)).size,
    wouldNotifyNew: sendable.length,
    wouldNotifySuppliers: new Set(sendable.map((a) => a.supplierId)).size,
    wouldSkipPreference: args.newAlerts.length - sendable.length,
    episodesOpened: args.episodesOpened,
    episodesResolved: args.episodesResolved,
    failedPaidLines: args.qualifying.reduce((s, a) => s + a.observed.failedPaidLines, 0),
    truncated: args.truncated,
  }
}
