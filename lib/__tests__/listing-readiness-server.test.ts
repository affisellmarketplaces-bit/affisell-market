import { afterEach, describe, expect, it, vi } from "vitest"

import { applyListingReadinessGate } from "@/lib/listing-compliance/gate.server"
import { GPSR_KEYS, IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { BULK_COMPLIANCE_COLUMNS, BULK_FIXED_COLUMNS, validateAndParseBulkRow } from "@/lib/supplier-bulk-excel"

const COMPLETE = {
  [GPSR_KEYS.manufacturerName]: "Atelier Dupont SAS",
  [GPSR_KEYS.manufacturerAddress]: "12 rue des Lilas, 75011 Paris",
  [GPSR_KEYS.manufacturerEmail]: "contact@dupont.fr",
  [GPSR_KEYS.manufacturerCountry]: "FR",
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("applyListingReadinessGate", () => {
  const base = { source: "api_create" as const, supplierId: "sup_1", listingKind: "PHYSICAL", attributes: [], context: "new_publication" as const }

  it("enforce: refuses a new publication with a 422 listing_not_ready body (codes only)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const out = applyListingReadinessGate({ ...base, mode: "enforce" })
    expect(out.blockResponse?.status).toBe(422)
    const body = await out.blockResponse!.json()
    expect(body.error).toBe("listing_not_ready")
    expect(body.issues.map((i: { code: string }) => i.code)).toContain("gpsr_manufacturer_name_missing")
    expect(log).toHaveBeenCalledWith("[listing-readiness]", expect.objectContaining({ result: "refused", source: "api_create" }))
  })

  it("warn (the default): never refuses, and logs that it WOULD have", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const out = applyListingReadinessGate({ ...base, mode: "warn" })
    expect(out.blockResponse).toBeNull()
    expect(log).toHaveBeenCalledWith("[listing-readiness]", expect.objectContaining({ result: "would_refuse_if_enforced" }))
  })

  it("defaults to warn when LISTING_READINESS_MODE is unset", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.stubEnv("LISTING_READINESS_MODE", "")
    expect(applyListingReadinessGate(base).blockResponse).toBeNull()
  })

  it("LISTING_READINESS_MODE=enforce is read per call (the kill switch needs no code change)", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    expect(applyListingReadinessGate(base).blockResponse?.status).toBe(422)
    vi.stubEnv("LISTING_READINESS_MODE", "off")
    expect(applyListingReadinessGate(base).blockResponse).toBeNull()
  })

  it("a live edit is observed, never refused — even in enforce mode — and not logged", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const out = applyListingReadinessGate({ ...base, context: "live_edit", mode: "enforce" })
    expect(out.blockResponse).toBeNull()
    expect(log).not.toHaveBeenCalled()
  })

  it("a complete listing passes in enforce mode without a log line", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const out = applyListingReadinessGate({
      ...base,
      mode: "enforce",
      attributes: { ...COMPLETE, [IDENTITY_KEYS.brand]: "Acme", [IDENTITY_KEYS.gtinExempt]: "1" },
    })
    expect(out.blockResponse).toBeNull()
    expect(log).not.toHaveBeenCalled()
  })

  it("never blocks digital goods", () => {
    expect(applyListingReadinessGate({ ...base, listingKind: "SERVICE", mode: "enforce" }).blockResponse).toBeNull()
  })

  it("never throws: an evaluation bug must not take publishing down", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const poison = new Proxy({}, { ownKeys() { throw new Error("boom") } })
    const out = applyListingReadinessGate({ ...base, attributes: poison as never, mode: "enforce" })
    expect(out.blockResponse).toBeNull()
  })
})

