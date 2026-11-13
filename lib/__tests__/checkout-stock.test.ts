import { describe, expect, it, vi } from "vitest"

import {
  evaluateCheckoutStockGate,
  findCheckoutStockShortfall,
  isCheckoutStockGuardEnabled,
  planStockMovement,
  resolveCheckoutStockMode,
} from "@/lib/checkout-stock"

const rows = (...r: Array<{ name: string; stock: number } & Record<string, unknown>>) => ({
  size: ["S", "M"],
  variantRows: r.map((x, i) => ({ id: `row-${i}`, sku: "", priceCents: 0, commission: 20, sales: 0, ...x })),
})

describe("CHECKOUT_STOCK_GUARD switch", () => {
  it("is ON unless explicitly switched off", () => {
    expect(isCheckoutStockGuardEnabled({})).toBe(true)
    expect(isCheckoutStockGuardEnabled({ CHECKOUT_STOCK_GUARD: "" })).toBe(true)
    expect(isCheckoutStockGuardEnabled({ CHECKOUT_STOCK_GUARD: "on" })).toBe(true)
    for (const off of ["off", "OFF", " off ", "0", "false"]) {
      expect(isCheckoutStockGuardEnabled({ CHECKOUT_STOCK_GUARD: off })).toBe(false)
    }
  })
})

describe("planStockMovement — product-level stock", () => {
  const base = { listingKind: "PHYSICAL", variants: null, variantSignature: "" }

  it("takes the units and never goes below zero", () => {
    expect(planStockMovement({ ...base, stock: 5, qty: 2 })).toMatchObject({
      kind: "ok",
      scope: "product",
      available: 5,
      nextStock: 3,
      nextVariants: null,
    })
    expect(planStockMovement({ ...base, stock: 5, qty: 5 })).toMatchObject({ kind: "ok", nextStock: 0 })
  })

  it("refuses when the stock is short (and reports what is left)", () => {
    expect(planStockMovement({ ...base, stock: 5, qty: 6 })).toEqual({ kind: "insufficient", scope: "product", available: 5 })
    // 0 is sold out on every buyer surface, not "unlimited"
    expect(planStockMovement({ ...base, stock: 0, qty: 1 })).toEqual({ kind: "insufficient", scope: "product", available: 0 })
    expect(planStockMovement({ ...base, stock: null, qty: 1 })).toEqual({ kind: "insufficient", scope: "product", available: 0 })
    expect(planStockMovement({ ...base, stock: -3, qty: 1 })).toEqual({ kind: "insufficient", scope: "product", available: 0 })
  })

  it("leaves a non-physical listing alone whatever the number in the column", () => {
    for (const kind of ["SOFTWARE", "SUBSCRIPTION", "SERVICE", "EXPERIENCE", "RESTAURANT", "MUSEUM", "software"]) {
      expect(planStockMovement({ ...base, listingKind: kind, stock: 0, qty: 3 })).toEqual({
        kind: "unmanaged",
        reason: "non_physical",
      })
    }
  })

  it("treats an unknown or missing kind like the rest of the code base: physical", () => {
    expect(planStockMovement({ ...base, listingKind: null, stock: 1, qty: 1 }).kind).toBe("ok")
    expect(planStockMovement({ ...base, listingKind: "whatever", stock: 0, qty: 1 }).kind).toBe("insufficient")
  })

  it("ignores a nonsensical quantity instead of guessing", () => {
    for (const qty of [0, -1, Number.NaN]) {
      expect(planStockMovement({ ...base, stock: 5, qty })).toEqual({ kind: "unmanaged", reason: "invalid_quantity" })
    }
  })
})

