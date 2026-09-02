import type { ProductSocialProofData } from "@/lib/product-social-proof-shared"

export async function fetchProductSocialProofBatch(
  productIds: string[]
): Promise<Record<string, ProductSocialProofData>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return {}

  const res = await fetch("/api/product-social-proof/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productIds: ids }),
  })
  const data = (await res.json()) as {
    error?: string
    items?: Record<
      string,
      {
        active_resellers_count: number
        avg_margin: number
        top_margin: number
        last_sale_at: string | null
        last_sale_reseller_label: string | null
      }
    >
  }
  if (!res.ok || !data.items) {
    throw new Error(data.error ?? "Batch social proof failed")
  }

  const out: Record<string, ProductSocialProofData> = {}
  for (const [id, row] of Object.entries(data.items)) {
    out[id] = {
      activeResellersCount: row.active_resellers_count,
      avgMarginCents: row.avg_margin,
      topMarginCents: row.top_margin,
      lastSaleAt: row.last_sale_at,
      lastSaleResellerLabel: row.last_sale_reseller_label,
    }
  }
  return out
}
