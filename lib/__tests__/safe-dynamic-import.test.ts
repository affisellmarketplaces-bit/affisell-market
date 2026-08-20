import { describe, expect, it, vi } from "vitest"

import {
  isSafeDynamicNullComponent,
  safeDynamicImport,
} from "@/lib/safe-dynamic-import"

describe("safeDynamicImport", () => {
  it("returns module on success", async () => {
    const mod = { default: () => null }
    await expect(safeDynamicImport(async () => mod, "Test")).resolves.toBe(mod)
  })

  it("returns null component on chunk failure", async () => {
    const result = await safeDynamicImport(async () => {
      throw new Error("ChunkLoadError")
    }, "Test")
    expect(result).toEqual({ default: expect.any(Function) })
    expect(isSafeDynamicNullComponent((result as { default: () => null }).default)).toBe(true)
    expect((result as { default: () => null }).default()).toBeNull()
  })
})
