import { describe, expect, it } from "vitest"

import { precheckChinaBuyRoute } from "@/lib/china-buying/china-buy-qc-gate"

const BASE = {
  autoFulfill: true,
  autoBuyEnabled: true,
  agentId: "superbuy",
  sourceUrl: "https://detail.1688.com/offer/123.html",
  hasPassedQcInspection: true,
} as const

describe("precheckChinaBuyRoute", () => {
  it("allows when QC passed and config valid", () => {
    expect(precheckChinaBuyRoute(BASE)).toEqual({ ok: true })
  })

  it("blocks without passed QC inspection", () => {
    expect(
      precheckChinaBuyRoute({ ...BASE, hasPassedQcInspection: false })
    ).toEqual({ ok: false, reason: "qc_required" })
  })

  it("blocks when auto-buy disabled", () => {
    expect(precheckChinaBuyRoute({ ...BASE, autoBuyEnabled: false })).toEqual({
      ok: false,
      reason: "auto_buy_off",
    })
  })

  it("blocks invalid source url", () => {
    expect(precheckChinaBuyRoute({ ...BASE, sourceUrl: "not-a-url" })).toEqual({
      ok: false,
      reason: "invalid_url",
    })
  })
})
