/**
 * Founder brief 2026-11-19 « Finalisation de la fiabilité des déclinaisons »: ONE rule for which variant is bought,
 * shared by the decrement, the check before payment, the product pages and the card buttons.
 */
import { describe, expect, it } from "vitest"

import { normalizeCartVariantSignature, parseCartVariantSignature } from "@/lib/cart-variant"
import { evaluateCheckoutStockGate, isStockManagedForLine, planStockMovement, variantSelectionProblem } from "@/lib/checkout-stock"
import { summarizeReservationExposure } from "@/lib/stock-exposure"
import { stripVariantOptionTypePrefix } from "@/lib/supplier-sku-builder"
import { hasVariantChoice, listingRequiresVariantChoice, variantChoicePageHref } from "@/lib/variant-choice-client"
import { optionStockForChoice, requiresVariantChoice, resolveVariantChoice } from "@/lib/variant-selection"

const rows = (...r: Array<{ name: string; stock: number; attrs?: Record<string, string> }>) => ({
  variantRows: r.map((x, i) => ({ id: `r${i}`, sku: "", priceCents: 0, commission: 20, sales: 0, ...x })),
})
const tee = rows({ name: "Noir / M", stock: 0 }, { name: "Noir / L", stock: 4 }, { name: "Blanc / M", stock: 2 })
// A phone: two rows named « Noir » that differ only by their capacity attribute.
const phone = {
  ...rows(
    { name: "Noir", stock: 3, attrs: { stockage: "128 Go" } },
    { name: "Noir", stock: 0, attrs: { stockage: "256 Go" } },
    { name: "Bleu", stock: 5, attrs: { stockage: "128 Go" } }
  ),
  skuCustomColumns: [{ key: "stockage", label: "Stockage" }],
}
// A size AND a capacity (rare, but real for some electronics accessories).
const both = {
  ...rows(
    { name: "Noir / M", stock: 2, attrs: { stockage: "64 Go" } },
    { name: "Noir / M", stock: 1, attrs: { stockage: "128 Go" } },
    { name: "Noir / L", stock: 0, attrs: { stockage: "64 Go" } }
  ),
  skuCustomColumns: [{ key: "stockage", label: "Stockage" }],
}

describe("the shared rule — colour / size", () => {
  it("a valid combination is ONE row; an invalid one does not exist", () => {
    expect(resolveVariantChoice(tee, { color: "Noir", size: "L" })).toEqual({ kind: "resolved", index: 1, auto: false })
    expect(resolveVariantChoice(tee, { color: "noir", size: "l" })).toMatchObject({ kind: "resolved", index: 1 })
    expect(resolveVariantChoice(tee, { color: "Blanc", size: "L" })).toEqual({ kind: "unknown" })
    expect(resolveVariantChoice(tee, { color: "Rouge", size: "M" })).toEqual({ kind: "unknown" })
  })

  it("a colour alone on a product sold in several sizes is INCOMPLETE — never a size picked for the buyer", () => {
    expect(resolveVariantChoice(tee, { color: "Noir" })).toEqual({ kind: "incomplete", missing: ["size"], candidates: [0, 1] })
    // …but a colour that exists in ONE size names that row.
    expect(resolveVariantChoice(tee, { color: "Blanc" })).toMatchObject({ kind: "resolved", index: 2 })
  })

  it("a size alone names its row when only one colour has it", () => {
    expect(resolveVariantChoice(tee, { size: "L" })).toMatchObject({ kind: "resolved", index: 1 })
    expect(resolveVariantChoice(tee, { size: "M" })).toMatchObject({ kind: "incomplete", missing: ["color"] })
  })

  it("no choice: a single row is bought as is; several rows need a choice; no rows = not judged", () => {
    expect(resolveVariantChoice(rows({ name: "Unique", stock: 1 }), {})).toEqual({ kind: "resolved", index: 0, auto: true })
    expect(resolveVariantChoice(tee, {})).toMatchObject({ kind: "incomplete", missing: ["color", "size"] })
    expect(resolveVariantChoice(null, { color: "Noir" })).toEqual({ kind: "no_rows" })
  })

  it("rows identical on every dimension are the supplier's data, never a buyer's incomplete choice", () => {
    const dup = rows({ name: "Noir / M", stock: 1 }, { name: "Noir / M", stock: 2 })
    expect(resolveVariantChoice(dup, { color: "Noir", size: "M" })).toMatchObject({ kind: "duplicate_rows" })
  })

  it("a third name part is a dimension no picker names: rows differing only there are never told apart", () => {
    const imported = rows({ name: "Noir / M / Coton", stock: 1 }, { name: "Noir / M / Lin", stock: 1 })
    expect(resolveVariantChoice(imported, { color: "Noir", size: "M" })).toMatchObject({ kind: "incomplete", missing: ["other"] })
  })

  it("type prefixes (« Couleur : ») are read like the supplier SKU builder", () => {
    for (const l of ["Couleur: Noir", "size : M", "Noir"]) {
      // Same normalisation as `stripVariantOptionTypePrefix`, kept inline so the module has no import.
      expect(resolveVariantChoice(rows({ name: `${l} / X`, stock: 1 }, { name: "Autre / X", stock: 1 }), { color: stripVariantOptionTypePrefix(l) })).toMatchObject({ kind: "resolved", index: 0 })
    }
  })
})

