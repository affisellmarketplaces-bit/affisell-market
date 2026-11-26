/**
 * PROCUREMENT DEBIT REGISTER — pure rules (founder decision 2026-11-19). Storage: `ProcurementDebit` /
 * `ProcurementDebitAllocation` (migration 20261119090000_procurement_debit_register); writes: register.server.ts.
 *
 * Three amounts that are NEVER confused:
 *  - the STORED PRICE   `Order.aeWholesaleCents` — the source price Affisell memorised (unit price × quantity, delivery
 *                       excluded). Affisell's own record; no money moved. Never enters the register.
 *  - the DEBITED amount what really left Affisell's account for the goods: Σ debits − Σ refunds reconciled to the order,
 *                       in SETTLED euros (the amount the bank / card really took after conversion).
 *  - the FULL COST      debited amount + fees (card, FX, customs…) reconciled to the order.
 * An order's DEBITED amount and FULL COST are its REAL cost only when its reconciliation is COMPLETE
 * (`reconcileOrderCost`: status `reconciled`). Otherwise the figures are shown as provisional, never as the cost.
 *
 * What is a movement and what is not (Stripe Issuing vocabulary, docs.stripe.com/issuing/purchases/transactions):
 *  - an AUTHORIZATION is a hold, not money: it is never a movement (a reversed / expired one leaves nothing behind);
 *  - a CAPTURE moved money out (`issuing.transaction` type `capture`, negative amount) → kind `debit`;
 *  - a REFUND moved money back (type `refund`, positive amount) → kind `refund`;
 *  - a REFUND REVERSAL took a refund back (type `refund`, NEGATIVE amount — rare) → kind `refund_reversal`, counted as
 *    money out again;
 *  - a FEE is charged on top (card / FX / customs invoices) → kind `fee`;
 *  - an order cancelled at the source AFTER capture comes back as a refund; before capture it is only a released hold.
 * Where the figures come from (`amountOrigin`): `read_from_source` (an Issuing transaction imported by the server —
 * the only way an Issuing movement exists) or `typed_from_document` (statement / invoice, with its evidence). A
 * movement the importer could not tie with certainty is kept APART (`reviewState: needs_review`): visible, never
 * allocatable until a person resolves it.
 * Reconciliation = allocating a movement (or part of it) to an order. One movement can cover several orders (grouped
 * purchase: `grouped_split`), one order can be paid by several movements (`partial_payment`), a refund gives back part
 * of ONE debit and is allocated to orders that debit covered, a fee may follow a debit or stand alone.
 * No double counting, by construction AND in the database: a transaction is recorded once (source + reference unique),
 * a movement is allocated at most once per order (partial unique index), its active allocations never exceed its
 * settled amount (trigger), a refund to an order never exceeds that order's share of its debit.
 * No card number, no personal data: a reference or an evidence text that looks like a card number is refused.
 * Pure module — no database, no money path.
 */
import type { ObservedCostEntry } from "@/lib/supplier-costs/observed-cost-register"

export const DEBIT_KINDS = ["debit", "refund", "refund_reversal", "fee"] as const
export type DebitKind = (typeof DEBIT_KINDS)[number]

export const DEBIT_SOURCES = ["stripe_issuing", "card_statement", "bank_statement", "supplier_invoice_paid"] as const
export type DebitSource = (typeof DEBIT_SOURCES)[number]
/** Sources a PERSON may type from a document. Issuing movements are only ever imported from Stripe. */
export const TYPED_SOURCES = ["card_statement", "bank_statement", "supplier_invoice_paid"] as const

export const AMOUNT_ORIGINS = ["read_from_source", "typed_from_document"] as const
export type AmountOrigin = (typeof AMOUNT_ORIGINS)[number]

export const REVIEW_STATES = ["none", "needs_review", "resolved"] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

export const ALLOCATION_BASES = ["single_order", "grouped_split", "partial_payment", "manual"] as const
export type AllocationBasis = (typeof ALLOCATION_BASES)[number]

export const EVIDENCE_TYPES = ["statement_line", "receipt", "invoice", "source_order_record", "other"] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export const VAT_TREATMENTS = ["included", "excluded", "unknown"] as const
export type VatTreatment = (typeof VAT_TREATMENTS)[number]

