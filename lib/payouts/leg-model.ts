/**
 * Payout leg registry — the PURE rules (no database, no Stripe, no `server-only`).
 *
 * A "leg" is one payout that may be paid AT MOST ONCE: (order × role) for the marketplace (supplier, reseller, Légion
 * sponsor), or one obligation of another rail (blind-dropship supplier group, auto-order provider batch, agent withdrawal).
 * Every Stripe transfer Affisell creates goes through ONE service (`leg-transfer.server.ts`) that applies these rules; the
 * database repeats the important ones as CHECK constraints and a transition trigger (migration
 * `20261125090000_payout_leg_registry`), so a future code path that forgets them still cannot revive a paid or in-doubt leg.
 *
 * States (docs/PAYOUT-LEG-REGISTRY.md):
 *   PENDING           known, not being sent (never sent, or released after a call that provably created nothing)
 *   PROCESSING        claimed by one worker under a lease; the Stripe call happens only in this state
 *   PAID              a Stripe transfer exists and is recorded (terminal)
 *   IN_DOUBT          a transfer MAY exist (timeout, network error, 5xx, crash, idempotency conflict, ambiguous search,
 *                     legacy reference): no automatic creation, ever — only reconciliation (→ PAID) or a human decision
 *                     backed by a complete Stripe search (→ FAILED_CONFIRMED)
 *   FAILED_CONFIRMED  Stripe refused the request (4xx business / validation error) or a human confirmed nothing was paid:
 *                     a new attempt is allowed, under a NEW generation (new idempotency key), after a new Stripe search
 */
import { createHash } from "node:crypto"

export const PAYOUT_LEG_STATES = ["PENDING", "PROCESSING", "PAID", "IN_DOUBT", "FAILED_CONFIRMED"] as const
export type PayoutLegState = (typeof PAYOUT_LEG_STATES)[number]

export const PAYOUT_LEG_KINDS = ["order", "blind_dropship", "auto_order", "agent_withdrawal"] as const
export type PayoutLegKind = (typeof PAYOUT_LEG_KINDS)[number]

export const PAYOUT_LEG_ROLES = [
  "SUPPLIER",
  "AFFILIATE",
  "LEGION_SPONSOR",
  "BLIND_SUPPLIER",
  "AUTO_ORDER_PROVIDER",
  "AGENT",
] as const
export type PayoutLegRole = (typeof PAYOUT_LEG_ROLES)[number]

export const PAYOUT_LEG_RAILS = [
  "process_transfers",
  "lightning",
  "legion",
  "blind_dropship",
  "auto_order",
  "agent_withdrawal",
  "reconciliation",
] as const
export type PayoutLegRail = (typeof PAYOUT_LEG_RAILS)[number]

/**
 * A PROCESSING claim older than this is presumed interrupted (process killed between the claim and the record). The
 * Stripe client's own timeout (80 s) and retries stay far below it. An expired claim becomes IN_DOUBT, never PENDING:
 * the dead worker may have reached Stripe.
 */
export const PAYOUT_LEG_LEASE_MS = 15 * 60 * 1000

/**
 * A human may confirm "nothing was paid" only this long after the last claim: the Stripe list is searched after that,
 * so a transfer still propagating to the list endpoint cannot be missed.
 */
export const PAYOUT_LEG_CONFIRM_SAFETY_MS = 60 * 60 * 1000

/** Pages of 100 read from `GET /v1/transfers?transfer_group=` before the search is declared incomplete. */
export const PAYOUT_LEG_SEARCH_MAX_PAGES = 10

// ---------------------------------------------------------------------------------------------------------------------
// Keys

export function orderLegKey(orderId: string, role: "SUPPLIER" | "AFFILIATE" | "LEGION_SPONSOR"): string {
  return `order:${orderId}:${role}`
}
export function blindDropshipLegKey(blindOrderId: string, blindSupplierId: string): string {
  return `blind_dropship:${blindOrderId}:${blindSupplierId}`
}
export function autoOrderLegKey(batchId: string, providerId: string): string {
  return `auto_order:${batchId}:${providerId}`
}
export function agentWithdrawalLegKey(ledgerEntryId: string): string {
  return `agent_withdrawal:${ledgerEntryId}`
}

