import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  invalidateWishlistStatus,
  resetWishlistStatusBatchForTests,
  subscribeWishlistStatus,
} from "@/lib/wishlist-status-batch"

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
    const url = String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])
    expect(url).toContain("ids=p1")
    expect(url).toContain("p2")
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
    const url = String(fetchMock.mock.calls.at(-1)?.[0])
    expect(url).toContain("ids=p1")
  })

  it("invalidateWishlistStatus skips unknown product ids", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockClear()
    invalidateWishlistStatus("unknown")
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
