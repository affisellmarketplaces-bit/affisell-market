import { createHmac, timingSafeEqual } from "node:crypto"

import { applyStatus, isValidMinorAmount, matchCapability, validateCollection } from "@/lib/payment-rails/core"
import type {
  CollectionIntent,
  CollectionRequest,
  PaymentRail,
  RailCapability,
  RailEvent,
  RailFeeSchedule,
  RailMethod,
  RailStatus,
  RefundStatus,
  WebhookInput,
  WebhookResult,
} from "@/lib/payment-rails/types"

/**
 * In-memory rail that behaves like a Mobile Money aggregator — asynchronous confirmation on the buyer's phone,
 * signed callbacks, duplicates, late and out-of-order deliveries — WITHOUT any provider account, contract or network.
 * It is the test double every real adapter must match (`payment-rails.test.ts` runs the same contract tests on it),
 * and the way to develop the checkout flow before a provider is chosen. Never registered in production.
 */
export const SIMULATED_RAIL_ID = "simulated"
const SIGNATURE_HEADER = "x-rail-signature"
const TIMESTAMP_HEADER = "x-rail-timestamp"
/** Callbacks older than this are refused (replay protection). */
export const WEBHOOK_TOLERANCE_MS = 5 * 60_000

type Stored = CollectionIntent & { refunded: number }

export function signSimulatedWebhook(secret: string, rawBody: string, timestampMs: number): string {
  return createHmac("sha256", secret).update(`${timestampMs}.${rawBody}`).digest("hex")
}

export function createSimulatedRail(options: {
  webhookSecret: string
  capabilities?: readonly RailCapability[]
  fees?: Partial<Record<RailMethod, RailFeeSchedule>>
  now?: () => number
}): PaymentRail & {
  /** Test/dev control: the buyer approves or rejects on their phone. Returns the signed callback to deliver. */
  settle(providerRef: string, status: RailStatus): WebhookInput
} {
  const now = options.now ?? (() => Date.now())
  const byRef = new Map<string, Stored>()
  const byKey = new Map<string, string>()
  const refunds = new Map<string, { refundRef: string; status: RefundStatus }>()
  let seq = 0

  const capabilities: readonly RailCapability[] = options.capabilities ?? [
    {
      country: "BJ",
      currency: "XOF",
      method: "mobile_money",
      minAmount: 100,
      maxAmount: 2_000_000,
      operators: ["MTN", "MOOV"],
      canRefund: true,
      canPayout: true,
    },
    {
      country: "SN",
      currency: "XOF",
      method: "mobile_money",
      minAmount: 100,
      maxAmount: 2_000_000,
      operators: ["ORANGE", "FREE", "WAVE"],
      canRefund: true,
      canPayout: true,
    },
  ]

  function signed(event: RailEvent): WebhookInput {
    const rawBody = JSON.stringify({ ...event, at: event.at.toISOString() })
    const ts = now()
    return {
      rawBody,
      headers: {
        [SIGNATURE_HEADER]: signSimulatedWebhook(options.webhookSecret, rawBody, ts),
        [TIMESTAMP_HEADER]: String(ts),
      },
    }
  }

  return {
    id: SIMULATED_RAIL_ID,
    capabilities,
    fees: options.fees ?? { mobile_money: { bps: 100, fixed: 0, settlementDays: 2 } },

    async createCollection(request: CollectionRequest): Promise<CollectionIntent> {
      // A real provider refuses what its contract does not cover; the double must too, or checkout tests lie.
      const invalid = validateCollection(request) ?? (matchCapability(capabilities, request) ? null : "not_supported")
      const existing = byKey.get(request.idempotencyKey)
      if (existing) {
        // Idempotent: same key → same collection, no second charge.
        const { refunded: _r, ...out } = byRef.get(existing)!
        return out
      }
      const providerRef = `sim_${String(++seq).padStart(8, "0")}`
      const intent: Stored = {
        railId: SIMULATED_RAIL_ID,
        providerRef,
        idempotencyKey: request.idempotencyKey,
        status: invalid ? "failed" : "pending",
        amount: request.amount,
        currency: request.currency,
        refunded: 0,
      }
      byRef.set(providerRef, intent)
      byKey.set(request.idempotencyKey, providerRef)
      const { refunded: _r, ...out } = intent
      return out
    },

    async getCollection(providerRef: string) {
      const s = byRef.get(providerRef)
      if (!s) return null
      const { refunded: _r, ...out } = s
      return out
    },

    async refund({ providerRef, refundKey, amount, currency }) {
      const previous = refunds.get(refundKey)
      if (previous) return previous
      const s = byRef.get(providerRef)
      const ok =
        !!s &&
        s.status === "succeeded" &&
        currency === s.currency &&
        isValidMinorAmount(amount) &&
        s.refunded + amount <= s.amount
      const result = {
        refundRef: `simre_${String(++seq).padStart(8, "0")}`,
        status: (ok ? "pending" : "failed") as RefundStatus,
      }
      if (ok) s!.refunded += amount
      refunds.set(refundKey, result)
      return result
    },

    async parseWebhook({ rawBody, headers }: WebhookInput): Promise<WebhookResult> {
      const sig = headers[SIGNATURE_HEADER]
      const ts = Number(headers[TIMESTAMP_HEADER])
      if (!sig || !Number.isFinite(ts)) return { ok: false, reason: "missing_signature" }
      if (Math.abs(now() - ts) > WEBHOOK_TOLERANCE_MS) return { ok: false, reason: "stale_timestamp" }
      const expected = Buffer.from(signSimulatedWebhook(options.webhookSecret, rawBody, ts), "hex")
      const given = Buffer.from(sig, "hex")
      if (given.length !== expected.length || !timingSafeEqual(given, expected))
        return { ok: false, reason: "bad_signature" }
      try {
        const parsed = JSON.parse(rawBody) as RailEvent & { at: string }
        return { ok: true, events: [{ ...parsed, at: new Date(parsed.at) } as RailEvent] }
      } catch {
        return { ok: false, reason: "malformed_body" }
      }
    },

    settle(providerRef: string, status: RailStatus): WebhookInput {
      const s = byRef.get(providerRef)
      if (!s) throw new Error(`unknown collection ${providerRef}`)
      const t = applyStatus(s.status, status)
      if (t.applied) s.status = t.status
      return signed({
        kind: "collection",
        providerRef,
        idempotencyKey: s.idempotencyKey,
        status,
        amount: s.amount,
        currency: s.currency,
        at: new Date(now()),
      })
    },
  }
}
