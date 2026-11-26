/**
 * Payment rails — the provider-neutral contract between Affisell's marketplace core and any payment provider
 * (card via Stripe today; Mobile Money via a licensed aggregator such as pawaPay or FedaPay tomorrow).
 *
 * Why: in the UMOA (Benin, Senegal…), BCEAO Instruction 001-01-2024 requires anyone offering payment services to be
 * a licensed payment institution since 1 May 2025. Affisell is not one, so it must never hold or route buyers'
 * money itself: a LICENSED provider collects, splits and pays out. The core must therefore speak to providers
 * through one narrow contract, so that a provider can be added, replaced or switched off country by country without
 * touching orders, settlement or the ledger. Nothing here moves money: adapters do, behind this interface.
 *
 * PURE types: no I/O, no SDK, no secret.
 */

/** ISO 4217. XOF/XAF have NO minor unit (1 XOF is the smallest amount); EUR has cents. */
export type RailCurrency = "EUR" | "XOF" | "XAF" | "GHS" | "NGN" | "KES"

/** ISO 3166-1 alpha-2. */
export type RailCountry = string

export type RailMethod = "card" | "mobile_money"

/** Amount in the currency's MINOR unit (cents for EUR, francs for XOF). Integer, never a float. */
export type MinorAmount = number

export type RailCapability = {
  country: RailCountry
  currency: RailCurrency
  method: RailMethod
  /** Provider-side limits per transaction, minor units (from the provider's contract / docs). */
  minAmount: MinorAmount
  maxAmount: MinorAmount
  /** Mobile Money operators covered in that country (codes as the provider names them). */
  operators?: readonly string[]
  canRefund: boolean
  canPayout: boolean
}

/**
 * Fee schedule for ESTIMATES only (checkout preview, routing). The provider's statement is the source of truth:
 * reconciliation compares it with these numbers, never the other way round.
 */
export type RailFeeSchedule = {
  /** Percentage of the amount, in basis points. */
  bps: number
  /** Fixed part per transaction, minor units. */
  fixed: MinorAmount
  /** Settlement delay to Affisell's / the seller's account, business days (contractual). */
  settlementDays: number
}

export type RailStatus = "created" | "pending" | "succeeded" | "failed" | "expired" | "cancelled"
export type RefundStatus = "requested" | "pending" | "succeeded" | "failed"

/** A collection request, as the core expresses it. */
export type CollectionRequest = {
  /** Idempotency key chosen by Affisell (e.g. the order id): the same key never charges twice. */
  idempotencyKey: string
  country: RailCountry
  currency: RailCurrency
  method: RailMethod
  amount: MinorAmount
  /** E.164 phone number for mobile money (validated by `normaliseMsisdn`). */
  msisdn?: string
  operator?: string
  /** Shown on the buyer's phone / statement; short, no personal data. */
  statementDescriptor: string
}

export type CollectionIntent = {
  railId: string
  /** Provider's id for this collection. */
  providerRef: string
  idempotencyKey: string
  status: RailStatus
  amount: MinorAmount
  currency: RailCurrency
}

/** What a provider callback becomes once verified and normalised. Adapters produce it, the core consumes it. */
export type RailEvent =
  | {
      kind: "collection"
      providerRef: string
      idempotencyKey: string
      status: RailStatus
      amount: MinorAmount
      currency: RailCurrency
      at: Date
    }
  | {
      kind: "refund"
      providerRef: string
      refundRef: string
      status: RefundStatus
      amount: MinorAmount
      currency: RailCurrency
      at: Date
    }

export type WebhookInput = {
  rawBody: string
  headers: Record<string, string | undefined>
}

export type WebhookResult =
  | { ok: true; events: RailEvent[] }
  /** Signature invalid, unknown format, replay outside the tolerance window… → answer 4xx, change nothing. */
  | { ok: false; reason: string }

/**
 * The contract every provider adapter implements. Every method that calls the provider must be idempotent on
 * `idempotencyKey` / `refundKey` and must never throw for a business refusal (it returns a failed status instead).
 */
export interface PaymentRail {
  readonly id: string
  readonly capabilities: readonly RailCapability[]
  readonly fees: Partial<Record<RailMethod, RailFeeSchedule>>
  createCollection(request: CollectionRequest): Promise<CollectionIntent>
  getCollection(providerRef: string): Promise<CollectionIntent | null>
  refund(args: { providerRef: string; refundKey: string; amount: MinorAmount; currency: RailCurrency }): Promise<{
    refundRef: string
    status: RefundStatus
  }>
  /** Verify (signature, freshness) and normalise a callback. Pure with respect to the database. */
  parseWebhook(input: WebhookInput): Promise<WebhookResult>
}
