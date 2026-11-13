/**
 * F11 — the 409 codes of the stock gate must reach the shopper as a TRANSLATED sentence: never the raw machine code, never
 * silence, never the supplier-probe copy. Covers the parsing, the sentence, the fast-checkout / buy-now mapping and the 8 locales.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { checkoutStockMessage, parseCheckoutStockRefusal } from "@/lib/checkout-stock-client"

const LOCALES = ["de", "en", "es", "fr", "it", "nl", "pl", "zh"] as const

describe("parseCheckoutStockRefusal / checkoutStockMessage", () => {
  const t = (key: "outOfStock" | "insufficient", values?: { count: number }) =>
    key === "insufficient" ? `only ${values!.count}` : "sold out"

  it("recognises our two codes and nothing else (the supplier-probe code keeps its own modal)", () => {
    expect(parseCheckoutStockRefusal({ error: "OUT_OF_STOCK", availableQty: 0 })).toEqual({ code: "OUT_OF_STOCK", availableQty: 0 })
    expect(parseCheckoutStockRefusal({ error: "INSUFFICIENT_STOCK", availableQty: 4 })).toEqual({ code: "INSUFFICIENT_STOCK", availableQty: 4 })
    expect(parseCheckoutStockRefusal({ error: "OUT_OF_STOCK_VERIFIED" })).toBeNull()
    expect(parseCheckoutStockRefusal({ error: "FLASH_EXPIRED" })).toBeNull()
    expect(parseCheckoutStockRefusal(null)).toBeNull()
    expect(parseCheckoutStockRefusal("OUT_OF_STOCK")).toBeNull()
  })

  it("a missing or bogus quantity is null, never NaN", () => {
    expect(parseCheckoutStockRefusal({ error: "INSUFFICIENT_STOCK" })).toEqual({ code: "INSUFFICIENT_STOCK", availableQty: null })
    expect(parseCheckoutStockRefusal({ error: "INSUFFICIENT_STOCK", availableQty: "3" })).toEqual({ code: "INSUFFICIENT_STOCK", availableQty: null })
    expect(parseCheckoutStockRefusal({ error: "INSUFFICIENT_STOCK", availableQty: -2 })).toEqual({ code: "INSUFFICIENT_STOCK", availableQty: 0 })
  })

  it("says how many are left only when it knows, otherwise 'out of stock' — and never contains the code", () => {
    expect(checkoutStockMessage({ code: "INSUFFICIENT_STOCK", availableQty: 5 }, t)).toBe("only 5")
    expect(checkoutStockMessage({ code: "INSUFFICIENT_STOCK", availableQty: 0 }, t)).toBe("sold out")
    expect(checkoutStockMessage({ code: "INSUFFICIENT_STOCK", availableQty: null }, t)).toBe("sold out")
    expect(checkoutStockMessage({ code: "OUT_OF_STOCK", availableQty: 0 }, t)).toBe("sold out")
  })
})

describe("the sentences exist in every locale (cart.stock.*), with the {count} placeholder", () => {
  for (const loc of LOCALES) {
    it(loc, () => {
      const messages = JSON.parse(readFileSync(join(process.cwd(), "messages", `${loc}.json`), "utf8")) as {
        cart: { stock?: { outOfStock?: string; insufficient?: string } }
      }
      expect(messages.cart.stock?.outOfStock?.trim()).toBeTruthy()
      expect(messages.cart.stock?.insufficient).toContain("{count}")
      // never a raw machine code
      expect(messages.cart.stock?.outOfStock).not.toMatch(/OUT_OF_STOCK|INSUFFICIENT/)
    })
  }
})

describe("fast checkout → buy now: a refusal by our counter is surfaced, not turned into a cart add", () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(status: number, body: unknown) {
    vi.stubGlobal("window", { location: { assign: vi.fn() } })
    vi.stubGlobal("fetch", vi.fn(async () => ({ status, json: async () => body })))
  }

  it("startFastCheckout maps OUT_OF_STOCK / INSUFFICIENT_STOCK to a `no_stock` result with the quantity", async () => {
    const { startFastCheckout } = await import("@/lib/fast-checkout-client")
    stubFetch(409, { error: "INSUFFICIENT_STOCK", availableQty: 2, requestedQty: 5 })
    expect(await startFastCheckout({ productId: "ap1", qty: 5 })).toEqual({ ok: false, status: "no_stock", code: "INSUFFICIENT_STOCK", availableQty: 2 })
    stubFetch(409, { error: "OUT_OF_STOCK", availableQty: 0 })
    expect(await startFastCheckout({ productId: "ap1" })).toEqual({ ok: false, status: "no_stock", code: "OUT_OF_STOCK", availableQty: 0 })
  })

  it("the supplier-probe refusal keeps its own path (modal with alternatives)", async () => {
    const { startFastCheckout } = await import("@/lib/fast-checkout-client")
    stubFetch(409, { error: "OUT_OF_STOCK_VERIFIED", productName: "Lamp", alternatives: [] })
    expect(await startFastCheckout({ productId: "ap1" })).toMatchObject({ ok: false, status: "out_of_stock", productName: "Lamp" })
  })

  it("buyNowWithoutLogin returns the refusal and does NOT add the item to the cart (it would be refused again)", async () => {
    vi.resetModules()
    const addToBuyerCart = vi.fn(async () => ({ ok: true }))
    vi.doMock("@/lib/cart-add-client", () => ({ addToBuyerCart }))
    vi.doMock("@/lib/client-navigate.client", () => ({ clientNavigateOrAssign: vi.fn() }))
    const { buyNowWithoutLogin } = await import("@/lib/guest-buy-now-client")
    stubFetch(409, { error: "INSUFFICIENT_STOCK", availableQty: 1 })
    const outcome = await buyNowWithoutLogin({ productId: "ap1", qty: 3 }, { productId: "ap1", title: "Lamp" } as never)
    expect(outcome).toEqual({ kind: "no_stock", refusal: { code: "INSUFFICIENT_STOCK", availableQty: 1 } })
    expect(addToBuyerCart).not.toHaveBeenCalled()
    vi.doUnmock("@/lib/cart-add-client")
    vi.doUnmock("@/lib/client-navigate.client")
  })
})