describe("bulk import: compliance columns", () => {
  const row = { name: "Lampe", price_eur: "19.90", images: "https://cdn.example.com/a.jpg" }

  it("exposes the optional columns in the template, after the existing ones (old templates keep working)", () => {
    const keys = BULK_FIXED_COLUMNS.map((c) => c.key)
    expect(keys.slice(0, 13)).toEqual([
      "name", "description", "price_eur", "compare_at_eur", "stock", "commission_pct", "listing_kind", "images",
      "shipping_country", "warehouse_type", "processing_time", "delivery_min", "delivery_max",
    ])
    // Buyers are never charged shipping: the template no longer offers a column for it.
    expect(keys).not.toContain("shipping_cost_eur")
    for (const c of BULK_COMPLIANCE_COLUMNS) expect(keys).toContain(c.column)
  })

  it("an old-template row (no compliance columns) still parses — with a heads-up, not an error", () => {
    const r = validateAndParseBulkRow(2, row, [])
    expect(r.errors).toEqual([])
    expect(r.data).not.toBeNull()
    expect(r.warnings.some((w) => /manufacturer/i.test(w))).toBe(true)
  })

  it("a legacy shipping_cost_eur value is never stored, and the supplier is told why (zero stays silent)", () => {
    const r = validateAndParseBulkRow(2, { ...row, shipping_cost_eur: "4,90" }, [])
    expect(r.errors).toEqual([])
    expect(r.data!.shippingBody).not.toHaveProperty("shippingCostEUR")
    expect(r.warnings.some((w) => /shipping_cost_eur/.test(w))).toBe(true)
    const zero = validateAndParseBulkRow(2, { ...row, shipping_cost_eur: "0" }, [])
    expect(zero.warnings.some((w) => /shipping_cost_eur/.test(w))).toBe(false)
  })

  it("maps the columns to the reserved attribute keys (GTIN digits only, country upper-cased)", () => {
    const r = validateAndParseBulkRow(
      2,
      {
        ...row,
        gtin: "400-6381-333931",
        manufacturer_name: "Atelier Dupont SAS",
        manufacturer_address: "12 rue des Lilas, 75011 Paris",
        manufacturer_email: "contact@dupont.fr",
        manufacturer_country: "fr",
      },
      []
    )
    expect(r.errors).toEqual([])
    const byKey = Object.fromEntries(r.data!.productAttributes.map((a) => [a.key, a.value]))
    expect(byKey[IDENTITY_KEYS.gtin]).toBe("4006381333931")
    expect(byKey[GPSR_KEYS.manufacturerCountry]).toBe("FR")
    expect(byKey[GPSR_KEYS.manufacturerName]).toBe("Atelier Dupont SAS")
    expect(r.warnings.some((w) => /manufacturer|fabricant/i.test(w))).toBe(false)
  })

  it("a category attribute column wins over the generic column for the same key", () => {
    const r = validateAndParseBulkRow(
      2,
      { ...row, attr__ean: "4006381333931", gtin: "96385074" },
      [{ key: "ean", label: "EAN", type: "TEXT", unit: null, options: [], required: false }]
    )
    expect(r.data!.productAttributes.filter((a) => a.key === "ean")).toEqual([{ key: "ean", label: "EAN", value: "4006381333931" }])
  })

  it("digital rows get no safety heads-up", () => {
    const r = validateAndParseBulkRow(2, { ...row, listing_kind: "SOFTWARE" }, [])
    expect(r.warnings.some((w) => /manufacturer/i.test(w))).toBe(false)
  })

  it("no heads-up when the rollout switch is off", () => {
    vi.stubEnv("LISTING_READINESS_MODE", "off")
    expect(validateAndParseBulkRow(2, row, []).warnings.some((w) => /manufacturer/i.test(w))).toBe(false)
  })
})

describe("quick-upload endpoint (a live physical product with no way to declare the manufacturer)", () => {
  it("is observed in warn mode and refused in enforce mode, before anything is uploaded", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const base = { source: "api_upload" as const, supplierId: "sup_1", listingKind: "PHYSICAL", attributes: [], context: "new_publication" as const }
    expect(applyListingReadinessGate({ ...base, mode: "warn" }).blockResponse).toBeNull()
    const refused = applyListingReadinessGate({ ...base, mode: "enforce" })
    expect(refused.blockResponse?.status).toBe(422)
    expect((await refused.blockResponse!.json()).error).toBe("listing_not_ready")
  })
})