export type Evidence = { type: EvidenceType; reference: string; description: string }

export type DebitInput = {
  kind: DebitKind
  source: DebitSource
  sourceReference: string
  amountCents: number
  currency: string
  settledAmountCents: number | null
  occurredAt: string
  parentDebitId: string | null
  includesDelivery: boolean | null
  vatTreatment: VatTreatment
  evidence: Evidence[]
  note: string
}

const MAX_CENTS = 100_000_000 // 1 000 000 € for one movement: above is a typo, refused.
const EARLIEST = Date.parse("2020-01-01T00:00:00.000Z")

function luhnValid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/**
 * A run of 13–19 digits (spaces / dashes ignored) that passes the Luhn check card numbers carry — every window of the
 * run is tested, so a card number hidden in a longer reference is caught. Long digit references that are NOT card
 * numbers (bank transaction ids, timestamps) mostly fail Luhn and are kept; about 1 in 10 would be refused — the admin
 * then types the reference with a separator or the last digits only. Fails closed on doubt.
 */
export function looksLikeCardNumber(text: string): boolean {
  const compact = text.replace(/[\s-]/g, "")
  for (const run of compact.match(/\d{13,}/g) ?? []) {
    for (let len = 13; len <= 19; len++) {
      for (let i = 0; i + len <= run.length; i++) if (luhnValid(run.slice(i, i + len))) return true
    }
  }
  return false
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" ? v.trim().slice(0, max) : null)
const posInt = (v: unknown, max: number): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n <= max ? n : null
}
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null

export function parseEvidence(raw: unknown): { ok: true; value: Evidence[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: [] }
  if (!Array.isArray(raw) || raw.length > 10) return { ok: false, error: "evidence_invalid" }
  const out: Evidence[] = []
  for (const item of raw) {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : null
    const type = oneOf(EVIDENCE_TYPES, o?.type)
    const reference = str(o?.reference, 200) ?? ""
    const description = str(o?.description, 500) ?? ""
    if (!type || reference.length + description.length < 3) return { ok: false, error: "evidence_invalid" }
    if (looksLikeCardNumber(reference) || looksLikeCardNumber(description)) return { ok: false, error: "evidence_looks_like_card_number" }
    out.push({ type, reference, description })
  }
  return { ok: true, value: out }
}

/** Strict validation of a movement an admin records. Nothing is guessed (no rate, no default amount). */
export function parseDebitInput(body: unknown, now: Date): { ok: true; value: DebitInput } | { ok: false; errors: string[] } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: string[] = []
  const kind = oneOf(DEBIT_KINDS, b.kind)
  if (!kind) errors.push("kind_invalid")
  const source = oneOf(DEBIT_SOURCES, b.source)
  if (!source) errors.push("source_invalid")
  // A person never types an Issuing movement: it is read from Stripe by the importer (verifiable figures).
  else if (source === "stripe_issuing") errors.push("issuing_is_imported_not_typed")
  const ref = str(b.sourceReference, 200) ?? ""
  if (ref.length < 1) errors.push("reference_required")
  else if (looksLikeCardNumber(ref)) errors.push("reference_looks_like_card_number")
  const amount = posInt(b.amountCents, MAX_CENTS)
  if (amount === null) errors.push("amount_invalid")
  const currency = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : ""
  if (!/^[A-Z]{3}$/.test(currency)) errors.push("currency_invalid")
  let settled: number | null = null
  if (b.settledAmountCents != null && b.settledAmountCents !== "") {
    settled = posInt(b.settledAmountCents, MAX_CENTS)
    if (settled === null) errors.push("settled_amount_invalid")
  }
  // In euros the charged amount IS the settled amount; a second, different figure would be a contradiction.
  if (currency === "EUR" && amount !== null) {
    if (settled !== null && settled !== amount) errors.push("eur_settled_mismatch")
    settled = amount
  }
  const occurred = typeof b.occurredAt === "string" ? Date.parse(b.occurredAt) : Number.NaN
  if (!Number.isFinite(occurred) || occurred < EARLIEST) errors.push("occurred_at_invalid")
  else if (occurred > now.getTime() + 86_400_000) errors.push("occurred_at_in_future")
  const parent = typeof b.parentDebitId === "string" && b.parentDebitId.trim() ? b.parentDebitId.trim().slice(0, 64) : null
  if ((kind === "refund" || kind === "refund_reversal") && !parent) errors.push("refund_needs_its_debit")
  if (kind === "debit" && parent) errors.push("debit_has_no_parent")
  const includesDelivery = typeof b.includesDelivery === "boolean" ? b.includesDelivery : null
  const vat = b.vatTreatment == null ? "unknown" : oneOf(VAT_TREATMENTS, b.vatTreatment)
  if (!vat) errors.push("vat_invalid")
  const evidence = parseEvidence(b.evidence)
  if (!evidence.ok) errors.push(evidence.error)
  // A movement typed from a statement or an invoice needs the document it was read from.
  if (evidence.ok && source && evidence.value.length === 0) errors.push("evidence_required")
  const note = str(b.note, 1000) ?? ""
  if (looksLikeCardNumber(note)) errors.push("note_looks_like_card_number")
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      kind: kind!,
      source: source!,
      sourceReference: ref,
      amountCents: amount!,
      currency,
      settledAmountCents: settled,
      occurredAt: new Date(occurred).toISOString(),
      parentDebitId: parent,
      includesDelivery,
      vatTreatment: vat!,
      evidence: evidence.ok ? evidence.value : [],
      note,
    },
  }
}

