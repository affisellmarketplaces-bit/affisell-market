"use client"

import { mergeGuestWishlistToServer } from "@/lib/merge-guest-cart-client"

const MERGED_KEY_PREFIX = "affisell:wishlist-merged:"

type KeyValueStore = Pick<Storage, "getItem" | "setItem">

const inFlight = new Set<string>()

function defaultStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Carry the anonymous favourites (cookie) into the buyer's account the first time they are seen signed in during a
 * browser session. The server merge is idempotent and cheap, so this only needs to avoid hammering it on every page:
 * one successful run per user per session, one request in flight at a time, and a failure is retried on the next page.
 */
export async function mergeGuestWishlistOncePerSession(
  userId: string,
  deps: { storage?: KeyValueStore | null; merge?: () => Promise<{ merged: number }> } = {}
): Promise<{ merged: number } | null> {
  const id = userId.trim()
  if (!id) return null
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  const key = `${MERGED_KEY_PREFIX}${id}`

  try {
    if (storage?.getItem(key) === "1") return null
  } catch {
    /* storage blocked — fall through, the merge is idempotent */
  }
  if (inFlight.has(id)) return null

  inFlight.add(id)
  try {
    const result = await (deps.merge ?? mergeGuestWishlistToServer)()
    try {
      storage?.setItem(key, "1")
    } catch {
      /* private mode: we may merge again next page, which is harmless */
    }
    return result
  } catch {
    return null
  } finally {
    inFlight.delete(id)
  }
}

/** Test seam: forget in-flight state between cases. */
export function resetGuestWishlistMergeStateForTests(): void {
  inFlight.clear()
}
