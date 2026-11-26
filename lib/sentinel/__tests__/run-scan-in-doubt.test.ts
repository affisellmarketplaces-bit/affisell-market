/**
 * Wiring: the existing `sentinel-scan` cron (runSentinelScan) runs the purchase-in-doubt collector and pushes a NEW P0 to the ops
 * webhook. No new cron route is involved (see lib/__tests__/cron-schedule-coverage.test.ts).
 */
import { describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ upserts: [] as Array<{ create: { code: string; severity: string } }>, ops: [] as string[] }))

const none = vi.hoisted(() => async () => [])
vi.mock("@/lib/sentinel/collectors/catalog-health", () => ({ collectCatalogHealthSignals: none }))
vi.mock("@/lib/sentinel/collectors/fulfillment-failed", () => ({ collectFulfillmentFailedSignals: none }))
vi.mock("@/lib/sentinel/collectors/i18n-parity", () => ({ collectI18nParitySignals: none }))
vi.mock("@/lib/sentinel/collectors/provider-errors", () => ({ collectProviderErrorSignals: none }))
vi.mock("@/lib/sentinel/collectors/sentry-issues", () => ({ collectSentryIssueSignals: none }))
vi.mock("@/lib/sentinel/collectors/stripe-stuck", () => ({ collectStripeStuckSignals: none }))
vi.mock("@/lib/sentinel/collectors/webhook-errors", () => ({ collectWebhookErrorSignals: none }))
vi.mock("@/lib/sentinel/collectors/purchase-in-doubt", () => ({
  collectPurchaseInDoubtSignals: async () => [
    {
      severity: "P0",
      domain: "fulfillment",
      code: "fulfillment.purchase_in_doubt",
      title: "AliExpress purchase in doubt — order o1",
      detail: "...",
      entityType: "order",
      entityId: "o1",
      playbook: "open-order",
    },
  ],
}))
vi.mock("@/lib/sentinel/trend-7d", () => ({ saveSentinelScanSnapshot: async () => undefined }))
vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: async (t: string) => {
    h.ops.push(t)
    return { slack: true, discord: false }
  },
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    opsSignal: {
      findMany: async () => [],
      upsert: async (a: { create: { code: string; severity: string } }) => void h.upserts.push(a),
      updateMany: async () => ({ count: 0 }),
      count: async () => 1,
      groupBy: async () => [{ severity: "P0", _count: { _all: 1 } }],
    },
  },
}))

import { runSentinelScan } from "@/lib/sentinel/run-scan"

describe("runSentinelScan", () => {
  it("records the in-doubt purchase as a P0 and alerts the ops channel about the NEW P0", async () => {
    const result = await runSentinelScan()
    expect(h.upserts.map((u) => u.create.code)).toEqual(["fulfillment.purchase_in_doubt"])
    expect(result.newP0).toBe(1)
    await Promise.resolve() // the alert is fire-and-forget
    expect(h.ops).toHaveLength(1)
    expect(h.ops[0]).toContain("purchase in doubt")
  })
})
