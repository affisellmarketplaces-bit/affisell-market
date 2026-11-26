/**
 * Provider-neutral payment logic — PURE (no I/O): money units, phone numbers, state machine, routing, fee estimate.
 * Everything a second provider would otherwise re-implement (and get subtly different) lives here once.
 */
import type {
  CollectionRequest,
  MinorAmount,
  PaymentRail,
  RailCapability,
  RailCountry,
  RailCurrency,
  RailFeeSchedule,
  RailStatus,
} from "@/lib/payment-rails/types"

// ─── Money ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Decimal places of the minor unit (ISO 4217). XOF/XAF: 0 — "1 500 FCFA" is 1500, never 150000. */
export const CURRENCY_EXPONENT: Record<RailCurrency, number> = { EUR: 2, XOF: 0, XAF: 0, GHS: 2, NGN: 2, KES: 2 }

export function isValidMinorAmount(amount: unknown): amount is MinorAmount {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0
}

/** Display helper — never used to compute. */
export function formatMinor(amount: MinorAmount, currency: RailCurrency, locale = "fr-FR"): string {
  const exp = CURRENCY_EXPONENT[currency]
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(amount / 10 ** exp)
}

/**
 * Fee ESTIMATE for a collection (rounded UP to the minor unit: an estimate must not flatter the margin).
 * The provider's settlement report is the truth; reconciliation compares against it.
 */
export function estimateRailFee(amount: MinorAmount, fees: RailFeeSchedule): { fee: MinorAmount; estimated: true } {
  const fee = Math.ceil((amount * fees.bps) / 10_000) + fees.fixed
  return { fee, estimated: true }
}

// ─── Phone numbers (Mobile Money) ────────────────────────────────────────────────────────────────────────────────

/**
 * National significant number length per country (E.164, digits after the country code). Only STRUCTURE is
 * checked: the operator is chosen by the buyer, never inferred from the prefix (numbers are portable).
 * Benin moved to 10-digit numbers (leading "01") in 2024; Senegal uses 9 digits.
 */
export const MSISDN_RULES: Record<string, { dial: string; length: number }> = {
  BJ: { dial: "229", length: 10 },
  SN: { dial: "221", length: 9 },
  CI: { dial: "225", length: 10 },
  TG: { dial: "228", length: 8 },
  BF: { dial: "226", length: 8 },
  ML: { dial: "223", length: 8 },
  NE: { dial: "227", length: 8 },
  CM: { dial: "237", length: 9 },
}

/** Returns "+<dial><number>" or null. Accepts spaces, dashes, a leading 00 or +, or the national form. */
export function normaliseMsisdn(input: string, country: RailCountry): string | null {
  const rule = MSISDN_RULES[country.toUpperCase()]
  if (!rule || typeof input !== "string") return null
  let digits = input.replace(/[\s.\-()]/g, "")
  if (!/^\+?\d+$/.test(digits)) return null
  digits = digits.replace(/^\+/, "").replace(/^00/, "")
  if (digits.startsWith(rule.dial) && digits.length === rule.dial.length + rule.length)
    digits = digits.slice(rule.dial.length)
  if (digits.length !== rule.length) return null
  return `+${rule.dial}${digits}`
}

// ─── State machine ───────────────────────────────────────────────────────────────────────────────────────────────

const TERMINAL: ReadonlySet<RailStatus> = new Set(["succeeded", "failed", "expired", "cancelled"])
const ALLOWED: Record<RailStatus, readonly RailStatus[]> = {
  created: ["pending", "succeeded", "failed", "expired", "cancelled"],
  pending: ["succeeded", "failed", "expired", "cancelled"],
  succeeded: [],
  failed: [],
  expired: [],
  cancelled: [],
}

export type TransitionResult =
  | { applied: true; status: RailStatus }
  /** Same status again (duplicate callback): nothing to do, answer 200. */
  | { applied: false; status: RailStatus; reason: "duplicate" }
  /**
   * A terminal state already reached and the provider now says something else (e.g. "failed" after "succeeded").
   * Never applied automatically: money may have moved — flag for a human, keep the recorded state.
   */
  | { applied: false; status: RailStatus; reason: "conflict_needs_review" }

/** Callbacks arrive late, twice, or out of order; the recorded state only moves forward. */
export function applyStatus(current: RailStatus, incoming: RailStatus): TransitionResult {
  if (current === incoming) return { applied: false, status: current, reason: "duplicate" }
  if (ALLOWED[current].includes(incoming)) return { applied: true, status: incoming }
  if (TERMINAL.has(current)) return { applied: false, status: current, reason: "conflict_needs_review" }
  // pending → created (an older callback arriving late): ignore, the state stays where it is.
  return { applied: false, status: current, reason: "duplicate" }
}

// ─── Routing ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type RouteRequest = Pick<CollectionRequest, "country" | "currency" | "method" | "amount" | "operator">

export type RouteCandidate = { rail: PaymentRail; capability: RailCapability; fee: MinorAmount | null }

export type RoutePolicy = {
  /** Rails switched off (incident, contract ended) — e.g. from an env variable, per country if needed. */
  disabled?: ReadonlySet<string>
  /** Preferred order by country (owner's commercial choice); unknown rails come after, by estimated fee. */
  preference?: Partial<Record<RailCountry, readonly string[]>>
}

function capabilityFor(rail: PaymentRail, req: RouteRequest): RailCapability | null {
  return (
    rail.capabilities.find(
      (c) =>
        c.country === req.country.toUpperCase() &&
        c.currency === req.currency &&
        c.method === req.method &&
        req.amount >= c.minAmount &&
        req.amount <= c.maxAmount &&
        (!req.operator || !c.operators || c.operators.includes(req.operator)),
    ) ?? null
  )
}

/**
 * Every rail able to take this payment, best first: owner's preference for the country, then lowest estimated fee,
 * then id. The first is the primary, the rest are fallbacks — no single provider is ever required by the core.
 */
export function routeCollection(
  req: RouteRequest,
  rails: readonly PaymentRail[],
  policy: RoutePolicy = {},
): RouteCandidate[] {
  if (!isValidMinorAmount(req.amount)) return []
  const pref = policy.preference?.[req.country.toUpperCase()] ?? []
  const rank = (id: string) => {
    const i = pref.indexOf(id)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return rails
    .filter((r) => !policy.disabled?.has(r.id))
    .flatMap((rail) => {
      const capability = capabilityFor(rail, req)
      if (!capability) return []
      const schedule = rail.fees[req.method]
      return [{ rail, capability, fee: schedule ? estimateRailFee(req.amount, schedule).fee : null }]
    })
    .sort(
      (a, b) =>
        rank(a.rail.id) - rank(b.rail.id) ||
        (a.fee ?? Number.MAX_SAFE_INTEGER) - (b.fee ?? Number.MAX_SAFE_INTEGER) ||
        a.rail.id.localeCompare(b.rail.id),
    )
}

/** Validate a collection request before it reaches any provider. Returns a language-neutral error code or null. */
export function validateCollection(req: CollectionRequest): string | null {
  if (!/^[A-Za-z0-9_:-]{6,64}$/.test(req.idempotencyKey)) return "invalid_idempotency_key"
  if (!isValidMinorAmount(req.amount)) return "invalid_amount"
  if (req.method === "mobile_money") {
    if (!req.msisdn || !normaliseMsisdn(req.msisdn, req.country)) return "invalid_msisdn"
  }
  if (!req.statementDescriptor.trim() || req.statementDescriptor.length > 22) return "invalid_descriptor"
  return null
}
