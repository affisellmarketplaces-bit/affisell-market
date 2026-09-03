/** Client helper — supplier product recall (unlist partners, draft SKU). */

export type SupplierProductRecallClientResult =
  | { ok: true; listedAffiliatesUnlisted: number }
  | { ok: false; error: string }

export async function recallSupplierProductClient(
  productId: string
): Promise<SupplierProductRecallClientResult> {
  try {
    const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}/recall`, {
      method: "POST",
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      listedAffiliatesUnlisted?: number
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Rappel impossible" }
    }
    return {
      ok: true,
      listedAffiliatesUnlisted: data.listedAffiliatesUnlisted ?? 0,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Rappel impossible",
    }
  }
}
