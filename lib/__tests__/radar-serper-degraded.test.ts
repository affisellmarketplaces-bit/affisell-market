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

describe("readSerperErrorDetail", () => {
  it("flags Serper's actual 'Not enough credits' 400 body as quota exhaustion", async () => {
    const { readSerperErrorDetail } = await import("@/lib/radar/crawler/serper-client")
    const res = new Response('{"message":"Not enough credits","statusCode":400}', { status: 400 })
    const detail = await readSerperErrorDetail(res)
    expect(detail.quotaExhausted).toBe(true)
    expect(detail.status).toBe(400)
    expect(detail.message).toContain("Not enough credits")
  })

  it("does not flag an unrelated error as quota exhaustion", async () => {
    const { readSerperErrorDetail } = await import("@/lib/radar/crawler/serper-client")
    const res = new Response("Internal Server Error", { status: 500 })
    const detail = await readSerperErrorDetail(res)
    expect(detail.quotaExhausted).toBe(false)
    expect(detail.status).toBe(500)
  })
})
