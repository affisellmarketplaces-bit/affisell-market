import { describe, expect, it } from "vitest"

import {
  applyStatus,
  estimateRailFee,
  formatMinor,
  normaliseMsisdn,
  routeCollection,
  validateCollection,
} from "@/lib/payment-rails/core"
import { createSimulatedRail, WEBHOOK_TOLERANCE_MS } from "@/lib/payment-rails/simulated-rail"
import type { CollectionRequest, PaymentRail, RailStatus } from "@/lib/payment-rails/types"

const SECRET = "test-webhook-secret-not-real"

describe("money units", () => {
  it("XOF has no minor unit; EUR has cents", () => {
    expect(formatMinor(1500, "XOF", "fr-FR").replace(/\s/g, " ")).toMatch(/^1 500\s?F\s?CFA$/)
    expect(formatMinor(1500, "EUR", "fr-FR").replace(/\s/g, " ")).toMatch(/^15,00 €$/)
  })

  it("fee estimates round UP (an estimate never flatters the margin)", () => {
    expect(estimateRailFee(1501, { bps: 100, fixed: 0, settlementDays: 2 })).toEqual({ fee: 16, estimated: true })
    expect(estimateRailFee(10_000, { bps: 195, fixed: 50, settlementDays: 1 }).fee).toBe(245)
  })
})

describe("phone numbers", () => {
  it("normalises Benin (10 digits since 2024) and Senegal (9 digits) in every common form", () => {
    for (const raw of ["01 97 12 34 56", "+229 01 97 12 34 56", "0022901971234 56", "2290197123456"]) {
      expect(normaliseMsisdn(raw, "BJ"), raw).toBe("+2290197123456")
    }
    expect(normaliseMsisdn("77 123 45 67", "SN")).toBe("+221771234567")
    expect(normaliseMsisdn("+221 77-123-45-67", "sn")).toBe("+221771234567")
  })

  it("refuses wrong lengths, letters, unknown countries (the old 8-digit Benin format included)", () => {
    expect(normaliseMsisdn("97 12 34 56", "BJ")).toBeNull()
    expect(normaliseMsisdn("77 12A 45 67", "SN")).toBeNull()
    expect(normaliseMsisdn("0197123456", "FR")).toBeNull()
  })
})

describe("state machine (callbacks late, twice, out of order)", () => {
  it("moves forward only", () => {
    expect(applyStatus("created", "pending")).toEqual({ applied: true, status: "pending" })
    expect(applyStatus("pending", "succeeded")).toEqual({ applied: true, status: "succeeded" })
    expect(applyStatus("succeeded", "succeeded")).toMatchObject({ applied: false, reason: "duplicate" })
    expect(applyStatus("pending", "created")).toMatchObject({ applied: false, status: "pending" })
  })

  it("a contradiction after a terminal state is never applied: a human reviews it", () => {
    for (const late of ["failed", "expired", "pending"] as RailStatus[]) {
      expect(applyStatus("succeeded", late)).toEqual({
        applied: false,
        status: "succeeded",
        reason: "conflict_needs_review",
      })
    }
  })
})

describe("routing (no single provider required)", () => {
  const railA = createSimulatedRail({ webhookSecret: SECRET })
  const railB: PaymentRail = {
    ...createSimulatedRail({
      webhookSecret: SECRET,
      fees: { mobile_money: { bps: 150, fixed: 0, settlementDays: 1 } },
    }),
    id: "other",
  }
  const req = { country: "BJ", currency: "XOF" as const, method: "mobile_money" as const, amount: 25_000 }

  it("orders candidates by estimated fee, then honours the owner's preference per country", () => {
    expect(routeCollection(req, [railB, railA]).map((c) => c.rail.id)).toEqual(["simulated", "other"])
    expect(routeCollection(req, [railA, railB], { preference: { BJ: ["other"] } }).map((c) => c.rail.id)).toEqual([
      "other",
      "simulated",
    ])
  })

  it("a disabled rail falls back to the next; nothing fits → no candidate (the UI hides the method)", () => {
    expect(routeCollection(req, [railA, railB], { disabled: new Set(["simulated"]) }).map((c) => c.rail.id)).toEqual([
      "other",
    ])
    expect(routeCollection({ ...req, country: "FR" }, [railA, railB])).toEqual([])
    expect(routeCollection({ ...req, amount: 50 }, [railA])).toEqual([]) // below the provider minimum
    expect(routeCollection({ ...req, operator: "ORANGE" }, [railA])).toEqual([]) // not a Benin operator here
    expect(routeCollection({ ...req, amount: 12.5 }, [railA])).toEqual([]) // never a float
  })
})

