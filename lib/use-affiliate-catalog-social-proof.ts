"use client"

import { useEffect, useMemo, useState } from "react"

import type { ProductSocialProofData } from "@/lib/product-social-proof-shared"
import { fetchProductSocialProofBatch } from "@/lib/product-social-proof-batch-client"

/** Loads cross-reseller FOMO for visible Discover catalog cards (one batch request). */
export function useAffiliateCatalogSocialProof(productIds: string[]) {
  const key = useMemo(
    () => [...new Set(productIds.map((id) => id.trim()).filter(Boolean))].sort().join(","),
    [productIds]
  )

  const [map, setMap] = useState<Record<string, ProductSocialProofData>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!key) {
      setMap({})
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchProductSocialProofBatch(key.split(","))
      .then((items) => {
        if (!cancelled) setMap(items)
      })
      .catch((e: unknown) => {
        console.log("[affiliate-catalog-social-proof]", {
          result: "batch_failed",
          error: e instanceof Error ? e.message : String(e),
        })
        if (!cancelled) setMap({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [key])

  return { socialProofByProductId: map, socialProofLoading: loading }
}