describe("planStockMovement — variant rows", () => {
  const kind = { listingKind: "PHYSICAL" }

  it("decrements ONLY the matching row and keeps the aggregate in step", () => {
    const variants = rows(
      { name: "Rouge / S", stock: 3 },
      { name: "Rouge / M", stock: 4 },
      { name: "Bleu / S", stock: 9 }
    )
    const plan = planStockMovement({ ...kind, stock: 16, variants, variantSignature: "c:Rouge|s:M", qty: 2 })
    expect(plan).toMatchObject({ kind: "ok", scope: "variant", available: 4, nextStock: 14, variantRowName: "Rouge / M" })
    if (plan.kind !== "ok") throw new Error("unreachable")
    const next = plan.nextVariants as { variantRows: Array<{ name: string; stock: number }> }
    expect(next.variantRows.map((r) => [r.name, r.stock])).toEqual([
      ["Rouge / S", 3],
      ["Rouge / M", 2],
      ["Bleu / S", 9],
    ])
  })

  it("rewrites the RAW json: values the parser would normalise are preserved byte for byte", () => {
    const variants = {
      model: "X1",
      variantRows: [
        // no id, commission above the parser's 50 clamp, unknown keys: parsing and re-saving would corrupt all of that
        { name: "Rouge / M", stock: 4, commission: 77, priceCents: 1234, extra: { a: 1 } },
      ],
    }
    const plan = planStockMovement({ ...kind, stock: 4, variants, variantSignature: "c:Rouge|s:M", qty: 1 })
    if (plan.kind !== "ok") throw new Error("expected ok")
    expect(plan.nextVariants).toEqual({
      model: "X1",
      variantRows: [{ name: "Rouge / M", stock: 3, commission: 77, priceCents: 1234, extra: { a: 1 } }],
    })
    // the input object itself is untouched
    expect(variants.variantRows[0]!.stock).toBe(4)
  })

  it("refuses on the ROW even when the aggregate looks sufficient (the row is what the buyer sees)", () => {
    const variants = rows({ name: "Rouge / S", stock: 1 }, { name: "Rouge / M", stock: 40 })
    expect(planStockMovement({ ...kind, stock: 41, variants, variantSignature: "c:Rouge|s:S", qty: 2 })).toEqual({
      kind: "insufficient",
      scope: "variant",
      available: 1,
    })
  })

  it("does not block on a drifted aggregate: the row is the authority", () => {
    const variants = rows({ name: "Rouge / M", stock: 5 })
    const plan = planStockMovement({ ...kind, stock: 0, variants, variantSignature: "c:Rouge|s:M", qty: 2 })
    expect(plan).toMatchObject({ kind: "ok", scope: "variant", nextStock: 0 })
  })

  it("matches case- and spacing-insensitively", () => {
    const variants = rows({ name: "  rouge  /  m ", stock: 2 })
    expect(planStockMovement({ ...kind, stock: 2, variants, variantSignature: "c:Rouge|s:M", qty: 1 }).kind).toBe("ok")
  })

  it("accepts a colour-only selection when the colour has exactly one row", () => {
    const variants = rows({ name: "Rouge", stock: 2 }, { name: "Bleu", stock: 5 })
    expect(planStockMovement({ ...kind, stock: 7, variants, variantSignature: "c:Bleu", qty: 5 })).toMatchObject({
      kind: "ok",
      variantRowName: "Bleu",
    })
  })

  it("never guesses: no selection / ambiguous colour / unknown option are left unmanaged", () => {
    const variants = rows({ name: "Rouge / S", stock: 0 }, { name: "Rouge / M", stock: 0 })
    for (const sig of ["", "c:Rouge", "c:Vert|s:S", "s:S"]) {
      expect(planStockMovement({ ...kind, stock: 0, variants, variantSignature: sig, qty: 1 })).toEqual({
        kind: "unmanaged",
        reason: "variant_unresolved",
      })
    }
    // two rows with the same label: ambiguous too
    const dup = rows({ name: "Rouge / S", stock: 1 }, { name: "Rouge / S", stock: 1 })
    expect(planStockMovement({ ...kind, stock: 2, variants: dup, variantSignature: "c:Rouge|s:S", qty: 1 }).kind).toBe(
      "unmanaged"
    )
  })

  it("a variants object with no rows is a product-level stock", () => {
    expect(planStockMovement({ ...kind, stock: 3, variants: { size: ["S"] }, variantSignature: "c:Rouge", qty: 2 })).toMatchObject({
      kind: "ok",
      scope: "product",
      nextStock: 1,
    })
  })
})