describe("simulated rail — the contract every real adapter must satisfy", () => {
  const base: CollectionRequest = {
    idempotencyKey: "ord_000001",
    country: "BJ",
    currency: "XOF",
    method: "mobile_money",
    amount: 25_000,
    msisdn: "01 97 12 34 56",
    operator: "MTN",
    statementDescriptor: "AFFISELL",
  }

  it("validation codes are language-neutral and checked before any provider call", () => {
    expect(validateCollection(base)).toBeNull()
    expect(validateCollection({ ...base, msisdn: "123" })).toBe("invalid_msisdn")
    expect(validateCollection({ ...base, idempotencyKey: "x" })).toBe("invalid_idempotency_key")
    expect(validateCollection({ ...base, statementDescriptor: "A".repeat(23) })).toBe("invalid_descriptor")
  })

  it("same idempotency key = same collection, never a second charge", async () => {
    const rail = createSimulatedRail({ webhookSecret: SECRET })
    const a = await rail.createCollection(base)
    const b = await rail.createCollection({ ...base, amount: 99_999 })
    expect(b).toEqual(a)
    expect(a.status).toBe("pending")
  })

  it("signed callbacks are verified; tampered, unsigned and replayed ones are refused", async () => {
    let clock = 1_800_000_000_000
    const rail = createSimulatedRail({ webhookSecret: SECRET, now: () => clock })
    const intent = await rail.createCollection(base)
    const hook = rail.settle(intent.providerRef, "succeeded")
    const ok = await rail.parseWebhook(hook)
    expect(ok.ok && ok.events[0]).toMatchObject({ kind: "collection", status: "succeeded", amount: 25_000 })
    expect(await rail.parseWebhook({ ...hook, rawBody: hook.rawBody.replace("25000", "250") })).toEqual({
      ok: false,
      reason: "bad_signature",
    })
    expect(await rail.parseWebhook({ rawBody: hook.rawBody, headers: {} })).toEqual({
      ok: false,
      reason: "missing_signature",
    })
    clock += WEBHOOK_TOLERANCE_MS + 1
    expect(await rail.parseWebhook(hook)).toEqual({ ok: false, reason: "stale_timestamp" })
  })

  it("refunds: only on a succeeded collection, never above what was paid, idempotent on the refund key", async () => {
    const rail = createSimulatedRail({ webhookSecret: SECRET })
    const intent = await rail.createCollection(base)
    expect(
      (await rail.refund({ providerRef: intent.providerRef, refundKey: "rf_000001", amount: 1_000, currency: "XOF" }))
        .status,
    ).toBe("failed")
    rail.settle(intent.providerRef, "succeeded")
    const r1 = await rail.refund({
      providerRef: intent.providerRef,
      refundKey: "rf_000002",
      amount: 20_000,
      currency: "XOF",
    })
    expect(r1.status).toBe("pending")
    expect(
      await rail.refund({ providerRef: intent.providerRef, refundKey: "rf_000002", amount: 20_000, currency: "XOF" }),
    ).toEqual(r1)
    expect(
      (await rail.refund({ providerRef: intent.providerRef, refundKey: "rf_000003", amount: 5_001, currency: "XOF" }))
        .status,
    ).toBe("failed")
  })

  it("an invalid request becomes a failed collection, not an exception", async () => {
    const rail = createSimulatedRail({ webhookSecret: SECRET })
    expect((await rail.createCollection({ ...base, idempotencyKey: "ord_000009", msisdn: "12" })).status).toBe("failed")
  })
})
