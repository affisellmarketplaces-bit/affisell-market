import { describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock("@/lib/prisma", () => ({
  prisma: { category: { findMany: vi.fn(async () => { throw new Error("database unreachable") }) } },
  withPrismaReconnect: (fn: () => unknown) => fn(),
}))

import { loadBrowseDepartmentsCached, loadBrowseDepartmentsSafe } from "@/lib/taxonomy/resolve-browse-departments.server"

describe("home department bar never takes the home page down", () => {
  it("the cached loader rejects when the database is unreachable (API route keeps its error)", async () => {
    await expect(loadBrowseDepartmentsCached("fr")).rejects.toThrow("database unreachable")
  })

  it("the home variant resolves to an empty bar instead", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    await expect(loadBrowseDepartmentsSafe("fr")).resolves.toEqual({ departments: [], locale: "fr" })
    expect(warn).toHaveBeenCalledOnce()
  })
})
