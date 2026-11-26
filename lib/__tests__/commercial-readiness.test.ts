/**
 * Commercial readiness (portfolio row 31): a blocker only where a real rule refuses (publication) or the product can
 * not be bought (sale); priorities are real risks; recommendations are optional; ONE next fix by dependencies.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { assessCommercialReadiness, pickNextFix, type ReadinessFinding } from "@/lib/commercial-readiness/readiness"

const GPSR_OK = [
  { key: "gpsr_manufacturer_name", value: "Lumo SAS" },
  { key: "gpsr_manufacturer_address", value: "1 rue de Lyon, 13001 Marseille" },
  { key: "gpsr_manufacturer_email", value: "contact@lumo.fr" },
  { key: "gpsr_manufacturer_country", value: "FR" },
]

const ready = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: "Lampe de bureau LED pliable aluminium",
  description: "<p>" + "Lampe LED pliable, trois intensités, port USB-C, bras orientable. ".repeat(4) + "</p>",
  price: 39.9,
  stock: 25,
  categoryId: "cat-leaf",
  images: ["https://cdn.affisell.com/a.jpg", "https://cdn.affisell.com/b.jpg", "https://cdn.affisell.com/c.jpg", "https://cdn.affisell.com/d.jpg", "https://cdn.affisell.com/e.jpg"],
  listingKind: "PHYSICAL",
  commission: 15,
  warehouseType: "local",
  deliveryCountryCodes: ["FR", "BE"],
  deliveryMin: 2,
  deliveryMax: 4,
  productAttributes: [
    ...GPSR_OK,
    { key: "brand", value: "Lumo" },
    { key: "ean", value: "4006381333931" },
    { key: "matiere", value: "Aluminium" },
    { key: "puissance", value: "8 W" },
    { key: "couleur", value: "Noir" },
    { key: "return_window_days", value: "30" },
  ],
  ...over,
})

const codes = (r: { findings: ReadinessFinding[] }) => r.findings.map((f) => f.code)

describe("verdict", () => {
  it("a complete sheet is « prêt »", () => {
    const r = assessCommercialReadiness(ready(), { listingReadinessMode: "warn", supplierFeeBps: 1000 })
    expect(r.verdict).toBe("pret")
    expect(r.counts.bloquant + r.counts.prioritaire).toBe(0)
  })
  it("recommendations left never prevent « prêt »", () => {
    const r = assessCommercialReadiness(ready({ images: ["https://cdn.affisell.com/a.jpg"] }), { listingReadinessMode: "warn" })
    expect(r.verdict).toBe("pret")
    expect(codes(r)).toContain("quality_photos_3plus")
  })
})

describe("blockers come only from real rules", () => {
  it("each server refusal of POST /api/supplier/products is a publication blocker", () => {
    const r = assessCommercialReadiness(
      ready({ name: " ", categoryId: "", price: 0, images: ["blob:local"], warehouseType: "", deliveryCountryCodes: [], commission: 0 }),
      { listingReadinessMode: "warn" },
    )
    for (const c of ["name_missing", "category_missing", "price_missing", "photo_missing", "warehouse_missing", "delivery_countries_missing", "commission_not_explicit"]) {
      expect(r.findings.find((f) => f.code === c), c).toMatchObject({ level: "bloquant", prevents: "publication", basis: "server_refusal" })
    }
    expect(r.verdict).toBe("bloquant")
  })
  it("no quantity = published but not buyable (blocks the SALE, not the publication)", () => {
    const f = assessCommercialReadiness(ready({ stock: 0 }), { listingReadinessMode: "warn" }).findings.find((x) => x.code === "stock_missing")
    expect(f).toMatchObject({ level: "bloquant", prevents: "sale", basis: "not_buyable" })
  })
  it("a non-physical product never needs a quantity, a warehouse rule still applies as the server says", () => {
    const r = assessCommercialReadiness(ready({ listingKind: "SOFTWARE", stock: 0 }), { listingReadinessMode: "enforce" })
    expect(codes(r)).not.toContain("stock_missing")
    expect(codes(r)).not.toContain("safety_incomplete")
  })
  it("safety data: blocker ONLY in enforce, otherwise a priority; unknown mode never blocks", () => {
    const body = ready({ productAttributes: [{ key: "brand", value: "Lumo" }] })
    expect(assessCommercialReadiness(body, { listingReadinessMode: "enforce" }).findings.find((f) => f.code === "safety_incomplete")).toMatchObject({ level: "bloquant", prevents: "publication" })
    expect(assessCommercialReadiness(body, { listingReadinessMode: "warn" }).findings.find((f) => f.code === "safety_incomplete")).toMatchObject({ level: "prioritaire", prevents: null })
    expect(assessCommercialReadiness(body, { listingReadinessMode: null }).findings.find((f) => f.code === "safety_incomplete")?.level).toBe("prioritaire")
  })
  it("unknown context is never turned into a blocker", () => {
    const r = assessCommercialReadiness(ready(), { listingReadinessMode: null })
    expect(codes(r)).not.toContain("merchant_unverified")
    expect(codes(r)).not.toContain("category_fields_missing")
    expect(codes(r)).not.toContain("net_not_positive")
    expect(assessCommercialReadiness(ready(), { listingReadinessMode: "warn", merchantVerified: false }).findings.find((f) => f.code === "merchant_unverified")).toMatchObject({ area: "account", effort: 4 })
  })
})

describe("priorities are real risks", () => {
  it("delivery window not typed (server default, or the Express wizard's own 2–7 days)", () => {
    expect(codes(assessCommercialReadiness(ready({ deliveryMin: undefined, deliveryMax: undefined }), { listingReadinessMode: "warn" }))).toContain("delivery_time_default")
    expect(codes(assessCommercialReadiness(ready(), { listingReadinessMode: "warn", deliveryTypedBySupplier: false }))).toContain("delivery_time_default")
    expect(codes(assessCommercialReadiness(ready(), { listingReadinessMode: "warn" }))).not.toContain("delivery_time_default")
  })
  it("few units, indistinct variants, a net per sale ≤ 0 at the supplier's own fee", () => {
    expect(codes(assessCommercialReadiness(ready({ stock: 2 }), { listingReadinessMode: "warn" }))).toContain("stock_low")
    const twins = { variantRows: [{ id: "a", name: "Noir / M", sku: "", priceCents: 0, stock: 1, commission: 15, sales: 0 }, { id: "b", name: "Noir / M", sku: "", priceCents: 0, stock: 1, commission: 15, sales: 0 }] }
    expect(codes(assessCommercialReadiness(ready({ listingVariants: twins }), { listingReadinessMode: "warn" }))).toContain("variants_indistinct")
    const loss = assessCommercialReadiness(ready({ price: 10, commission: 60 }), { listingReadinessMode: "warn", supplierFeeBps: 4500 })
    expect(loss.findings.find((f) => f.code === "net_not_positive")).toMatchObject({ level: "prioritaire" })
    expect(codes(assessCommercialReadiness(ready({ price: 10, commission: 60 }), { listingReadinessMode: "warn", supplierFeeBps: null }))).not.toContain("net_not_positive")
  })
})

describe("adaptive next fix", () => {
  it("the most severe level first, and among equals the one that unblocks most", () => {
    const r = assessCommercialReadiness(ready({ categoryId: "", stock: 2 }), { listingReadinessMode: "warn", categoryFieldsMissing: ["puissance"] })
    expect(r.nextFix?.code).toBe("category_missing")
  })
  it("prerequisites are respected: never « add 5 photos » before the first photo", () => {
    const r = assessCommercialReadiness(ready({ images: [] }), { listingReadinessMode: "warn" })
    expect(r.nextFix?.code).toBe("photo_missing")
  })
  it("a sheet-fixable blocker comes before an account step (cheaper, in the supplier's hands now)", () => {
    const r = assessCommercialReadiness(ready({ price: 0 }), { listingReadinessMode: "warn", merchantVerified: false })
    expect(r.nextFix?.code).toBe("price_missing")
  })
  it("among recommendations, one backed by a measured association goes first", () => {
    const r = assessCommercialReadiness(ready({ images: ["https://cdn.affisell.com/a.jpg"], productAttributes: GPSR_OK }), {
      listingReadinessMode: "warn",
      evidence: [{ feature: "brand_declared", adjustedRatio: 1.6, lo: 1.2 }],
    })
    expect(r.verdict).toBe("pret")
    expect(r.nextFix?.code).toBe("quality_brand_declared")
    expect(r.nextFix?.evidence).toEqual({ ratio: 1.6, lo: 1.2 })
  })
  it("nothing to fix = no next fix", () => {
    expect(pickNextFix([])).toBeNull()
  })
})

describe("no rule invented", () => {
  it("the engine reads the server's own validators, not copies", () => {
    const src = readFileSync(join(process.cwd(), "lib/commercial-readiness/readiness.ts"), "utf8")
    for (const fn of ["validateSupplierProductImagesForPublish", "validateWarehouseTypePublish", "validateDeliveryCountriesForPublish", "productCommissionRateForSave", "evaluateListingReadiness", "computeEarningPreview", "sheetSignalsFromProductBody"]) {
      expect(src, fn).toContain(fn)
    }
    const route = readFileSync(join(process.cwd(), "app/api/supplier/products/route.ts"), "utf8")
    for (const code of ["Missing name", "category_required", "Missing price", "productCommissionRateForSave", "validateSupplierProductImagesForPublish", "validateWarehouseTypePublish", "validateDeliveryCountriesPublish"]) {
      expect(route, code).toContain(code)
    }
  })
  it("client-safe: no Prisma, no translation picker in the engine's imports", () => {
    const src = readFileSync(join(process.cwd(), "lib/commercial-readiness/readiness.ts"), "utf8")
    expect(src).not.toMatch(/@\/lib\/prisma|i18n-pick-message|supplier-delivery-countries"|supplier-product-shipping/)
  })
})

describe("texts", () => {
  it("every code the engine can emit (outside quality elements) has its title, why and fix in 8 locales", () => {
    const src = readFileSync(join(process.cwd(), "lib/commercial-readiness/readiness.ts"), "utf8")
    const emitted = [...new Set([...src.matchAll(/(?:code: |publishRule\(|saveRule\()"([a-z_]+)"/g)].map((m) => m[1]))]
    expect(emitted.length).toBeGreaterThanOrEqual(19)
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const r = (JSON.parse(readFileSync(join(process.cwd(), `messages/${loc}.json`), "utf8")) as { supplier: { readiness: { finding: Record<string, Record<string, string>>; basis: Record<string, string>; verdict: Record<string, string>; level: Record<string, string> } } }).supplier.readiness
      for (const code of emitted) for (const k of ["title", "why", "fix"]) expect(typeof r.finding[code]?.[k], `${loc} ${code}.${k}`).toBe("string")
      for (const b of ["server_refusal", "save_refusal", "not_buyable", "platform_rule", "publication_rule_live", "affisell_decision", "observed_risk", "measured_association"]) expect(typeof r.basis[b], `${loc} basis.${b}`).toBe("string")
      for (const v of ["bloquant", "a_corriger", "pret"]) expect(typeof r.verdict[v]).toBe("string")
      for (const l of ["bloquant", "prioritaire", "recommande"]) expect(typeof r.level[l]).toBe("string")
    }
  })
  it("the three supplier flows show the readiness panel on the body they send", () => {
    const classic = readFileSync(join(process.cwd(), "components/supplier/supplier-add-product-form.tsx"), "utf8")
    expect(classic).toContain('<CommercialReadinessPanel body={readinessBody} creating={!editId} stage={!editId ? "new" : productIsDraft ? "draft" : "live"} categoryFieldsMissing={readinessCategoryErrors} />')
    const guided = readFileSync(join(process.cwd(), "components/supplier/guided-add-product-button.tsx"), "utf8")
    expect(guided).toContain("buildGuidedProductBody({ form, allImages, shipDefaults, asDraft: false, priceValid, stockN, withLeaf: true })")
    expect(guided).toContain("<CommercialReadinessPanel body={readinessBody} creating />")
    const express = readFileSync(join(process.cwd(), "components/products/wizard/WizardHub.tsx"), "utf8")
    expect(express).toContain("<CommercialReadinessPanel body={props.readinessBody} creating deliveryTypedBySupplier={false} />")
  })
})
