import { describe, expect, it } from "vitest"

import { invoiceAddressLines, invoiceLabels, resolveInvoiceLocale } from "@/lib/invoices/invoice-labels"
import { renderOrderInvoicePdf, type OrderInvoiceData } from "@/lib/invoices/order-invoice-pdf"

const base: OrderInvoiceData = {
  orderId: "cmu9lmvmr000bjv04currhtg9",
  productName: "Caméra de voiture 3 canaux 4K",
  createdAt: "2026-09-20",
  supplierPayoutCents: 12000,
  affiliateEarningCents: 3000,
  totalCents: 28186,
  subtotalCents: 23488,
  taxCents: 4698,
  customerEmail: "buyer@example.com",
  quantity: 1,
  unitPriceCents: 28186,
  paidAt: "2026-09-20",
  buyerAddressLines: ["Jane Doe", "20 Rue de Cuques", "13100 Aix-en-Provence", "FR"],
  taxRatePercent: 20,
}

describe("customer invoice", () => {
  it("resolves the buyer locale, falling back to French", () => {
    expect(resolveInvoiceLocale("de-DE")).toBe("de")
    expect(resolveInvoiceLocale("zh")).toBe("fr")
    expect(resolveInvoiceLocale(null)).toBe("fr")
  })

  it("has a complete label set for every supported invoice locale", () => {
    for (const l of ["en", "fr", "de", "es", "it", "nl", "pl"] as const) {
      const labels = invoiceLabels(l)
      expect(Object.values(labels).every((v) => v.trim().length > 0)).toBe(true)
    }
  })

  it("builds the address block without empty lines", () => {
    expect(invoiceAddressLines({ name: "A", line1: "1 rue X", line2: "", city: "Aix", postal_code: "13100", country: "FR" })).toEqual([
      "A", "1 rue X", "13100 Aix", "FR",
    ])
    expect(invoiceAddressLines(null)).toEqual([])
  })

  it("renders a PDF in every locale, and the compact legacy layout", async () => {
    for (const locale of ["en", "fr", "de", "es", "it", "nl", "pl"] as const) {
      const pdf = await renderOrderInvoicePdf("CUSTOMER", { ...base, locale })
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF")
    }
    const legacy = await renderOrderInvoicePdf("CUSTOMER", {
      ...base, quantity: undefined, unitPriceCents: undefined, buyerAddressLines: undefined, paidAt: undefined,
    })
    expect(legacy.subarray(0, 4).toString()).toBe("%PDF")
    const supplier = await renderOrderInvoicePdf("SUPPLIER", { ...base, customerEmail: "" })
    expect(supplier.subarray(0, 4).toString()).toBe("%PDF")
  }, 60_000)
})
