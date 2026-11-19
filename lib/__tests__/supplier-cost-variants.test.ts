import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { sweepLinesFromOrders } from "@/lib/contract-models/history-lines"
import {
  declarationInForceAt,
  parseEffectiveFrom,
  parseStoredDeclaration,
  resolveDeclarationForLine,
  type StoredDeclaration,
} from "@/lib/supplier-costs/declaration"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
import { entryFromOrderSnapshot } from "@/lib/supplier-costs/observed-cost-register"
import {
  listVariantOptions,
  parseVariantKeyField,
  variantKeyFromOrderLabel,
  variantKeyFromRowName,
  variantKeyFromValues,
} from "@/lib/supplier-costs/variant-key"

const base = {
  unitCostCents: 500,
  deliveryCostCents: 0,
  source: "own_stock" as const,
  leadTimeDays: null,
  minimumOrderQty: null,
  note: "",
  declaredBy: "sup",
}
const decl = (o: Partial<StoredDeclaration>): StoredDeclaration => ({ ...base, declaredAt: "2026-10-01T00:00:00.000Z", variantKey: null, ...o })
const at = (s: string) => new Date(s)

describe("variant identity", () => {
  it("one canonical key for the order label, the SKU row name and the variant table", () => {
    expect(variantKeyFromOrderLabel("Noir · M")).toBe("noir|m")
    expect(variantKeyFromRowName("  Noir /  M ")).toBe("noir|m")
    expect(variantKeyFromValues(["Noir", "M"])).toBe("noir|m")
    expect(variantKeyFromOrderLabel("Noir")).toBe("noir")
    expect(variantKeyFromOrderLabel("")).toBeNull()
    expect(variantKeyFromValues(["a|b"])).toBeNull()
  })

  it("lists declarable variants; two variants with one name are ambiguous and excluded", () => {
    const r = listVariantOptions({
      variants: { variantRows: [{ name: "Noir / M" }, { name: "Rouge / M" }, { name: "rouge / m" }] },
      tableRows: [{ color: "Noir", size: "M" }, { color: "Bleu", size: null }],
    })
    expect(r.options.map((o) => o.key).sort()).toEqual(["bleu", "noir|m"])
    expect(r.ambiguousKeys).toEqual(["rouge|m"])
  })

  it("the variant field is optional and bounded", () => {
    expect(parseVariantKeyField({})).toEqual({ ok: true, value: null })
    expect(parseVariantKeyField({ variantKey: "noir|m" })).toEqual({ ok: true, value: "noir|m" })
    expect(parseVariantKeyField({ variantKey: 3 })).toEqual({ ok: false })
    expect(parseVariantKeyField({ variantKey: "x".repeat(201) })).toEqual({ ok: false })
  })
})

describe("effective date — never retroactive", () => {
  const now = at("2026-11-19T10:00:00.000Z")
  it("absent = now; past refused; at most a year ahead", () => {
    expect(parseEffectiveFrom(null, now)).toEqual({ ok: true, value: now.toISOString() })
    expect(parseEffectiveFrom("2026-11-01", now)).toEqual({ ok: false, error: "effective_from_in_past" })
    expect(parseEffectiveFrom("2028-01-01", now)).toEqual({ ok: false, error: "effective_from_too_far" })
    expect(parseEffectiveFrom("nope", now)).toEqual({ ok: false, error: "effective_from_invalid" })
    expect(parseEffectiveFrom("2026-12-01T00:00:00.000Z", now)).toEqual({ ok: true, value: "2026-12-01T00:00:00.000Z" })
  })
  it("a stored row whose effective date precedes its declaration is not trusted", () => {
    expect(parseStoredDeclaration({ ...base, declaredAt: "2026-10-05T00:00:00Z", effectiveFrom: "2026-10-01T00:00:00Z" })).toBeNull()
    expect(parseStoredDeclaration({ ...base, declaredAt: "2026-10-05T00:00:00Z" })?.effectiveFrom).toBeUndefined()
  })
  it("in force = latest effective date reached; a future declaration waits", () => {
    const h = [decl({ unitCostCents: 500 }), decl({ unitCostCents: 900, declaredAt: "2026-10-03T00:00:00.000Z", effectiveFrom: "2026-11-01T00:00:00.000Z" })]
    expect(declarationInForceAt(h, at("2026-10-15"))?.unitCostCents).toBe(500)
    expect(declarationInForceAt(h, at("2026-11-02"))?.unitCostCents).toBe(900)
  })
})

