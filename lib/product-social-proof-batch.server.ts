import type { ProductSocialProofData } from "@/lib/product-social-proof-shared"
import { loadProductCrossSocialProofCached } from "@/lib/product-social-proof.server"

const BATCH_MAX = 36

/** Batch load — each id hits its own 120s cache slice. */
export async function loadProductCrossSocialProofBatch(
  productIds: string[]
): Promise<Record<string, ProductSocialProofData>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))].slice(0, BATCH_MAX)
  if (ids.length === 0) return {}

  const rows = await Promise.all(
    ids.map(async (id) => {
      const data = await loadProductCrossSocialProofCached(id)
      return [id, data] as const
    })
  )

  return Object.fromEntries(rows)
}
