/**
 * One source of truth for the 12 sheet elements across the three supplier flows (classic form, guided wizard,
 * Express) and the server: each flow's check reads the body it SENDS, through the parsers the routes STORE with.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { countSpecifications, sheetSignals } from "@/lib/listing-quality/sheet-facts"
import { sheetSignalsFromProductBody } from "@/lib/listing-quality/sheet-facts-body"
import { buildSheetChecklist } from "@/lib/listing-quality/sheet-checklist"
import { buildWizardV2PreviewBody, buildWizardV2PublishBody, type WizardV2Draft } from "@/lib/product-wizard-v2/build-publish-payload"
import { buildFormProductAttributes } from "@/lib/supplier-form-product-attributes"
import { normalizeProductAttributesFromBody, parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8")

/** What the create route stores, read back exactly like the measure reads a live sheet. */
function storedSignals(body: Record<string, unknown>) {
  const attributes = normalizeProductAttributesFromBody(body.productAttributes)
  const ship = parseSupplierProductShippingBody(body)
  const images = (body.images as string[]) ?? []
  return sheetSignals({
    name: String(body.name ?? "").trim(),
    descriptionHtml: String(body.description ?? ""),
    imageCount: images.filter((u) => u.trim()).length,
    listingKind: (body.listingKind as string) ?? null,
    stock: Math.max(0, Math.round(Number(body.stock) || 0)),
    variants: parseProductAttributesBody(body).variants,
    customColumns: body.customColumns ?? null,
    deliveryMin: ship.deliveryMin,
    deliveryMax: ship.deliveryMax,
    attributes,
    specCount: countSpecifications(attributes),
  })
}

const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: "Lampe de bureau LED pliable",
  description: "<p>" + "Lampe LED pliable trois intensités, port USB-C. ".repeat(5) + "</p>",
  images: ["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg", "  "],
  listingKind: "PHYSICAL",
  stock: "12",
  productAttributes: [
    { key: "brand", value: "Lumo" },
    { key: "ean", value: "4006381333931" },
    { key: "matiere", value: "Aluminium" },
    { key: "puissance", value: "" },
    { key: "return_window_days", value: "7" },
  ],
  ...over,
})

describe("the form's check equals what the server stores", () => {
  it("same signals as the create route's own parsers, for bodies with and without delivery", () => {
    for (const b of [body(), body({ deliveryMin: 9, deliveryMax: 3 }), body({ deliveryMin: "x" }), body({ listingKind: "SOFTWARE" })]) {
      expect(sheetSignalsFromProductBody(b).signals).toEqual(storedSignals(b))
    }
  })
  it("a return window shorter than the legal 14 days is never stored nor counted", () => {
    expect(normalizeProductAttributesFromBody(body().productAttributes).some((a) => a.key === "return_window_days")).toBe(false)
    expect(sheetSignalsFromProductBody(body()).signals.returnWindowDays).toBe(14)
  })
  it("the create route now stores attribute rows through the shared normaliser", () => {
    const route = read("app/api/supplier/products/route.ts")
    expect(route).toContain("const productAttributes = normalizeProductAttributesFromBody(productAttributesRaw)")
  })
  it("no delivery in the body = the server's 2–5 days, said to be a default; a typed window is not", () => {
    const none = sheetSignalsFromProductBody(body())
    expect([none.signals.deliveryMin, none.signals.deliveryMax, none.defaulted.delivery]).toEqual([2, 5, true])
    expect(parseSupplierProductShippingBody(body())).toMatchObject({ deliveryMin: 2, deliveryMax: 5 })
    const typed = sheetSignalsFromProductBody(body({ deliveryMin: 3, deliveryMax: 6 }))
    expect(typed.defaulted.delivery).toBe(false)
    const item = buildSheetChecklist(none.signals, [], none.defaulted).items.find((i) => i.feature === "delivery_declared")
    expect(item).toMatchObject({ state: "present", fromDefault: true })
  })
})

describe("classic form: the check counts only what the save sends", () => {
  it("a value of a category the supplier left is not a specification", () => {
    const rows = buildFormProductAttributes([{ key: "matiere", label: "Matière" }], { matiere: "Bois", ancien_champ: "x", brand: "Lumo", return_window_days: "30" })
    expect(rows.map((r) => r.key).sort()).toEqual(["brand", "matiere", "return_window_days"])
    expect(countSpecifications(rows)).toBe(1)
  })
  it("the save and the check call the same builder", () => {
    const form = read("components/supplier/supplier-add-product-form.tsx")
    expect(form).toContain("const productAttributes = buildFormProductAttributes(mergedCategoryAttrs, specValues)")
    expect(form).toContain("productAttributes: buildFormProductAttributes(mergedCategoryAttrs, specValues),")
  })
})

describe("guided wizard: one body builder for publish, draft and check", () => {
  it("the request and the check both come from buildGuidedProductBody", () => {
    const src = read("components/supplier/guided-add-product-button.tsx")
    expect(src).toContain("body: JSON.stringify(buildGuidedProductBody({")
    expect(src).toContain("sheetSignalsFromProductBody(buildGuidedProductBody({")
    expect(src).toContain("<SheetQualityChecklist sheet={sheetQuality} />")
  })
})

describe("Express: the preview body is the publish body", () => {
  const defaults = { countryCode: "FR", warehouseType: "regional", offerMode: "NEW", defaultCommissionPct: 15 } as never
  const draft: WizardV2Draft = {
    name: "Gourde", description: "Inox", price: 19.9, stock: "8", categoryId: "c1", images: ["https://a/1.jpg"], commission: 20,
    attributes: [{ key: "brand", label: "Brand", value: "Ovra" }],
  }
  it("identical when the draft is complete; never throws while it is not", () => {
    expect(buildWizardV2PreviewBody(draft, defaults)).toEqual(buildWizardV2PublishBody(draft, defaults))
    expect(() => buildWizardV2PreviewBody({ ...draft, price: Number.NaN, stock: "" }, defaults)).not.toThrow()
    expect(() => buildWizardV2PublishBody({ ...draft, stock: "" }, defaults)).toThrow()
  })
  it("its 2–7 days are the wizard's own default, shown as such", () => {
    const r = sheetSignalsFromProductBody(buildWizardV2PreviewBody(draft, defaults), { deliveryTypedBySupplier: false })
    expect([r.signals.deliveryMin, r.signals.deliveryMax, r.defaulted.delivery]).toEqual([2, 7, true])
    const src = read("components/products/wizard/WizardHub.tsx")
    expect(src).toContain("const body = buildWizardV2PublishBody(buildExpressDraft(priceN), defaults)")
    expect(src).toContain("buildWizardV2PreviewBody(buildExpressDraft(Number(price)), defaults), { deliveryTypedBySupplier: false }")
  })
})
