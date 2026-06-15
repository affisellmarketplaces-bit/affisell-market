import { describe, expect, it } from "vitest"

import { buildSuppressedWaitlistCsv } from "@/lib/admin/build-suppressed-waitlist-csv"
import { buildExpansionEmailExportsBundle } from "@/lib/admin/build-expansion-email-exports-bundle"
import {
  expansionEmailExportsBundleFilename,
  EXPANSION_EMAIL_EXPORT_KINDS,
} from "@/lib/admin/expansion-email-export-kinds"
import { hashExpansionBuyerEmail } from "@/lib/expansion/hash-expansion-buyer-email"

describe("buildSuppressedWaitlistCsv buyerEmailHash", () => {
  it("hashes buyer email instead of exporting raw address", () => {
    const csv = buildSuppressedWaitlistCsv([
      {
        email: "Buyer@Example.com",
        countryIso2: "jp",
        locale: "en",
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        launchEmailBouncedAt: new Date("2026-06-02T10:00:00.000Z"),
        launchEmailSuppressedAt: new Date("2026-06-03T10:00:00.000Z"),
        launchNotifiedAt: new Date("2026-06-01T12:00:00.000Z"),
      },
    ])
    const hash = hashExpansionBuyerEmail("buyer@example.com")
    expect(csv.startsWith("\uFEFFemailKind;buyerEmailHash;countryIso2")).toBe(true)
    expect(csv).toContain(hash)
    expect(csv).not.toContain("Buyer@Example.com")
  })
})

describe("EXPANSION_EMAIL_EXPORT_KINDS", () => {
  it("includes all expansion buyer email kinds", () => {
    expect(EXPANSION_EMAIL_EXPORT_KINDS).toEqual([
      "checkout-launch",
      "checkout-launch-followup",
      "checkout-graduated",
    ])
  })
})

describe("expansionEmailExportsBundleFilename", () => {
  it("supports optional country filter", () => {
    expect(expansionEmailExportsBundleFilename("jp")).toBe(
      "affisell-expansion-email-exports-jp-this-month.zip"
    )
  })
})

describe("buildExpansionEmailExportsBundle", () => {
  it("exports bundle builder function", () => {
    expect(typeof buildExpansionEmailExportsBundle).toBe("function")
  })
})