export type AllocationRequest = { orderId: string; amountCents: number; basis: AllocationBasis; note: string }

export function parseAllocationInput(body: unknown): { ok: true; value: AllocationRequest } | { ok: false; errors: string[] } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: string[] = []
  const orderId = typeof b.orderId === "string" && b.orderId.trim() ? b.orderId.trim().slice(0, 64) : null
  if (!orderId) errors.push("order_required")
  const amount = posInt(b.amountCents, MAX_CENTS)
  if (amount === null) errors.push("amount_invalid")
  const basis = oneOf(ALLOCATION_BASES, b.basis)
  if (!basis) errors.push("basis_invalid")
  const note = str(b.note, 500) ?? ""
  if (basis === "manual" && note.length < 3) errors.push("manual_needs_reason")
  if (looksLikeCardNumber(note)) errors.push("note_looks_like_card_number")
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: { orderId: orderId!, amountCents: amount!, basis: basis!, note } }
}

export type MovementRow = {
  id: string
  kind: DebitKind
  source: string
  sourceReference: string
  status: "recorded" | "voided"
  reviewState?: ReviewState
  issuingCardId?: string | null
  amountCents: number
  currency: string
  settledAmountCents: number | null
  parentDebitId: string | null
  includesDelivery: boolean | null
  vatTreatment: VatTreatment
  occurredAt: string
}
export type AllocationRow = { id: string; debitId: string; orderId: string; amountCents: number; status: "active" | "revoked" }

export type AllocationCheck =
  | { ok: true; remainingAfterCents: number }
  | {
      ok: false
      error:
        | "movement_voided"
        | "movement_needs_review"
        | "refund_without_its_debit"
        | "order_not_linked_to_card"
        | "settled_amount_unknown"
        | "already_allocated_to_order"
        | "over_allocated"
        | "parent_not_allocated_to_order"
        | "refund_exceeds_order_share"
        | "reversal_exceeds_order_refunds"
      remainingCents?: number
    }

/**
 * May `request` be allocated? `allocations` = every allocation of the movement, its parent and its siblings (any
 * status; only active ones count).
 */
