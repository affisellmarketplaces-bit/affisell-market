import type { MarginAnalysisResponse } from "@/lib/ai/smart-margin-types"

export async function fetchSmartMarginAnalysis(body: {
  productId?: string
  categoryId?: string
  title?: string
  catalogPriceEur?: number
  userMargin: number
}): Promise<{ ok: boolean; status: number; data: MarginAnalysisResponse | { error?: string } }> {
  try {
    const res = await fetch("/api/ai/margin-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as MarginAnalysisResponse | { error?: string }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: "network_error" } }
  }
}
