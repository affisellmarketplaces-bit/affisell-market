import { describe, expect, it } from "vitest"

import { formatInvoiceNumber, issuerCode, PLATFORM_ISSUER_KEY } from "@/lib/invoices/invoice-number"

describe("invoice number format", () => {
  it("is year, issuer code and a zero-padded sequence", () => {
    expect(formatInvoiceNumber("cmpa60qgm0000l704xkip3qc9", 2026, 1)).toBe("2026-IP3QC9-000001")
    expect(formatInvoiceNumber(PLATFORM_ISSUER_KEY, 2026, 12345)).toBe("2026-AFF-012345")
  })

  it("never yields a sequence below 1 or a non-integer", () => {
    expect(formatInvoiceNumber(PLATFORM_ISSUER_KEY, 2026, 0)).toBe("2026-AFF-000001")
    expect(formatInvoiceNumber(PLATFORM_ISSUER_KEY, 2026, 7.9)).toBe("2026-AFF-000007")
  })

  it("keeps two different issuers apart", () => {
    expect(issuerCode("cmaaaaaaaaaaaaaaaaaaaaaaa")).not.toBe(issuerCode("cmbbbbbbbbbbbbbbbbbbbbbbb"))
  })
})
