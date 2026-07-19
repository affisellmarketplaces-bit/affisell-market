import { afterEach, describe, expect, it, vi } from "vitest"

describe("serper-client graceful missing key", () => {
  const prev = process.env.SERPER_API_KEY

  afterEach(() => {
    if (prev === undefined) delete process.env.SERPER_API_KEY
    else process.env.SERPER_API_KEY = prev
    vi.resetModules()
  })

  it("isSerperConfigured is false without key", async () => {
    delete process.env.SERPER_API_KEY
    const { isSerperConfigured } = await import("@/lib/radar/crawler/serper-client")
    expect(isSerperConfigured()).toBe(false)
  })

  it("serperSearch returns [] and does not throw when key missing", async () => {
    delete process.env.SERPER_API_KEY
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { serperSearch } = await import("@/lib/radar/crawler/serper-client")
    await expect(serperSearch("led strip")).resolves.toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
