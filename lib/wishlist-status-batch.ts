/** Coalesce per-card wishlist polls into one API call (marketplace grid). */

export type WishlistCardStatus = {
  wished: boolean
  dropPercent: number
  likeCount: number
}

type Listener = (status: WishlistCardStatus) => void

let pendingIds = new Set<string>()
const listeners = new Map<string, Set<Listener>>()
let inflight: Promise<void> | null = null

function emit(productId: string, status: WishlistCardStatus) {
  for (const fn of listeners.get(productId) ?? []) {
    fn(status)
  }
}

async function flush() {
  const ids = [...pendingIds]
  pendingIds.clear()
  if (ids.length === 0) return

  try {
    const res = await fetch(`/api/wishlist?ids=${encodeURIComponent(ids.join(","))}`, {
      credentials: "include",
    })
    if (!res.ok) {
      for (const id of ids) emit(id, { wished: false, dropPercent: 0, likeCount: 0 })
      return
    }
    const data = (await res.json()) as {
      statuses?: Record<string, { wished?: boolean; dropPercent?: number; likeCount?: number }>
    }
    const statuses = data.statuses ?? {}
    for (const id of ids) {
      const row = statuses[id]
      emit(id, {
        wished: Boolean(row?.wished),
        dropPercent: Number(row?.dropPercent ?? 0),
        likeCount: Math.max(0, Number(row?.likeCount ?? 0)),
      })
    }
  } catch {
    for (const id of ids) emit(id, { wished: false, dropPercent: 0, likeCount: 0 })
  }
}

function scheduleFlush() {
  if (inflight) return
  inflight = new Promise<void>((resolve) => {
    queueMicrotask(() => {
      inflight = null
      void flush().finally(resolve)
    })
  })
}

export function subscribeWishlistStatus(
  productId: string,
  listener: Listener
): () => void {
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
}
