import { renderToStaticMarkup } from "react-dom/server"
import { createTranslator } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import { loadAppMessages } from "@/lib/i18n-load-messages"

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "en", messages: loadAppMessages("en"), namespace, timeZone: "UTC" }),
}))

import { SupplierDeliveryPerformanceCard } from "@/components/supplier/mission-control/supplier-delivery-performance-card"
import type { SupplierDeliveryInsight } from "@/lib/supplier-delivery-stats.server"
import { compareDeclaredToMeasured } from "@/lib/supplier-delivery-stats-shared"

const proven = { sampleSize: 42, medianEndToEndDays: 6, p90EndToEndDays: 9, medianDispatchDays: 1 }

function insight(overrides: Partial<SupplierDeliveryInsight>): SupplierDeliveryInsight {
  return {
    proven,
    measuredOrders: 42,
    minForProven: 10,
    windowDays: 180,
    declared: null,
    comparison: null,
    ...overrides,
  }
}

async function html(i: SupplierDeliveryInsight): Promise<string> {
  return renderToStaticMarkup(await SupplierDeliveryPerformanceCard({ insight: i }))
}

describe("SupplierDeliveryPerformanceCard", () => {
  it("shows measured dispatch / median / p90 days and the basis", async () => {
    const out = await html(insight({}))
    expect(out).toContain("Median dispatch")
    expect(out).toContain("Median delivery")
    expect(out).toContain("9 in 10 orders within")
    expect(out).toContain("1 d")
    expect(out).toContain("6 d")
    expect(out).toContain("9 d")
    expect(out).toContain("Based on your 42 latest carrier-tracked deliveries (last 180 days)")
  })

  it("warns when the listings promise less than buyers actually get", async () => {
    const declared = { processingDays: 1, deliveryMaxDays: 5, totalDays: 6 }
    const out = await html(insight({ declared, comparison: compareDeclaredToMeasured(declared, proven) }))
    expect(out).toContain('role="status"')
    expect(out).toContain("Your listings promise 6 days (processing + max transit), but 9 in 10 orders take up to 9.")
  })

  it("confirms an honest promise", async () => {
    const declared = { processingDays: 3, deliveryMaxDays: 7, totalDays: 10 }
    const out = await html(insight({ declared, comparison: compareDeclaredToMeasured(declared, proven) }))
    expect(out).toContain("match what buyers actually get")
    expect(out).not.toContain('role="status"')
  })

  it("explains how close the supplier is to being measured", async () => {
    const out = await html(insight({ proven: null, measuredOrders: 4 }))
    expect(out).toContain("(4/10)")
    expect(out).not.toContain("Median delivery")
  })
})
