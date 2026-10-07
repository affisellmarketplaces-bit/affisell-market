"use client"

import { useEffect, useState } from "react"

type Rate = { bps: number } | null
const cache = new Map<string, Promise<Rate>>()

function load(categoryId: string): Promise<Rate> {
  let p = cache.get(categoryId)
  if (!p) {
    p = fetch(`/api/supplier/category-affisell-commission?categoryId=${encodeURIComponent(categoryId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { supplierCatalogFeeBps?: number; effectiveBps?: number } | null): Rate => {
        const bps = j?.supplierCatalogFeeBps ?? j?.effectiveBps
        return typeof bps === "number" && Number.isFinite(bps) ? { bps } : null
      })
      .catch((): Rate => null)
    cache.set(categoryId, p)
  }
  return p
}

/**
 * The Affisell fee (bps) this supplier is charged on the catalogue channel for a category: `null` while it is unknown (no
 * category chosen, loading, or the lookup failed) — callers then show the net BEFORE the fee instead of inventing a rate.
 */
export function useSupplierFeeBps(categoryId: string): { bps: number | null; loading: boolean } {
  const id = categoryId.trim()
  const [state, setState] = useState<{ id: string; bps: number | null } | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    void load(id).then((r) => alive && setState({ id, bps: r?.bps ?? null }))
    return () => {
      alive = false
    }
  }, [id])

  if (!id) return { bps: null, loading: false }
  if (state?.id !== id) return { bps: null, loading: true }
  return { bps: state.bps, loading: false }
}
