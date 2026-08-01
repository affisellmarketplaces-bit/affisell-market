"use client"

/** Coalesce per-card wishlist polls into one API call (marketplace grid). */

import {
  BUYER_WISHLIST_UPDATED_EVENT,
  type BuyerWishlistUpdatedDetail,
} from "@/lib/buyer-wishlist-signals.client"
import { scheduleIdleTask } from "@/lib/schedule-idle-task"

export type WishlistCardStatus = {
  wished: boolean
  dropPercent: number
  likeCount: number
}

type Listener = (status: WishlistCardStatus) => void

const BATCH_CHUNK = 48
const IDLE_FLUSH_MS = 2600
const IDLE_FLUSH_FALLBACK_MS = 700

const EMPTY_STATUS: WishlistCardStatus = { wished: false, dropPercent: 0, likeCount: 0 }

const pendingIds = new Set<string>()
const listeners = new Map<string, Set<Listener>>()
let inflight: Promise<void> | null = null
let eventBridgeReady = false
let idleFlushScheduled = false
let deferInitialFlush = true

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "unknown"
  }
}

/** Re-fetch wishlist status for subscribers (e.g. after Pulse save-drop). */
export function invalidateWishlistStatus(productId: string): void {
  const id = productId.trim()
  if (!id || !listeners.has(id)) return
  pendingIds.add(id)
  scheduleFlush({ immediate: true })
}

function ensureWishlistEventBridge(): void {
  if (eventBridgeReady || typeof window === "undefined") return
  eventBridgeReady = true
  window.addEventListener(BUYER_WISHLIST_UPDATED_EVENT, (event) => {
    const detail = (event as CustomEvent<BuyerWishlistUpdatedDetail>).detail
    if (!detail?.productId) return
    invalidateWishlistStatus(detail.productId)
  })
}

function emit(productId: string, status: WishlistCardStatus) {
  for (const fn of listeners.get(productId) ?? []) {
    queueMicrotask(() => {
      try {
        fn(status)
      } catch (error) {
        // Never let a card listener poison the batch (Next overlay on console.error).
        console.log("[wishlist-status-batch]", {
          productId,
          result: "listener_error",
          message: errorMessage(error),
        })
      }
    })
  }
}

async function fetchChunk(chunk: string[]): Promise<Record<string, WishlistCardStatus>> {
  const merged: Record<string, WishlistCardStatus> = {}
  let res: Response
  try {
    res = await fetch("/api/wishlist/status", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: chunk }),
    })
  } catch (error) {
    console.log("[wishlist-status-batch]", {
      idCount: chunk.length,
      result: "network_error",
      message: errorMessage(error),
    })
    return merged
  }

  if (!res.ok) {
    console.log("[wishlist-status-batch]", {
      idCount: chunk.length,
      result: "http_error",
      status: res.status,
    })
    return merged
  }

  try {
    const data = (await res.json()) as {
      statuses?: Record<string, { wished?: boolean; dropPercent?: number; likeCount?: number }>
    }
    for (const [id, row] of Object.entries(data.statuses ?? {})) {
      merged[id] = {
        wished: Boolean(row?.wished),
        dropPercent: Number(row?.dropPercent ?? 0),
        likeCount: Math.max(0, Number(row?.likeCount ?? 0)),
      }
    }
  } catch (error) {
    console.log("[wishlist-status-batch]", {
      idCount: chunk.length,
      result: "parse_error",
      message: errorMessage(error),
    })
  }
  return merged
}

async function fetchStatuses(ids: string[]): Promise<Record<string, WishlistCardStatus>> {
  const merged: Record<string, WishlistCardStatus> = {}
  for (let offset = 0; offset < ids.length; offset += BATCH_CHUNK) {
    const chunk = ids.slice(offset, offset + BATCH_CHUNK)
    Object.assign(merged, await fetchChunk(chunk))
  }
  return merged
}

async function flush() {
  const ids = [...pendingIds]
  pendingIds.clear()
  if (ids.length === 0) return

  try {
    const statuses = await fetchStatuses(ids)
    for (const id of ids) {
      emit(id, statuses[id] ?? EMPTY_STATUS)
    }
  } catch (error) {
    // Soft-fail only — console.error would open the Next.js dev overlay on marketplace.
    console.log("[wishlist-status-batch]", {
      idCount: ids.length,
      result: "flush_error",
      message: errorMessage(error),
    })
    for (const id of ids) emit(id, EMPTY_STATUS)
  }
}

function runFlush() {
  if (inflight) return
  inflight = Promise.resolve()
    .then(() => flush())
    .finally(() => {
      inflight = null
    })
}

function scheduleFlush(options?: { immediate?: boolean }) {
  if (options?.immediate) {
    deferInitialFlush = false
    runFlush()
    return
  }

  if (deferInitialFlush) {
    if (!idleFlushScheduled) {
      idleFlushScheduled = true
      scheduleIdleTask(() => {
        deferInitialFlush = false
        idleFlushScheduled = false
        runFlush()
      }, IDLE_FLUSH_MS, IDLE_FLUSH_FALLBACK_MS)
    }
    return
  }

  runFlush()
}

export function subscribeWishlistStatus(
  productId: string,
  listener: Listener
): () => void {
  ensureWishlistEventBridge()
  const id = productId.trim()
  if (!id) return () => {}

  let set = listeners.get(id)
  if (!set) {
    set = new Set()
    listeners.set(id, set)
  }
  set.add(listener)

  pendingIds.add(id)
  scheduleFlush()

  return () => {
    set?.delete(listener)
    if (set?.size === 0) listeners.delete(id)
  }
}

/** Test hook */
export function resetWishlistStatusBatchForTests(): void {
  pendingIds.clear()
  listeners.clear()
  inflight = null
  eventBridgeReady = false
  idleFlushScheduled = false
  deferInitialFlush = true
}