/**
 * The Stripe idempotency key of a leg's generation — shared by every rail (Lightning and the standard job send the same
 * key for the same leg). It changes only when a generation was PROVED unpaid (FAILED_CONFIRMED).
 */
export function legIdempotencyKey(legKey: string, generation: number): string {
  return `affisell_leg:${legKey}:g${generation}`
}

// ---------------------------------------------------------------------------------------------------------------------
// Frozen request

export type LegEconomicParams = {
  amountCents: number
  currency: string
  destination: string
  sourceTransaction: string | null
}

export type LegTransferRequest = {
  amount: number
  currency: string
  destination: string
  transfer_group: string
  source_transaction?: string
  description?: string
  metadata: Record<string, string>
}

export function normalizeEconomicParams(p: LegEconomicParams): LegEconomicParams {
  return {
    amountCents: Math.round(p.amountCents),
    currency: p.currency.trim().toLowerCase(),
    destination: p.destination.trim(),
    sourceTransaction: p.sourceTransaction?.trim() || null,
  }
}

export function validateEconomicParams(p: LegEconomicParams): string | null {
  if (!Number.isInteger(p.amountCents) || p.amountCents < 1) return "amount_invalid"
  if (!/^[a-z]{3}$/.test(p.currency)) return "currency_invalid"
  if (!/^acct_[A-Za-z0-9_]+$/.test(p.destination)) return "destination_invalid"
  if (p.sourceTransaction && !/^(ch|py)_[A-Za-z0-9_]+$/.test(p.sourceTransaction)) return "source_transaction_invalid"
  return null
}

/**
 * Hash of what decides WHO receives HOW MUCH from WHICH charge. Two rails that would send a different amount, currency,
 * destination or source charge for the same leg are refused (`params_changed`) instead of silently sending either one.
 * Metadata / description are not in it: they are frozen with the first claim and replayed as is by every rail.
 */
export function economicParamsHash(p: LegEconomicParams): string {
  const n = normalizeEconomicParams(p)
  return createHash("sha256")
    .update(JSON.stringify([n.amountCents, n.currency, n.destination, n.sourceTransaction ?? ""]))
    .digest("hex")
}

