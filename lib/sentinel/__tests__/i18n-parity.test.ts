import { describe, expect, it } from "vitest"

import { collectI18nParitySignals } from "@/lib/sentinel/collectors/i18n-parity"
import { sentinelSignalId } from "@/lib/sentinel/signal-id"

describe("sentinelSignalId", () => {
  it("is stable for same code and entity", () => {
    const a = sentinelSignalId({ code: "stripe.settlement_stuck", entityId: "ord_1" })
    const b = sentinelSignalId({ code: "stripe.settlement_stuck", entityId: "ord_1" })
    expect(a).toBe(b)
  })

  it("differs when entity changes", () => {
    const a = sentinelSignalId({ code: "stripe.settlement_stuck", entityId: "ord_1" })
    const b = sentinelSignalId({ code: "stripe.settlement_stuck", entityId: "ord_2" })
    expect(a).not.toBe(b)
  })
})

describe("collectI18nParitySignals", () => {
  it("returns empty when en/fr keys match", () => {
    expect(collectI18nParitySignals()).toEqual([])
  })
})