describe("per-variant resolution — a variant's cost never serves another", () => {
  const product = [decl({ unitCostCents: 500 })]
  const variants = [decl({ unitCostCents: 800, variantKey: "noir|m", variantLabel: "Noir / M", declaredAt: "2026-10-05T00:00:00.000Z" })]
  it("own variant first, then the product-wide default, else none", () => {
    expect(resolveDeclarationForLine({ productHistory: product, variantHistory: variants, variantKey: "noir|m", at: at("2026-10-10") })).toMatchObject({ scope: "variant", declaration: { unitCostCents: 800 } })
    expect(resolveDeclarationForLine({ productHistory: product, variantHistory: variants, variantKey: "noir|l", at: at("2026-10-10") })).toMatchObject({ scope: "product", declaration: { unitCostCents: 500 } })
    expect(resolveDeclarationForLine({ productHistory: [], variantHistory: variants, variantKey: "noir|l", at: at("2026-10-10") }).scope).toBe("none")
    expect(resolveDeclarationForLine({ productHistory: [], variantHistory: variants, variantKey: null, at: at("2026-10-10") }).scope).toBe("none")
    expect(resolveDeclarationForLine({ productHistory: [], variantHistory: variants, variantKey: "noir", at: at("2026-10-10") }).scope).toBe("none")
  })

  it("the comparison meets an observation with its own variant's declaration; a global one is never 'comparable' to a variant", () => {
    const e = entryFromOrderSnapshot({ orderId: "o1", productId: "p", paidAt: at("2026-10-10"), quantity: 2, aeWholesaleCents: 1600, currency: "EUR", variantLabel: "Noir · M" })!
    const own = compareDeclaredWithObserved([...product, ...variants], [{ ...e, perimeter: { ...e.perimeter, vat: "excluded" } }])
    expect(own.pairs[0]).toMatchObject({ declarationScope: "variant", declaredUnitCents: 800, comparable: true, gapCents: 0 })
    const other = compareDeclaredWithObserved([...product, ...variants], [{ ...e, perimeter: { ...e.perimeter, vat: "excluded", variantKey: "noir|l" } }])
    expect(other.pairs[0]).toMatchObject({ declarationScope: "product", comparable: false })
    expect(other.pairs[0].reasons).toContain("déclaration globale du produit, observation d'une variante précise")
  })

  it("the contract simulation takes the line's own variant cost and labels a product-wide fallback", () => {
    const order = (id: string, variantLabel: string | null) =>
      ({
        orderId: id,
        productId: "p",
        paidAt: at("2026-10-10"),
        variantLabel,
        disputed: false,
        refundedCents: 0,
        totalCents: 3600,
        split: { sellingPriceCents: 3000, supplierPriceCents: 2000, basePriceCents: 2000, supplierCommissionRateBps: 1000, supplierFeeCents: 0, usesAffisellAutoBuy: false, aeWholesaleCents: 0 },
      }) as never
    const lines = sweepLinesFromOrders([order("a", "Noir · M"), order("b", "Noir · L")], { catalogue: 1000, autoBuy: 1700 }, new Map([["p", [...product, ...variants]]]))
    expect(lines.declared.map((l) => [l.orderId, l.sourceCostCents, l.declarationScope])).toEqual([
      ["a", 800, "variant"],
      ["b", 500, "product"],
    ])
  })
})

describe("storage separation", () => {
  it("variant declarations and their qualifications have their own action and ids", () => {
    const src = readFileSync(path.resolve(__dirname, "../supplier-costs/declaration.server.ts"), "utf8")
    expect(src).toContain("VARIANT_COST_ACTION")
    expect(src).toContain("VARIANT_COST_QUALIFICATION_ACTION")
    // Every product-wide row read is forced to the product scope — a stray key can not make it a variant's cost.
    expect(src).toMatch(/variantKey: null, variantLabel: null, n/)
  })
})