export function checkAllocation(args: {
  movement: MovementRow
  parent: MovementRow | null
  allocations: ReadonlyArray<AllocationRow>
  siblings: ReadonlyArray<MovementRow>
  request: AllocationRequest
  /**
   * For an Issuing movement: the orders Affisell's own record ties to its card (`FulfillmentLog.virtualCardId`). An
   * Issuing movement can only be allocated to one of them — never to an order chosen by hand.
   */
  cardOrderIds?: ReadonlyArray<string>
}): AllocationCheck {
  const { movement: m, request: r } = args
  if (m.status !== "recorded") return { ok: false, error: "movement_voided" }
  if (m.reviewState === "needs_review") return { ok: false, error: "movement_needs_review" }
  if ((m.kind === "refund" || m.kind === "refund_reversal") && !m.parentDebitId) return { ok: false, error: "refund_without_its_debit" }
  if (m.source === "stripe_issuing" && !(args.cardOrderIds ?? []).includes(r.orderId)) return { ok: false, error: "order_not_linked_to_card" }
  if (m.settledAmountCents == null) return { ok: false, error: "settled_amount_unknown" }
  const active = args.allocations.filter((a) => a.status === "active")
  const own = active.filter((a) => a.debitId === m.id)
  if (own.some((a) => a.orderId === r.orderId)) return { ok: false, error: "already_allocated_to_order" }
  const used = own.reduce((s, a) => s + a.amountCents, 0)
  const remaining = m.settledAmountCents - used
  if (r.amountCents > remaining) return { ok: false, error: "over_allocated", remainingCents: remaining }
  if (m.parentDebitId && args.parent) {
    const parentShare = active.filter((a) => a.debitId === args.parent!.id && a.orderId === r.orderId).reduce((s, a) => s + a.amountCents, 0)
    if (parentShare === 0) return { ok: false, error: "parent_not_allocated_to_order" }
    const sumOf = (kind: DebitKind) => {
      const ids = new Set(args.siblings.filter((s) => s.kind === kind && s.status === "recorded" && s.id !== m.id).map((s) => s.id))
      return active.filter((a) => ids.has(a.debitId) && a.orderId === r.orderId).reduce((s, a) => s + a.amountCents, 0)
    }
    // Net refunded to this order = refunds − reversals already allocated (all movements of the same debit).
    const refunded = sumOf("refund")
    const reversed = sumOf("refund_reversal")
    if (m.kind === "refund") {
      // Never refund more than was paid for this order.
      const room = parentShare - (refunded - reversed)
      if (r.amountCents > room) return { ok: false, error: "refund_exceeds_order_share", remainingCents: room }
    }
    if (m.kind === "refund_reversal") {
      // A reversal only takes back a refund this order received.
      const room = refunded - reversed
      if (r.amountCents > room) return { ok: false, error: "reversal_exceeds_order_refunds", remainingCents: Math.max(0, room) }
    }
  }
  return { ok: true, remainingAfterCents: remaining - r.amountCents }
}

function kindLabel(k: DebitKind): string {
  return k === "refund" ? "remboursement" : k === "refund_reversal" ? "annulation de remboursement" : k === "fee" ? "frais" : "débit"
}

/** Where a movement stands — unreconciled movements are a state of their own, never mixed with allocated ones. */
export type MovementState = "voided" | "needs_review" | "unallocated" | "partially_allocated" | "fully_allocated" | "not_allocatable"

export function movementState(m: MovementRow, allocations: ReadonlyArray<AllocationRow>): MovementState {
  if (m.status === "voided") return "voided"
  if (m.reviewState === "needs_review") return "needs_review"
  if (m.settledAmountCents == null) return "not_allocatable"
  const used = allocations.filter((a) => a.status === "active" && a.debitId === m.id).reduce((s, a) => s + a.amountCents, 0)
  if (used === 0) return "unallocated"
  return used >= m.settledAmountCents ? "fully_allocated" : "partially_allocated"
}

export type ReconciliationStatus = "not_reconciled" | "incomplete" | "reconciled"

export type OrderCostReconciliation = {
  orderId: string
  status: ReconciliationStatus
  /** The memorised source price — shown for comparison, NEVER a cost. */
  storedSourcePriceCents: number | null
  /** Sums of this order's allocations, settled euros. Provisional unless `status === "reconciled"`. */
  debitedCents: number
  refundedCents: number
  feesCents: number
  netDebitedCents: number
  fullCostCents: number
  /** The order's REAL cost: only when reconciled; null otherwise — never a provisional figure. */
  realDebitedCents: number | null
  realFullCostCents: number | null
  /** full cost − stored price: only when reconciled and a stored price exists. */
  storedVsFullCostGapCents: number | null
  /** Why the reconciliation is not complete (empty when reconciled). */
  reasons: string[]
  /** Original currencies of the movements (FX: the settled euros are what counts). */
  originalCurrencies: string[]
  /** Implied settled-per-original rate of each foreign-currency movement (information, never applied elsewhere). */
  fxRates: Array<{ movementId: string; currency: string; ratePerUnit: number }>
  /** What the reconciled debits cover — the perimeter of a `charged_amount` entry. */
  includesDelivery: boolean | null
  vat: VatTreatment
  movements: Array<{
    id: string
    kind: DebitKind
    source: string
    reference: string
    occurredAt: string
    currency: string
    amountCents: number
    settledAmountCents: number | null
    allocatedToOrderCents: number
    unallocatedCents: number
  }>
}

