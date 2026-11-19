/** §2: the table rows are attached to the lines that need them, read-only; an unreadable table changes nothing. */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { withTableVariants } from "@/lib/checkout-table-variants.server"

const line = (over: Record<string, unknown> = {}) => ({
  productId: "p1",
  listingKind: "PHYSICAL",
  stock: 1,
  variants: null,
  hasVariants: true,
  variantSignature: "",
  qty: 1,
  ...over,
})

describe("withTableVariants", () => {
  it("reads the table only for products with no advanced rows, once", async () => {
    const findMany = vi.fn(async () => [{ productId: "p1", color: "Noir", size: "M", stock: 2, customData: null }])
    const out = await withTableVariants([line(), line({ productId: "p2", variants: { variantRows: [{ name: "A", stock: 1 }] } })], { productVariant: { findMany } } as never)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect((findMany.mock.calls[0] as unknown as [{ where: { productId: { in: string[] } } }])[0].where.productId.in).toEqual(["p1"])
    expect(out[0]!.tableVariants).toEqual([{ color: "Noir", size: "M", stock: 2, customData: null }])
    expect(out[1]!.tableVariants).toBeUndefined()
  })

  it("simple products (no variants flag) are never queried", async () => {
    const findMany = vi.fn(async () => [])
    await withTableVariants([line({ hasVariants: false })], { productVariant: { findMany } } as never)
    expect(findMany).not.toHaveBeenCalled()
  })

  it("non-physical goods and already-attached lines are skipped; a failed read leaves the lines unchanged", async () => {
    const findMany = vi.fn(async () => {
      throw new Error("db down")
    })
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const lines = [line()]
    expect(await withTableVariants(lines, { productVariant: { findMany } } as never)).toBe(lines)
    expect(await withTableVariants([line({ listingKind: "SOFTWARE" })], { productVariant: { findMany } } as never)).toHaveLength(1)
    err.mockRestore()
  })
})
