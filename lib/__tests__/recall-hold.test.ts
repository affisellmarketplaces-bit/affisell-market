/**
 * An Affisell suspension (open product-safety recall) is not a supplier pause: the supplier can not lift it.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isRecallOpen, PRODUCT_RECALLED_ERROR, supplierMayActivate } from "@/lib/legal/recall-hold"

const m = vi.hoisted(() => ({ findMany: vi.fn(async () => [] as { status: string }[]) }))
vi.mock("@/lib/prisma", () => ({ prisma: { productRecall: { findMany: m.findMany } } }))

describe("recall hold — pure rules", () => {
  it("every status but closed is open", () => {
    for (const s of ["draft", "notified_customers", "dgccrf_notified", "", null, undefined]) expect(isRecallOpen(s)).toBe(true)
    expect(isRecallOpen("closed")).toBe(false)
    expect(isRecallOpen(" CLOSED ")).toBe(false)
  })

  it("a supplier may activate only when no recall is open", () => {
    expect(supplierMayActivate([])).toBe(true)
    expect(supplierMayActivate(["closed", "closed"])).toBe(true)
    expect(supplierMayActivate(["closed", "draft"])).toBe(false)
  })
})

describe("isProductHeldByRecall", () => {
  afterEach(() => m.findMany.mockReset())

  it("held while a recall is open, free once every recall is closed", async () => {
    const { isProductHeldByRecall } = await import("@/lib/legal/recall-hold.server")
    m.findMany.mockResolvedValueOnce([{ status: "draft" }])
    expect(await isProductHeldByRecall("p1")).toBe(true)
    m.findMany.mockResolvedValueOnce([{ status: "closed" }])
    expect(await isProductHeldByRecall("p1")).toBe(false)
  })

  it("fails closed when the recalls can not be read", async () => {
    const { isProductHeldByRecall } = await import("@/lib/legal/recall-hold.server")
    m.findMany.mockRejectedValueOnce(new Error("db down"))
    expect(await isProductHeldByRecall("p1")).toBe(true)
  })
})

describe("both supplier activation paths check the hold", () => {
  const root = path.resolve(__dirname, "../..")
  it.each(["app/api/products/[id]/route.ts", "app/api/supplier/products/[id]/route.ts"])("%s", (file) => {
    const src = readFileSync(path.join(root, file), "utf8")
    expect(src).toContain("isProductHeldByRecall(")
    expect(src).toContain("PRODUCT_RECALLED_ERROR")
  })

  it("the error code is stable", () => {
    expect(PRODUCT_RECALLED_ERROR).toBe("product_recalled")
  })
})