export function buildLegTransferRequest(args: {
  legKey: string
  kind: PayoutLegKind
  role: PayoutLegRole
  rail: PayoutLegRail
  orderId: string | null
  generation: number
  transferGroup: string
  params: LegEconomicParams
  description?: string | null
  extraMetadata?: Record<string, string>
}): LegTransferRequest {
  const p = normalizeEconomicParams(args.params)
  const metadata: Record<string, string> = {}
  for (const [k, v] of Object.entries(args.extraMetadata ?? {})) {
    if (k.startsWith("affisell_")) continue // the normalised keys below can not be overridden
    metadata[k] = String(v).slice(0, 500)
  }
  metadata.affisell_leg_key = args.legKey
  metadata.affisell_role = args.role
  metadata.affisell_rail = args.rail
  metadata.affisell_kind = args.kind
  metadata.affisell_generation = String(args.generation)
  if (args.orderId) {
    metadata.affisell_order_id = args.orderId
    // Keys older readers (dashboards, support) look for — kept, never relied upon by the registry.
    metadata.orderId = args.orderId
    if (args.role === "SUPPLIER" || args.role === "AFFILIATE") metadata.role = args.role
  }
  return {
    amount: p.amountCents,
    currency: p.currency,
    destination: p.destination,
    transfer_group: args.transferGroup,
    ...(p.sourceTransaction ? { source_transaction: p.sourceTransaction } : {}),
    ...(args.description ? { description: args.description.slice(0, 350) } : {}),
    metadata,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Claim decision

export type LegRowView = {
  state: PayoutLegState
  generation: number
  paramsHash: string | null
  claimedAt: Date | null
  stripeTransferId: string | null
}

/** What Affisell already recorded about this leg OUTSIDE the registry (rows written before it existed). */
export type LegacyEvidence =
  | { kind: "none" }
  | { kind: "paid"; stripeTransferId: string; source: string }
  | { kind: "doubt"; reason: string }

export type ClaimDecision =
  | { action: "already_paid"; stripeTransferId: string }
  | { action: "adopt_legacy"; stripeTransferId: string; source: string }
  | { action: "mark_in_doubt"; reason: string }
  | { action: "in_doubt" }
  | { action: "busy" }
  | { action: "params_changed" }
  | { action: "claim"; generation: number; freezeParams: boolean }

/**
 * The single decision taken under the leg's row lock. Order matters: a recorded payment wins over everything, then any
 * doubt, then a live claim, then the frozen parameters.
 */
export function decideClaim(args: {
  leg: LegRowView
  evidence: LegacyEvidence
  paramsHash: string
  now: Date
  leaseMs?: number
}): ClaimDecision {
  const { leg, evidence, paramsHash, now } = args
  const leaseMs = args.leaseMs ?? PAYOUT_LEG_LEASE_MS

  if (leg.state === "PAID") {
    return { action: "already_paid", stripeTransferId: leg.stripeTransferId ?? "" }
  }
  if (evidence.kind === "paid") {
    return { action: "adopt_legacy", stripeTransferId: evidence.stripeTransferId, source: evidence.source }
  }
  if (leg.state === "IN_DOUBT") return { action: "in_doubt" }
  if (evidence.kind === "doubt") return { action: "mark_in_doubt", reason: evidence.reason }

  if (leg.state === "PROCESSING") {
    const claimedAt = leg.claimedAt?.getTime() ?? 0
    if (now.getTime() - claimedAt < leaseMs) return { action: "busy" }
    return { action: "mark_in_doubt", reason: "claim_lease_expired" }
  }

  if (leg.state === "FAILED_CONFIRMED") {
    return { action: "claim", generation: leg.generation + 1, freezeParams: true }
  }

  // PENDING
  if (leg.paramsHash && leg.paramsHash !== paramsHash) return { action: "params_changed" }
  return { action: "claim", generation: leg.generation, freezeParams: !leg.paramsHash }
}

// ---------------------------------------------------------------------------------------------------------------------
// Stripe search

export type StripeTransferView = {
  id: string
  amount: number
  currency: string
  destination: string | null
  transfer_group: string | null
  metadata: Record<string, string>
  created: number
}

export type LegIdentity = {
  legKey: string
  kind: PayoutLegKind
  role: PayoutLegRole
  orderId: string | null
}

/**
 * Which leg a transfer of the group belongs to. Recognises the normalised key and every metadata shape older rails wrote:
 * process-transfers `{orderId, role: SUPPLIER|AFFILIATE}`, Lightning `{orderId, role: supplier|affiliate, lightning}`,
 * Légion `{order_id, role: sponsor}`. Anything else in an ORDER group is "unidentified": nobody can say it is not ours.
 */
export function transferLegKeyOf(t: StripeTransferView, kind: PayoutLegKind): string | "unidentified" {
  const m = t.metadata ?? {}
  if (m.affisell_leg_key) return m.affisell_leg_key
  if (kind !== "order") return "unidentified"
  const orderId = m.orderId || m.order_id || ""
  const role = (m.role || "").toLowerCase()
  if (!orderId) return "unidentified"
  if (role === "supplier") return orderLegKey(orderId, "SUPPLIER")
  if (role === "affiliate") return orderLegKey(orderId, "AFFILIATE")
  if (role === "sponsor") return orderLegKey(orderId, "LEGION_SPONSOR")
  return "unidentified"
}

export type SearchVerdict =
  | { verdict: "none_found" }
  | { verdict: "adopt"; transfer: StripeTransferView }
  | { verdict: "in_doubt"; reason: string }
  | { verdict: "incomplete"; reason: string }

/**
 * Turn a Stripe search into a decision. Only a COMPLETE read with no matching and no unidentified transfer allows a
 * creation; one matching transfer with the frozen amount / destination is adopted; anything else is a doubt.
 */
export function judgeSearch(args: {
  leg: LegIdentity
  expected: { amountCents: number; destination: string; currency: string }
  complete: boolean
  transfers: StripeTransferView[]
}): SearchVerdict {
  if (!args.complete) return { verdict: "incomplete", reason: "stripe_search_incomplete" }
  const matches = args.transfers.filter((t) => transferLegKeyOf(t, args.leg.kind) === args.leg.legKey)
  const unidentified = args.transfers.filter((t) => transferLegKeyOf(t, args.leg.kind) === "unidentified")
  if (matches.length > 1) return { verdict: "in_doubt", reason: "duplicate_transfers_found" }
  if (matches.length === 1) {
    const t = matches[0]
    const consistent =
      t.amount === args.expected.amountCents &&
      (t.destination ?? "") === args.expected.destination &&
      t.currency.toLowerCase() === args.expected.currency.toLowerCase()
    if (!consistent) return { verdict: "in_doubt", reason: "existing_transfer_mismatch" }
    return { verdict: "adopt", transfer: t }
  }
  if (unidentified.length > 0) return { verdict: "in_doubt", reason: "unidentified_transfer_in_group" }
  return { verdict: "none_found" }
}

// ---------------------------------------------------------------------------------------------------------------------
// Stripe error classification

export type CreateErrorClass =
  /** Stripe refused: no transfer exists (business / validation 4xx). A later generation may try again. */
  | "failed_confirmed"
  /** Stripe did not process the request (429 rate limit): nothing exists, the same generation may retry. */
  | "not_processed"
  /** A transfer MAY exist. */
  | "in_doubt"

/**
 * Allow-list, not deny-list: only error shapes that PROVE nothing was created leave the doubt. Connection errors,
 * timeouts, 5xx, idempotency conflicts (409, `idempotency_error`) and anything unknown are doubts.
 */
export function classifyCreateError(error: unknown): CreateErrorClass {
  const e = (error ?? {}) as { type?: unknown; statusCode?: unknown; code?: unknown; rawType?: unknown }
  const type = typeof e.type === "string" ? e.type : ""
  const status = typeof e.statusCode === "number" ? e.statusCode : null
  const rawType = typeof e.rawType === "string" ? e.rawType : ""

  if (type === "StripeIdempotencyError" || rawType === "idempotency_error") return "in_doubt"
  if (type === "StripeRateLimitError" || status === 429) return "not_processed"
  if (status === 409) return "in_doubt"
  const refusalTypes = new Set([
    "StripeInvalidRequestError",
    "StripeCardError",
    "StripePermissionError",
    "StripeAuthenticationError",
  ])
  if (refusalTypes.has(type) && status !== null && status >= 400 && status < 500) return "failed_confirmed"
  return "in_doubt"
}

export function errorCodeOf(error: unknown): string {
  const e = (error ?? {}) as { code?: unknown; type?: unknown }
  if (typeof e.code === "string" && e.code) return e.code.slice(0, 120)
  if (typeof e.type === "string" && e.type) return e.type.slice(0, 120)
  return "unknown_error"
}

export function errorMessageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000)
}