describe("findCheckoutStockShortfall (cart, before the payment session exists)", () => {
  const line = (over: Partial<Parameters<typeof findCheckoutStockShortfall>[0][number]> = {}) => ({
    productId: "p1",
    productName: "Lamp",
    listingKind: "PHYSICAL",
    stock: 3,
    variants: null,
    variantSignature: "",
    qty: 1,
    ...over,
  })

  it("passes when every line can be served", () => {
    expect(findCheckoutStockShortfall([line(), line({ productId: "p2", stock: 1 })])).toBeNull()
  })

  it("reports the first short line with what is left", () => {
    expect(findCheckoutStockShortfall([line(), line({ productId: "p2", stock: 1, qty: 4 })])).toEqual({
      lineIndex: 1,
      productId: "p2",
      productName: "Lamp",
      scope: "product",
      available: 1,
      requested: 4,
    })
  })

  it("two lines of the same product are served from the SAME stock", () => {
    const shortfall = findCheckoutStockShortfall([line({ qty: 2 }), line({ qty: 2 })])
    expect(shortfall).toMatchObject({ lineIndex: 1, available: 3, requested: 4 })
  })

  it("two variants of the same product consume their own rows", () => {
    const variants = rows({ name: "Rouge / S", stock: 1 }, { name: "Rouge / M", stock: 1 })
    expect(
      findCheckoutStockShortfall([
        line({ variants, stock: 2, variantSignature: "c:Rouge|s:S" }),
        line({ variants, stock: 2, variantSignature: "c:Rouge|s:M" }),
      ])
    ).toBeNull()
    expect(
      findCheckoutStockShortfall([
        line({ variants, stock: 2, variantSignature: "c:Rouge|s:S" }),
        line({ variants, stock: 2, variantSignature: "c:Rouge|s:S" }),
      ])
    ).toMatchObject({ lineIndex: 1, scope: "variant", available: 1, requested: 2 })
  })

  it("never refuses unmanaged products", () => {
    expect(findCheckoutStockShortfall([line({ listingKind: "SOFTWARE", stock: 0, qty: 50 })])).toBeNull()
  })
})

describe("CHECKOUT_STOCK_MODE (rollout switch, same pattern as LISTING_READINESS_MODE)", () => {
  const env = (v: Record<string, string>) => v as Record<string, string | undefined>

  it("defaults to WARN, reads off / warn / enforce case-insensitively, and ignores anything else", () => {
    expect(resolveCheckoutStockMode(env({}))).toBe("warn")
    expect(resolveCheckoutStockMode(env({ CHECKOUT_STOCK_MODE: "" }))).toBe("warn")
    expect(resolveCheckoutStockMode(env({ CHECKOUT_STOCK_MODE: "warn" }))).toBe("warn")
    expect(resolveCheckoutStockMode(env({ CHECKOUT_STOCK_MODE: " ENFORCE " }))).toBe("enforce")
    expect(resolveCheckoutStockMode(env({ CHECKOUT_STOCK_MODE: "off" }))).toBe("off")
    for (const junk of ["on", "true", "1", "strict", "enforced"]) {
      expect(resolveCheckoutStockMode(env({ CHECKOUT_STOCK_MODE: junk }))).toBe("warn")
    }
  })

  it("CHECKOUT_STOCK_GUARD=off stays the emergency valve and wins over every mode", () => {
    for (const mode of ["warn", "enforce", ""]) {
      for (const off of ["off", "0", "false", "OFF"]) {
        expect(resolveCheckoutStockMode(env({ CHECKOUT_STOCK_MODE: mode, CHECKOUT_STOCK_GUARD: off }))).toBe("off")
      }
    }
    expect(isCheckoutStockGuardEnabled(env({ CHECKOUT_STOCK_MODE: "off" }))).toBe(false)
    expect(isCheckoutStockGuardEnabled(env({ CHECKOUT_STOCK_MODE: "enforce" }))).toBe(true)
    expect(isCheckoutStockGuardEnabled(env({}))).toBe(true)
  })
})

