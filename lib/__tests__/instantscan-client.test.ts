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

  it("does not retry 429 — returns rate_limit immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => "45" },
      json: async () => ({ error: "rate_limit", retry_after_sec: 45 }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const onRetry = vi.fn()
    const result = await analyzeWithRetry("https://cdn.example.com/jbl.jpg", 0, { onRetry })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(result.status).toBe(429)
    expect(result.data.error).toBe("rate_limit")
    expect(result.retryAfterSec).toBe(45)
  })

  it("retries transient 5xx with exponential backoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: () => null },
        json: async () => ({ error: "server_error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ title: "JBL", confidence: 0.97 }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const onRetry = vi.fn()
    const promise = analyzeWithRetry("https://cdn.example.com/jbl.jpg", 0, { onRetry })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(1, 503)
    expect(result.ok).toBe(true)
  })

  it("stops after max retries on persistent 5xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: "server_error" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const promise = analyzeWithRetry("https://cdn.example.com/jbl.jpg", 0)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
  })
})