describe("the shared rule — capacity (several dimensions)", () => {
  it("the product page sends the capacity in the size slot when there is no size: matched as capacity", () => {
    expect(resolveVariantChoice(phone, { color: "Noir", size: "128 Go" })).toMatchObject({ kind: "resolved", index: 0 })
    expect(resolveVariantChoice(phone, { color: "Noir", size: "512 Go" })).toEqual({ kind: "unknown" })
    expect(resolveVariantChoice(phone, { color: "Noir" })).toMatchObject({ kind: "incomplete", missing: ["storage"] })
  })

  it("a size AND a capacity: both must be named; the capacity travels as its own part of the signature", () => {
    const sig = normalizeCartVariantSignature("Noir", "M", "128 Go")
    expect(sig).toBe("c:Noir|s:M|g:128 Go")
    expect(parseCartVariantSignature(sig)).toEqual({ color: "Noir", size: "M", storage: "128 Go" })
    expect(resolveVariantChoice(both, parseCartVariantSignature(sig))).toMatchObject({ kind: "resolved", index: 1 })
    expect(resolveVariantChoice(both, { color: "Noir", size: "M" })).toMatchObject({ kind: "incomplete", missing: ["storage"] })
  })

  it("existing signatures keep their exact value (cart rows are keyed by them)", () => {
    expect(normalizeCartVariantSignature("Noir", "M")).toBe("c:Noir|s:M")
    expect(normalizeCartVariantSignature("Noir", null, "128 Go")).toBe("c:Noir|s:128 Go")
    expect(normalizeCartVariantSignature("Noir", "M", "m")).toBe("c:Noir|s:M")
  })
})

describe("one rule everywhere: check before payment = decrement", () => {
  const line = (variants: unknown, variantSignature: string) => ({
    productId: "p",
    productName: "P",
    listingKind: "PHYSICAL",
    stock: 9,
    variants,
    variantSignature,
    qty: 1,
  })

  it("a phone bought as « Noir · 128 Go » is NOT refused and its row is the one decremented", () => {
    expect(variantSelectionProblem(line(phone, "c:Noir|s:128 Go"))).toBeNull()
    const plan = planStockMovement({ listingKind: "PHYSICAL", stock: 8, variants: phone, variantSignature: "c:Noir|s:128 Go", qty: 1 })
    expect(plan).toMatchObject({ kind: "ok", scope: "variant", available: 3, nextStock: 7 })
    const next = (plan as { nextVariants: { variantRows: Array<{ stock: number }> } }).nextVariants
    expect(next.variantRows.map((r) => r.stock)).toEqual([2, 0, 5])
  })

  it("the sold-out capacity is a shortfall, not another capacity's stock", () => {
    const plan = planStockMovement({ listingKind: "PHYSICAL", stock: 8, variants: phone, variantSignature: "c:Noir|s:256 Go", qty: 1 })
    expect(plan).toEqual({ kind: "insufficient", scope: "variant", available: 0 })
  })

  it("incomplete and unknown choices are flagged with what is missing, and never decremented", () => {
    expect(variantSelectionProblem(line(tee, "c:Noir"))).toEqual({ problem: "variant_incomplete", missing: ["size"] })
    expect(variantSelectionProblem(line(tee, ""))).toEqual({ problem: "variant_required", missing: ["color", "size"] })
    expect(variantSelectionProblem(line(tee, "c:Blanc|s:L"))).toEqual({ problem: "variant_unknown" })
    expect(isStockManagedForLine({ listingKind: "PHYSICAL", variants: tee, variantSignature: "c:Noir" })).toBe(false)
  })

  it("a single-row product bought without a choice is now decremented from its row (it can only be that one)", () => {
    const one = rows({ name: "Unique", stock: 2 })
    expect(planStockMovement({ listingKind: "PHYSICAL", stock: 2, variants: one, variantSignature: "", qty: 1 })).toMatchObject({ kind: "ok", nextStock: 1 })
  })

  it("warn refuses nothing (logged only); enforce refuses before the payment; two spellings of one row share its stock", () => {
    const log = console.log
    console.log = () => undefined
    try {
      expect(evaluateCheckoutStockGate([line(tee, "c:Noir")], {}).refuseVariant).toBeNull()
      expect(evaluateCheckoutStockGate([line(tee, "c:Noir")], { CHECKOUT_STOCK_MODE: "enforce" }).refuseVariant).toMatchObject({ problem: "variant_incomplete", missing: ["size"] })
      const two = [line(phone, "c:Noir|s:128 Go"), line(phone, "c:Noir|g:128 Go"), line(phone, "c:Noir|s:128 Go"), line(phone, "c:Noir|s:128 Go")]
      expect(evaluateCheckoutStockGate(two, { CHECKOUT_STOCK_MODE: "enforce" }).refuse).toMatchObject({ scope: "variant", available: 3, requested: 4 })
    } finally {
      console.log = log
    }
  })
})