describe("planStockMovement — clamp (warn mode) and table-only variants", () => {
  const base = { listingKind: "PHYSICAL", variants: null, variantSignature: "" }

  it("clamp: a shortfall empties the stock instead of refusing, never below 0, and reports it", () => {
    expect(planStockMovement({ ...base, stock: 2, qty: 5, onShortfall: "clamp" })).toEqual({
      kind: "ok",
      scope: "product",
      available: 2,
      nextStock: 0,
      nextVariants: null,
      shortfall: { available: 2, requested: 5 },
    })
    expect(planStockMovement({ ...base, stock: 0, qty: 1, onShortfall: "clamp" })).toMatchObject({ kind: "ok", nextStock: 0, shortfall: { available: 0, requested: 1 } })
    // no shortfall: identical to the default plan
    expect(planStockMovement({ ...base, stock: 5, qty: 2, onShortfall: "clamp" })).toEqual(planStockMovement({ ...base, stock: 5, qty: 2 }))
  })

  it("clamp on a variant row empties that row only, keeps the aggregate in step, never below 0", () => {
    const variants = rows({ name: "Rouge / S", stock: 1 }, { name: "Rouge / M", stock: 4 })
    const plan = planStockMovement({ listingKind: "PHYSICAL", stock: 5, variants, variantSignature: "c:Rouge|s:S", qty: 3, onShortfall: "clamp" })
    if (plan.kind !== "ok") throw new Error("expected ok")
    expect(plan).toMatchObject({ scope: "variant", nextStock: 4, shortfall: { available: 1, requested: 3 } })
    expect((plan.nextVariants as { variantRows: Array<{ stock: number }> }).variantRows.map((r) => r.stock)).toEqual([0, 4])
    // an aggregate that already drifted below the row never goes negative
    const drifted = planStockMovement({ listingKind: "PHYSICAL", stock: 0, variants, variantSignature: "c:Rouge|s:S", qty: 3, onShortfall: "clamp" })
    expect(drifted).toMatchObject({ kind: "ok", nextStock: 0 })
  })

  it("a product with variants but NO variantRows json (stock in the ProductVariant table) is unmanaged", () => {
    expect(planStockMovement({ ...base, hasVariants: true, stock: 0, variantSignature: "c:Rouge|s:M", qty: 1 })).toEqual({
      kind: "unmanaged",
      reason: "variants_not_tracked",
    })
    // without the flag a plain product is managed as before
    expect(planStockMovement({ ...base, hasVariants: false, stock: 0, qty: 1 }).kind).toBe("insufficient")
    // with variantRows the json rows win even when the flag is set
    expect(
      planStockMovement({ listingKind: "PHYSICAL", hasVariants: true, stock: 2, variants: rows({ name: "Rouge / M", stock: 2 }), variantSignature: "c:Rouge|s:M", qty: 1 }).kind
    ).toBe("ok")
  })
})

describe("findCheckoutStockShortfall — what the shopper is told", () => {
  const line = (over: Record<string, unknown> = {}) => ({
    productId: "p1",
    productName: "Lamp",
    listingKind: "PHYSICAL",
    stock: 5,
    variants: null,
    variantSignature: "",
    qty: 1,
    ...over,
  })

  it("reports the stock BEFORE the cart and the cart's total ask, not what earlier lines left over (5 in stock, lines 5 + 1)", () => {
    expect(findCheckoutStockShortfall([line({ qty: 5 }), line({ qty: 1 })])).toMatchObject({
      lineIndex: 1,
      available: 5,
      requested: 6,
    })
  })

  it("a table-only variant product is never refused", () => {
    expect(findCheckoutStockShortfall([line({ stock: 0, hasVariants: true, variantSignature: "c:Rouge" })])).toBeNull()
  })
})

describe("evaluateCheckoutStockGate — the check before the payment session", () => {
  const sold = [
    { productId: "p1", productName: "Lamp", listingKind: "PHYSICAL", stock: 0, variants: null, variantSignature: "", qty: 1 },
  ]
  const env = (v: Record<string, string>) => v as Record<string, string | undefined>

  it("warn (default): logs would-refuse and lets the buyer through; enforce refuses; off does nothing", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const warn = evaluateCheckoutStockGate(sold, env({}))
    expect(warn).toEqual({ mode: "warn", refuse: null })
    expect(log.mock.calls.some((c) => (c[1] as { result?: string }).result === "would_refuse_insufficient_stock")).toBe(true)

    const enforce = evaluateCheckoutStockGate(sold, env({ CHECKOUT_STOCK_MODE: "enforce" }))
    expect(enforce.mode).toBe("enforce")
    expect(enforce.refuse).toMatchObject({ productId: "p1", available: 0, requested: 1 })

    log.mockClear()
    expect(evaluateCheckoutStockGate(sold, env({ CHECKOUT_STOCK_MODE: "off" }))).toEqual({ mode: "off", refuse: null })
    expect(evaluateCheckoutStockGate(sold, env({ CHECKOUT_STOCK_MODE: "enforce", CHECKOUT_STOCK_GUARD: "off" }))).toEqual({ mode: "off", refuse: null })
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it("nothing to report when the cart can be served, whatever the mode", () => {
    const ok = [{ ...sold[0]!, stock: 3 }]
    expect(evaluateCheckoutStockGate(ok, env({ CHECKOUT_STOCK_MODE: "enforce" }))).toEqual({ mode: "enforce", refuse: null })
  })
})