/**
 * Reconciliation of ONE order. `movements` / `allocations` must include every movement allocated to the order, their
 * children (refunds, fees) and parents, with ALL their active allocations (other orders included) — that is what tells
 * whether a grouped debit is fully shared out.
 */
export function reconcileOrderCost(args: {
  orderId: string
  storedSourcePriceCents: number | null
  movements: ReadonlyArray<MovementRow>
  allocations: ReadonlyArray<AllocationRow>
}): OrderCostReconciliation {
  const recorded = args.movements.filter((m) => m.status === "recorded")
  const byId = new Map(recorded.map((m) => [m.id, m]))
  const active = args.allocations.filter((a) => a.status === "active" && byId.has(a.debitId))
  const allocatedTotal = (id: string) => active.filter((a) => a.debitId === id).reduce((s, a) => s + a.amountCents, 0)
  const mine = active.filter((a) => a.orderId === args.orderId)
  const sumKind = (k: DebitKind) => mine.filter((a) => byId.get(a.debitId)!.kind === k).reduce((s, a) => s + a.amountCents, 0)
  const debited = sumKind("debit") + sumKind("refund_reversal")
  const refunded = sumKind("refund")
  const fees = sumKind("fee")
  const reasons: string[] = []
  const involved = new Set(mine.map((a) => a.debitId))
  const myDebits = [...involved].map((id) => byId.get(id)!).filter((m) => m.kind === "debit")
  if (mine.length === 0) reasons.push("aucun débit rapproché de cette commande")
  else if (myDebits.length === 0) reasons.push("seuls des frais ou remboursements sont rapprochés, aucun débit")
  for (const id of involved) {
    const m = byId.get(id)!
    const rest = (m.settledAmountCents ?? 0) - allocatedTotal(id)
    if (rest > 0) {
      reasons.push(
        m.kind === "debit"
          ? `débit ${m.sourceReference} réparti en partie seulement (${rest} c non attribués) : la part de cette commande n'est pas établie`
          : `${kindLabel(m.kind)} ${m.sourceReference} réparti en partie seulement`
      )
    }
  }
  // Refunds / fees of this order's debits that are not shared out at all: the order's cost is not settled yet.
  for (const d of myDebits) {
    for (const child of recorded.filter((c) => c.parentDebitId === d.id)) {
      if (involved.has(child.id) || child.reviewState === "needs_review") continue
      const rest = (child.settledAmountCents ?? 0) - allocatedTotal(child.id)
      if (child.settledAmountCents == null) reasons.push(`${kindLabel(child.kind)} ${child.sourceReference} sans montant réglé en euros`)
      else if (rest > 0) reasons.push(`${kindLabel(child.kind)} ${child.sourceReference} du débit ${d.sourceReference} non réparti`)
    }
  }
  // Movements waiting for a person that touch this order's purchases (same debit, or same Issuing card): its cost is
  // not settled while they are not resolved.
  const myCards = new Set(myDebits.map((d) => d.issuingCardId).filter((c): c is string => !!c))
  for (const m of recorded) {
    if (m.reviewState !== "needs_review" || involved.has(m.id)) continue
    const sameDebit = m.parentDebitId != null && myDebits.some((d) => d.id === m.parentDebitId)
    const sameCard = !!m.issuingCardId && myCards.has(m.issuingCardId)
    if (sameDebit || sameCard) reasons.push(`mouvement ${m.sourceReference} à examiner (rattachement incertain)`)
  }
  const net = debited - refunded
  if (net < 0) reasons.push("remboursements supérieurs aux débits rapprochés")
  const status: ReconciliationStatus = mine.length === 0 ? "not_reconciled" : reasons.length === 0 ? "reconciled" : "incomplete"
  const ok = status === "reconciled"
  const delivery = new Set(myDebits.map((d) => d.includesDelivery))
  const vat = new Set(myDebits.map((d) => d.vatTreatment))
  return {
    orderId: args.orderId,
    status,
    storedSourcePriceCents: args.storedSourcePriceCents && args.storedSourcePriceCents > 0 ? args.storedSourcePriceCents : null,
    debitedCents: debited,
    refundedCents: refunded,
    feesCents: fees,
    netDebitedCents: net,
    fullCostCents: net + fees,
    realDebitedCents: ok ? net : null,
    realFullCostCents: ok ? net + fees : null,
    storedVsFullCostGapCents: ok && args.storedSourcePriceCents && args.storedSourcePriceCents > 0 ? net + fees - args.storedSourcePriceCents : null,
    reasons,
    originalCurrencies: [...new Set([...involved].map((id) => byId.get(id)!.currency))].sort(),
    fxRates: [...involved]
      .map((id) => byId.get(id)!)
      .filter((m) => m.currency !== "EUR" && m.settledAmountCents != null)
      .map((m) => ({ movementId: m.id, currency: m.currency, ratePerUnit: Math.round(((m.settledAmountCents as number) / m.amountCents) * 1e6) / 1e6 })),
    includesDelivery: delivery.size === 1 ? [...delivery][0]! : null,
    vat: vat.size === 1 ? [...vat][0]! : "unknown",
    movements: [...involved].map((id) => {
      const m = byId.get(id)!
      const toOrder = mine.filter((a) => a.debitId === id).reduce((s, a) => s + a.amountCents, 0)
      return {
        id,
        kind: m.kind,
        source: m.source,
        reference: m.sourceReference,
        occurredAt: m.occurredAt,
        currency: m.currency,
        amountCents: m.amountCents,
        settledAmountCents: m.settledAmountCents,
        allocatedToOrderCents: toOrder,
        unallocatedCents: (m.settledAmountCents ?? 0) - allocatedTotal(id),
      }
    }),
  }
}

