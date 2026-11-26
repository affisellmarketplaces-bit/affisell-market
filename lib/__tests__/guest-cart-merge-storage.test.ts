/** §1: signing in moves the guest lines to the server cart with the SAME signature (capacity included). */
import { describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ upserts: [] as Array<Record<string, unknown>> }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cart: { upsert: async () => ({ id: "cart1" }) },
    affiliateProduct: { findFirst: async () => ({ id: "ap1" }) },
    cartItem: { upsert: async (args: Record<string, unknown>) => void m.upserts.push(args) },
  },
}))
vi.mock("@/lib/cart-abandonment-touch", () => ({ resetCartAbandonmentOnActivity: async () => undefined }))

import { mergeGuestCartLinesForUser, parseGuestCartMergeBody } from "@/lib/merge-guest-cart-server"

describe("guest cart → server cart", () => {
  it("keeps colour, size and capacity in the server signature", async () => {
    const lines = parseGuestCartMergeBody([{ productId: "ap1", qty: 2, selectedColor: "Noir", selectedSize: "M", selectedStorage: "128 Go" }])
    expect(lines[0]).toMatchObject({ selectedStorage: "128 Go" })
    await mergeGuestCartLinesForUser("u1", lines)
    const create = (m.upserts[0]!.create as { variantSignature: string; quantity: number })
    expect(create.variantSignature).toBe("c:Noir|s:M|g:128 Go")
    expect(create.quantity).toBe(2)
  })

  it("an old guest line without capacity merges under its old signature", async () => {
    m.upserts.length = 0
    await mergeGuestCartLinesForUser("u1", parseGuestCartMergeBody([{ productId: "ap1", selectedColor: "Noir", selectedSize: "M" }]))
    expect((m.upserts[0]!.create as { variantSignature: string }).variantSignature).toBe("c:Noir|s:M")
  })
})
