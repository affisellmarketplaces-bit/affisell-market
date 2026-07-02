import { beforeEach, describe, expect, it } from "vitest"

import {
  BUYER_PERSONALIZATION_REFRESH_PENDING_KEY,
  consumeBuyerPersonalizationRefreshPending,
  markBuyerPersonalizationRefreshPending,
} from "@/lib/buyer-personalization-refresh.client"

describe("buyer personalization refresh client", () => {
  const storage = new Map<string, string>()
  const sessionStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  }

  beforeEach(() => {
    storage.clear()
    Object.defineProperty(globalThis, "window", {
      value: {
        sessionStorage: sessionStorageMock,
      },
      configurable: true,
    })
    Object.defineProperty(globalThis, "sessionStorage", {
      value: sessionStorageMock,
      configurable: true,
    })
  })

  it("stores a pending refresh reason across redirects", () => {
    markBuyerPersonalizationRefreshPending("checkout_success")
    expect(storage.get(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY)).toBe(
      "checkout_success"
    )
  })

  it("consumes the pending reason only once", () => {
    storage.set(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY, "wishlist_updated")

    expect(consumeBuyerPersonalizationRefreshPending()).toBe("wishlist_updated")
    expect(consumeBuyerPersonalizationRefreshPending()).toBeNull()
  })

  it("ignores unexpected stored values", () => {
    storage.set(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY, "unknown")
    expect(consumeBuyerPersonalizationRefreshPending()).toBeNull()
  })
})