describe("option chips and card buttons", () => {
  it("a size chip is sold out when the combination is missing or at 0, available while another choice remains", () => {
    expect(optionStockForChoice(tee, { color: "Noir", size: "M" })).toBe(0)
    expect(optionStockForChoice(tee, { color: "Blanc", size: "L" })).toBe(0) // does not exist for that colour
    expect(optionStockForChoice(tee, { color: "Noir", size: "L" })).toBe(4)
    expect(optionStockForChoice(both, { color: "Noir", size: "M" })).toBe(3) // capacity still to choose
    expect(optionStockForChoice(null, { size: "M" })).toBeNull() // no rows: the page keeps its own figure
  })

  it("which products need a choice before a card can buy them", () => {
    expect(requiresVariantChoice({ variants: tee })).toBe(true)
    expect(requiresVariantChoice({ variants: phone })).toBe(true)
    expect(requiresVariantChoice({ variants: rows({ name: "Unique", stock: 1 }) })).toBe(false)
    expect(requiresVariantChoice({ variants: null })).toBe(false)
    expect(requiresVariantChoice({ variants: null, tableVariantCount: 3 })).toBe(true) // variants only in the table
  })

  it("the card asks the server, and a failed answer keeps the card's behaviour", async () => {
    const answer = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch
    expect(await listingRequiresVariantChoice("ap1", answer({ requiresChoice: true }))).toBe(true)
    expect(await listingRequiresVariantChoice("ap1", answer({ requiresChoice: false }))).toBe(false)
    expect(await listingRequiresVariantChoice("ap1", answer({}, false))).toBe(false)
    expect(await listingRequiresVariantChoice("ap1", (async () => { throw new Error("offline") }) as unknown as typeof fetch)).toBe(false)
    expect(hasVariantChoice({ selectedSize: " M " })).toBe(true)
    expect(hasVariantChoice({})).toBe(false)
    expect(variantChoicePageHref("ap1")).toBe("/marketplace/ap1?choose=1")
    expect(variantChoicePageHref("ap1", "/shops/s/product/ap1?x=1")).toBe("/shops/s/product/ap1?x=1&choose=1")
  })
})

describe("paid orders not shipped — the two readings, never merged (§3)", () => {
  const products = [
    { productId: "a", declaredUnits: 3 },
    { productId: "b", declaredUnits: 2 },
    { productId: "c", declaredUnits: 10 },
  ]
  const pending = [
    { productId: "a", units: 3 },
    { productId: "b", units: 1 },
    { productId: "b", units: 2 },
  ]

  it("when the platform does not deduct (warn), says how much the page may show that is already sold", () => {
    expect(summarizeReservationExposure({ products, pending, platformDeducts: false })).toEqual({
      platformDeducts: false,
      productsWithPendingOrders: 2,
      pendingUnits: 6,
      shownInStockButAllOwed: 2,
      owedBeyondDeclared: 1,
      unitsShownButAlreadySold: 5,
    })
  })

  it("when it deducts at payment (enforce) the second reading does not apply: nothing is subtracted twice", () => {
    expect(summarizeReservationExposure({ products, pending, platformDeducts: true })).toMatchObject({
      pendingUnits: 6,
      shownInStockButAllOwed: 0,
      owedBeyondDeclared: 0,
      unitsShownButAlreadySold: 0,
    })
  })
})
