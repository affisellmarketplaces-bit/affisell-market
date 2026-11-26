/**
 * Founder brief 2026-11-19 « Fermeture des dernières lacunes variantes » §1: the guest cart keeps colour, size AND
 * capacity exactly as chosen — through add, persistence, reload, sign-in merge and checkout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseCartVariantSignature } from "@/lib/cart-variant"
import { addGuestCartItem, guestItemVariantSignature, readGuestCart, writeGuestCart, GUEST_CART_KEY } from "@/lib/guest-cart"
import { guestCartLineId, parseGuestCartLineId } from "@/lib/guest-cart-line-id"
import { resolveVariantChoice } from "@/lib/variant-selection"

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal("window", { dispatchEvent: () => true, localStorage: globalThis.localStorage })
  vi.stubGlobal("CustomEvent", class {
    constructor(public type: string, public init?: unknown) {}
  })
})
afterEach(() => vi.unstubAllGlobals())

// A product sold in sizes AND capacities: rows « Noir / M » differ only by their capacity attribute.
const both = {
  variantRows: [
    { name: "Noir / M", stock: 2, attrs: { stockage: "64 Go" } },
    { name: "Noir / M", stock: 1, attrs: { stockage: "128 Go" } },
  ],
  skuCustomColumns: [{ key: "stockage", label: "Stockage" }],
}

describe("guest cart — colour, size and capacity", () => {
  it("keeps the capacity through add, persistence and a reload of the page", () => {
    addGuestCartItem({ productId: "ap1", qty: 1, selectedColor: "Noir", selectedSize: "M", selectedStorage: "128 Go" })
    // « Reload »: everything is read back from the stored JSON only.
    const raw = JSON.parse(store.get(GUEST_CART_KEY)!)
    expect(raw[0]).toMatchObject({ selectedColor: "Noir", selectedSize: "M", selectedStorage: "128 Go" })
    const [line] = readGuestCart()
    expect(guestItemVariantSignature(line!)).toBe("c:Noir|s:M|g:128 Go")
  })

  it("two capacities of one size are two lines, never merged; the same choice adds up", () => {
    addGuestCartItem({ productId: "ap1", qty: 1, selectedColor: "Noir", selectedSize: "M", selectedStorage: "64 Go" })
    addGuestCartItem({ productId: "ap1", qty: 1, selectedColor: "Noir", selectedSize: "M", selectedStorage: "128 Go" })
    addGuestCartItem({ productId: "ap1", qty: 2, selectedColor: "Noir", selectedSize: "M", selectedStorage: "128 Go" })
    const lines = readGuestCart()
    expect(lines).toHaveLength(2)
    expect(lines.find((l) => l.selectedStorage === "128 Go")!.qty).toBe(3)
    expect(new Set(lines.map(guestCartLineId)).size).toBe(2)
  })

  it("the line id carries the exact signature, which names ONE row under the shared rule", () => {
    const item = { productId: "ap1", qty: 1, selectedColor: "Noir", selectedSize: "M", selectedStorage: "128 Go" }
    const parsed = parseGuestCartLineId(guestCartLineId(item))!
    expect(parsed).toEqual({ productId: "ap1", variantSignature: "c:Noir|s:M|g:128 Go" })
    expect(resolveVariantChoice(both, parseCartVariantSignature(parsed.variantSignature))).toMatchObject({ kind: "resolved", index: 1 })
  })

  it("lines saved before the capacity was kept keep their exact signature; nothing is rebuilt", () => {
    writeGuestCart([{ productId: "ap1", qty: 1, selectedColor: "Noir", selectedSize: "M" }])
    const [line] = readGuestCart()
    expect(line!.selectedStorage).toBeUndefined()
    expect(guestItemVariantSignature(line!)).toBe("c:Noir|s:M")
    // …and such a line stays INCOMPLETE for a product sold in capacities: never a capacity picked for the buyer.
    expect(resolveVariantChoice(both, { color: "Noir", size: "M" })).toMatchObject({ kind: "incomplete", missing: ["storage"] })
  })

  it("a capacity with no size stays in the size slot (unchanged signature); junk values are dropped on read", () => {
    expect(guestItemVariantSignature({ selectedColor: "Noir", selectedStorage: "128 Go" })).toBe("c:Noir")
    store.set(GUEST_CART_KEY, JSON.stringify([{ productId: "ap1", qty: 1, selectedStorage: 42 }, { productId: "ap2", qty: 1, selectedStorage: "  " }]))
    expect(readGuestCart().every((l) => l.selectedStorage === undefined)).toBe(true)
  })
})
