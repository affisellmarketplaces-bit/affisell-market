import { describe, expect, it } from "vitest"

import { EU_MEMBER_ISO2 } from "@/lib/eu-market-countries"
import { EU_STANDARD_VAT_RATES, euStandardVatRows } from "@/lib/eu-standard-vat-rates"
import { supplierBecomeFinanceFacts } from "@/lib/supplier-become-page-finance"

describe("eu-standard-vat-rates", () => {
  it("covers all 27 EU member states", () => {
    expect(Object.keys(EU_STANDARD_VAT_RATES)).toHaveLength(27)
    for (const code of EU_MEMBER_ISO2) {
      expect(EU_STANDARD_VAT_RATES[code]).toBeGreaterThan(0)
    }
  })

  it("returns sorted rows with country labels", () => {
    const rows = euStandardVatRows("fr")
    expect(rows).toHaveLength(27)
    expect(rows.find((r) => r.code === "DE")?.rate).toBe(19)
    expect(rows.find((r) => r.code === "DE")?.country).toBeTruthy()
  })
})

describe("supplier-become-page-finance", () => {
  it("aligns payout days with order policy", () => {
    expect(supplierBecomeFinanceFacts.payoutDaysAfterDelivery).toBe(7)
  })

  it("uses DAC7 EU thresholds", () => {
    expect(supplierBecomeFinanceFacts.dac7EurThreshold).toBe(2000)
    expect(supplierBecomeFinanceFacts.dac7TxThreshold).toBe(30)
  })
})
