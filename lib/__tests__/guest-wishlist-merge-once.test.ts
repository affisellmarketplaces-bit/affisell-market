import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  mergeGuestWishlistOncePerSession,
  resetGuestWishlistMergeStateForTests,
} from "@/lib/guest-wishlist-merge-once.client"

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

beforeEach(() => resetGuestWishlistMergeStateForTests())

describe("mergeGuestWishlistOncePerSession", () => {
  it("merges the first time a user is seen signed in, then not again this session", async () => {
    const storage = fakeStorage()
    const merge = vi.fn().mockResolvedValue({ merged: 2 })
    await expect(mergeGuestWishlistOncePerSession("u1", { storage, merge })).resolves.toEqual({ merged: 2 })
    await expect(mergeGuestWishlistOncePerSession("u1", { storage, merge })).resolves.toBeNull()
    expect(merge).toHaveBeenCalledTimes(1)
    expect(storage.data.get("affisell:wishlist-merged:u1")).toBe("1")
  })

  it("tracks users separately (a second account on the same browser still gets its merge)", async () => {
    const storage = fakeStorage()
    const merge = vi.fn().mockResolvedValue({ merged: 0 })
    await mergeGuestWishlistOncePerSession("u1", { storage, merge })
    await mergeGuestWishlistOncePerSession("u2", { storage, merge })
    expect(merge).toHaveBeenCalledTimes(2)
  })

  it("a failed merge is retried on the next page instead of being marked done", async () => {
    const storage = fakeStorage()
    const merge = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ merged: 1 })
    await expect(mergeGuestWishlistOncePerSession("u1", { storage, merge })).resolves.toBeNull()
    expect(storage.data.size).toBe(0)
    await expect(mergeGuestWishlistOncePerSession("u1", { storage, merge })).resolves.toEqual({ merged: 1 })
  })

  it("never fires two requests at once for the same user", async () => {
    let release!: (v: { merged: number }) => void
    const merge = vi.fn(() => new Promise<{ merged: number }>((r) => (release = r)))
    const first = mergeGuestWishlistOncePerSession("u1", { storage: fakeStorage(), merge })
    await expect(mergeGuestWishlistOncePerSession("u1", { storage: fakeStorage(), merge })).resolves.toBeNull()
    release({ merged: 1 })
    await expect(first).resolves.toEqual({ merged: 1 })
    expect(merge).toHaveBeenCalledTimes(1)
  })

  it("still merges (idempotently) when session storage is unavailable", async () => {
    const merge = vi.fn().mockResolvedValue({ merged: 1 })
    const blocked = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    }
    await expect(mergeGuestWishlistOncePerSession("u1", { storage: blocked, merge })).resolves.toEqual({ merged: 1 })
    await expect(mergeGuestWishlistOncePerSession("u1", { storage: null, merge })).resolves.toEqual({ merged: 1 })
  })

  it("ignores an empty user id", async () => {
    const merge = vi.fn()
    await expect(mergeGuestWishlistOncePerSession("  ", { storage: fakeStorage(), merge })).resolves.toBeNull()
    expect(merge).not.toHaveBeenCalled()
  })
})
