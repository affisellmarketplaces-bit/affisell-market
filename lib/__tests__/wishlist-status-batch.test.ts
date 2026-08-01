import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  invalidateWishlistStatus,
  resetWishlistStatusBatchForTests,
  subscribeWishlistStatus,
} from "@/lib/wishlist-status-batch"

vi.mock("@/lib/schedule-idle-task", () => ({
  scheduleIdleTask: (run: () => void) => {
    run()
    return () => {}
  },
}))

describe("wishlist-status-batch", () => {
  beforeEach(() => {
    resetWishlistStatusBatchForTests()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          statuses: {
            p1: { wished: true, dropPercent: 5, likeCount: 12 },
            p2: { wished: false, dropPercent: 0, likeCount: 3 },
          },
        }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetWishlistStatusBatchForTests()
  })

  it("coalesces multiple product ids into one fetch", async () => {
    const results: boolean[] = []
    const unsub1 = subscribeWishlistStatus("p1", (s) => {
      results.push(s.wished)
    })
    const unsub2 = subscribeWishlistStatus("p2", (s) => {
      results.push(!s.wished)
    })

    await new Promise((r) => setTimeout(r, 20))

    unsub1()
    unsub2()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/wishlist/status")
    expect(init?.method).toBe("POST")
    const body = JSON.parse(String(init?.body)) as { ids: string[] }
    expect(body.ids).toContain("p1")
    expect(body.ids).toContain("p2")
    expect(results).toContain(true)
    expect(results).toContain(true)
  })

  it("invalidateWishlistStatus refetches subscribed products", async () => {
    subscribeWishlistStatus("p1", () => {})
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockClear()

    invalidateWishlistStatus("p1")

    await new Promise((r) => setTimeout(r, 20))

    expect(fetchMock).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    expect(url).toBe("/api/wishlist/status")
    const body = JSON.parse(String(init?.body)) as { ids: string[] }
    expect(body.ids).toContain("p1")
  })

  it("invalidateWishlistStatus skips unknown product ids", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockClear()
    invalidateWishlistStatus("unknown")
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("soft-fails network errors without throwing (no console.error overlay)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))

    let status: { wished: boolean } | null = null
    const unsub = subscribeWishlistStatus("p1", (s) => {
      status = s
    })
    await new Promise((r) => setTimeout(r, 20))
    unsub()

    expect(status).toEqual({ wished: false, dropPercent: 0, likeCount: 0 })
    expect(errSpy).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      "[wishlist-status-batch]",
      expect.objectContaining({ result: "network_error" })
    )
    log.mockRestore()
    errSpy.mockRestore()
  })
})
