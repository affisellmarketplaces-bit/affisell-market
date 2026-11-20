import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { sweepLinesFromOrders } from "@/lib/contract-models/history-lines"
import {
  declarationEffectiveAt,
  declarationInForceAt,
  parseEffectiveFrom,
  parseStoredDeclaration,
  resolveDeclarationForLine,
  type StoredDeclaration,
} from "@/lib/supplier-costs/declaration"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
import { currentQualification, parseQualificationEvent, type QualificationEvent } from "@/lib/supplier-costs/qualification"
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

describe("no historical order ever gets a declaration made or effective after its payment (exhaustive grid)", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000)
  it("product-wide and per-variant histories, every payment day", () => {
    // Declarations made on days 0..20, each effective the same day or up to 10 days later, for the product and 2 variants.
    const history: StoredDeclaration[] = []
    let k = 0
    for (let d = 0; d <= 20; d += 2) {
      for (const lag of [0, 3, 10]) {
        for (const variantKey of [null, "noir|m", "noir|l"]) {
          k += 1
          history.push(
            decl({
              unitCostCents: 100 + k,
              declaredAt: day(d).toISOString(),
              effectiveFrom: day(d + lag).toISOString(),
              variantKey,
              variantLabel: variantKey,
            })
          )
        }
      }
    }
    let checked = 0
    for (let p = -2; p <= 40; p++) {
      const paidAt = new Date(day(p).getTime() + 12 * 3_600_000)
      for (const variantKey of [null, "noir|m", "noir|l", "rouge|s"]) {
        const r = resolveDeclarationForLine({
          productHistory: history.filter((h) => !h.variantKey),
          variantHistory: history.filter((h) => !!h.variantKey),
          variantKey,
          at: paidAt,
        })
        checked += 1
        if (!r.declaration) continue
        expect(Date.parse(r.declaration.declaredAt)).toBeLessThanOrEqual(paidAt.getTime())
        expect(declarationEffectiveAt(r.declaration)).toBeLessThanOrEqual(paidAt.getTime())
        // Never another variant's figure.
        if (r.scope === "variant") expect(r.declaration.variantKey).toBe(variantKey)
        else expect(r.declaration.variantKey ?? null).toBeNull()
        // And it is the LATEST one already effective for that scope.
        const pool = history.filter((h) => (r.scope === "variant" ? h.variantKey === variantKey : !h.variantKey) && declarationEffectiveAt(h) <= paidAt.getTime())
        const best = Math.max(...pool.map((h) => declarationEffectiveAt(h)))
        expect(declarationEffectiveAt(r.declaration)).toBe(best)
      }
    }
    expect(checked).toBe(43 * 4)
  })

  it("a declaration recorded today with a past effective date can not exist (refused at input, distrusted when stored)", () => {
    const now = new Date("2026-11-19T10:00:00.000Z")
    expect(parseEffectiveFrom("2026-11-19T09:00:00.000Z", now)).toEqual({ ok: false, error: "effective_from_in_past" })
    // Within the 5-minute clock tolerance it is clamped to now — never earlier.
    expect(parseEffectiveFrom("2026-11-19T09:58:00.000Z", now)).toEqual({ ok: true, value: now.toISOString() })
  })
})

describe("qualification changes are per declaration and per scope", () => {
  const ev = (o: Partial<QualificationEvent>): QualificationEvent => ({ declarationN: 1, state: "verified", by: "adm", role: "admin", note: "ok", at: "2026-10-10T00:00:00.000Z", ...o })
  it("latest event of THIS declaration wins; another version's events never count", () => {
    const events = [ev({ state: "verified" }), ev({ state: "disputed", at: "2026-10-12T00:00:00.000Z" }), ev({ declarationN: 2, state: "verified", at: "2026-10-13T00:00:00.000Z" })]
    expect(currentQualification(events, 1)).toBe("disputed")
    expect(currentQualification(events, 2)).toBe("verified")
    expect(currentQualification(events, 3)).toBe("unverified")
  })
  it("a product-wide event list and a variant event list are separate inputs: one never qualifies the other", () => {
    const productEvents = [ev({ declarationN: 1, state: "verified" })]
    const variantEvents: QualificationEvent[] = []
    expect(currentQualification(productEvents, 1)).toBe("verified")
    expect(currentQualification(variantEvents, 1)).toBe("unverified")
  })
  it("a supplier can not mark verified; an admin can not mark a document provided", () => {
    expect(parseQualificationEvent({ declarationN: 1, state: "verified", by: "s", role: "supplier", note: "", at: "x" })).toBeNull()
    expect(parseQualificationEvent({ declarationN: 1, state: "document_provided", by: "a", role: "admin", note: "", at: "x" })).toBeNull()
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
