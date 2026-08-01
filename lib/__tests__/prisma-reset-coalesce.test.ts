import { afterEach, describe, expect, it, vi } from "vitest"

import {
  __resetPrismaResetCoalesceStateForTests,
  schedulePrismaClientReset,
} from "@/lib/prisma"

describe("schedulePrismaClientReset", () => {
  afterEach(() => {
    __resetPrismaResetCoalesceStateForTests()
    vi.restoreAllMocks()
  })

  it("does not tear down on idle Closed engine events", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    schedulePrismaClientReset("closed")
    schedulePrismaClientReset("closed")
    schedulePrismaClientReset("closed")
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/idle connection closed/i)
  })

  it("coalesces hard resets within the window", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    schedulePrismaClientReset("retryable")
    schedulePrismaClientReset("retryable")
    schedulePrismaClientReset("query")
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("transient")).length).toBe(1)
  })
})