// ---------------------------------------------------------------------------------------------------------------------
// Outcomes

export type LegOutcome =
  | { outcome: "paid"; stripeTransferId: string; amountCents: number; destination: string; generation: number }
  | {
      outcome: "already_paid"
      stripeTransferId: string
      amountCents: number | null
      destination: string | null
      adopted: boolean
    }
  | { outcome: "in_doubt"; reason: string }
  | { outcome: "busy" }
  | { outcome: "failed_confirmed"; errorCode: string; errorMessage: string }
  | { outcome: "retry_later"; reason: string }
  | { outcome: "params_changed" }
  | { outcome: "invalid_params"; reason: string }
  | { outcome: "registry_unavailable"; reason: string }

/** True when money left (or had already left) for this leg: the caller records it. */
export function isLegPaid(o: LegOutcome): o is Extract<LegOutcome, { outcome: "paid" | "already_paid" }> {
  return o.outcome === "paid" || o.outcome === "already_paid"
}

/**
 * True when NO Stripe call can have created anything during this call AND the leg is not in doubt: the caller may undo
 * a local reservation (agent debit) safely.
 */
export function legProvablyUnpaid(o: LegOutcome): boolean {
  return (
    o.outcome === "failed_confirmed" ||
    o.outcome === "retry_later" ||
    o.outcome === "params_changed" ||
    o.outcome === "invalid_params" ||
    o.outcome === "registry_unavailable"
  )
}
