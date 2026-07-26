/**
 * Diversify Radar winners so one marketplace (e.g. Amazon) cannot monopolize the feed.
 * Round-robin across marketplaceId after sorting each bucket by demand.
 */

export type DiversifiableRow = {
  marketplaceId: string
  salesEst: number | null
  rank: number | null
}

function demandKey(row: DiversifiableRow): number {
  if (row.salesEst != null && Number.isFinite(row.salesEst)) return row.salesEst
  if (row.rank != null && row.rank > 0) return Math.max(0, 10_000 - row.rank)
  return 0
}

function sortByDemand<T extends DiversifiableRow>(a: T, b: T): number {
  const d = demandKey(b) - demandKey(a)
  if (d !== 0) return d
  const ra = a.rank ?? 9999
  const rb = b.rank ?? 9999
  return ra - rb
}

/**
 * Round-robin pick across marketplaces (maxShare cap optional).
 */
export function diversifyByMarketplace<T extends DiversifiableRow>(
  rows: T[],
  take: number,
  opts?: { maxShare?: number }
): T[] {
  if (take <= 0 || rows.length === 0) return []
  if (rows.length <= take) {
    // Still re-order for fair mix when list is short.
  }

  const byMkt = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.marketplaceId.trim().toLowerCase() || "unknown"
    const list = byMkt.get(key) ?? []
    list.push(row)
    byMkt.set(key, list)
  }

  for (const list of byMkt.values()) {
    list.sort(sortByDemand)
  }

  const keys = [...byMkt.keys()].sort((a, b) => {
    const da = demandKey(byMkt.get(a)![0]!)
    const db = demandKey(byMkt.get(b)![0]!)
    return db - da
  })

  const maxShare = opts?.maxShare ?? 0.45
  const maxPer = Math.max(2, Math.floor(take * maxShare))
  const counts = new Map<string, number>()
  const indices = new Map<string, number>()
  for (const k of keys) {
    counts.set(k, 0)
    indices.set(k, 0)
  }

  const out: T[] = []
  let progressed = true
  while (out.length < take && progressed) {
    progressed = false
    for (const k of keys) {
      if (out.length >= take) break
      const used = counts.get(k) ?? 0
      if (used >= maxPer) continue
      const list = byMkt.get(k) ?? []
      const idx = indices.get(k) ?? 0
      if (idx >= list.length) continue
      out.push(list[idx]!)
      indices.set(k, idx + 1)
      counts.set(k, used + 1)
      progressed = true
    }
  }

  // Fill remaining slots ignoring cap (still round-robin).
  progressed = true
  while (out.length < take && progressed) {
    progressed = false
    for (const k of keys) {
      if (out.length >= take) break
      const list = byMkt.get(k) ?? []
      const idx = indices.get(k) ?? 0
      if (idx >= list.length) continue
      out.push(list[idx]!)
      indices.set(k, idx + 1)
      progressed = true
    }
  }

  return out
}

export function marketplaceMixSummary<T extends DiversifiableRow>(
  rows: T[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const k = row.marketplaceId.trim().toLowerCase() || "unknown"
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}
