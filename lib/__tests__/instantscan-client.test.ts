import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { analyzeWithRetry } from "@/lib/ai/instantscan-client"

describe("instantscan-client analyzeWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("retries on 429 with exponential backoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "rate_limit" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ title: "JBL", confidence: 0.97 }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const onRetry = vi.fn()
    const promise = analyzeWithRetry("https://cdn.example.com/jbl.jpg", 0, { onRetry })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(1, 429)
    expect(result.ok).toBe(true)
  })

  it("throws instantscan_rate_limit after max retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "server_error" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const promise = analyzeWithRetry("https://cdn.example.com/jbl.jpg", 0)
    const expectPromise = expect(promise).rejects.toThrow("instantscan_rate_limit")

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(4000)
    await expectPromise
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
