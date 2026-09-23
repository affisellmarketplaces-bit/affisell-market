import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("currency-conversion — CNY to EUR", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("uses the live Frankfurter rate when the fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 0.13065 } }) })
    )
    const { convertCnyToEur, getCnyToEurRate } = await import("@/lib/currency-conversion")

    const { rate, source } = await getCnyToEurRate()
    expect(rate).toBeCloseTo(0.13065, 5)
    expect(source).toBe("live")

    const eur = await convertCnyToEur(100)
    // convertCnyToEur rounds to cents: 100 * 0.13065 = 13.065 → 13.07
    expect(eur).toBeCloseTo(13.07, 2)
  })

  it("falls back to the approximate rate when the live fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    const { convertCnyToEur, getCnyToEurRate } = await import("@/lib/currency-conversion")

    const { source, rate } = await getCnyToEurRate()
    expect(source).toBe("fallback")
    expect(rate).toBeGreaterThan(0)

    const eur = await convertCnyToEur(100)
    expect(eur).toBeGreaterThan(0)
  })

  it("falls back to the approximate rate on a non-OK HTTP response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    const { getCnyToEurRate } = await import("@/lib/currency-conversion")

    const { source } = await getCnyToEurRate()
    expect(source).toBe("fallback")
  })

  it("falls back to the approximate rate on a malformed response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    const { getCnyToEurRate } = await import("@/lib/currency-conversion")

    const { source } = await getCnyToEurRate()
    expect(source).toBe("fallback")
  })

  it("returns 0 for a non-positive or non-finite amount without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { convertCnyToEur } = await import("@/lib/currency-conversion")

    expect(await convertCnyToEur(0)).toBe(0)
    expect(await convertCnyToEur(-5)).toBe(0)
    expect(await convertCnyToEur(Number.NaN)).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("caches the live rate across calls instead of refetching every time", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 0.13 } }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getCnyToEurRate } = await import("@/lib/currency-conversion")

    await getCnyToEurRate()
    await getCnyToEurRate()
    await getCnyToEurRate()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