/** Per movement: allocated, remaining, and a breach flag (a breach can only come from a write that bypassed the rules). */
export function movementBalances(movements: ReadonlyArray<MovementRow>, allocations: ReadonlyArray<AllocationRow>) {
  return movements.map((m) => {
    const used = allocations.filter((a) => a.status === "active" && a.debitId === m.id).reduce((s, a) => s + a.amountCents, 0)
    const cap = m.settledAmountCents ?? 0
    return { id: m.id, allocatedCents: used, remainingCents: cap - used, overAllocated: used > cap }
  })
}

/**
 * Observed-cost entries (observed-cost-register.ts) for an order — ONLY when its reconciliation is complete: one
 * `charged_amount` (net debited, settled euros, line total, perimeter of its debits) and one `fee` when fees exist.
 * Anything not reconciled produces nothing: an unreconciled debit is never presented as an order's cost.
 */
export function entriesFromReconciliation(
  rec: OrderCostReconciliation,
  ctx: { productId: string; quantity: number; observedAt: string; variantKey: string | null }
): ObservedCostEntry[] {
  if (rec.status !== "reconciled" || rec.realDebitedCents == null) return []
  const perimeter = { currency: "EUR", basis: "line" as const, includesDelivery: rec.includesDelivery, vat: rec.vat, variantKey: ctx.variantKey }
  const common = { orderId: rec.orderId, productId: ctx.productId, quantity: Math.max(1, Math.round(ctx.quantity)), source: "procurement_debit_register" as const, reliability: "constate" as const, observedAt: ctx.observedAt }
  const out: ObservedCostEntry[] = [{ ...common, kind: "charged_amount", amountCents: rec.realDebitedCents, perimeter, note: "" }]
  if (rec.feesCents > 0) out.push({ ...common, kind: "fee", amountCents: rec.feesCents, perimeter: { ...perimeter, includesDelivery: null, vat: "unknown" }, note: "" })
  return out
}
