import type { SupplierBulkDeleteDraftsResult } from "@/lib/supplier-delete-drafts-shared"

export async function bulkDeleteSupplierDraftsClient(
  ids: string[]
): Promise<SupplierBulkDeleteDraftsResult & { error?: string }> {
  if (ids.length === 0) {
    return { deleted: [], skipped: [] }
  }

  try {
    const res = await fetch("/api/supplier/products/bulk-delete-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids }),
    })
    const json = (await res.json().catch(() => ({}))) as SupplierBulkDeleteDraftsResult & {
      error?: string
    }
    if (!res.ok) {
      return {
        deleted: [],
        skipped: [],
        error: typeof json.error === "string" ? json.error : "Suppression impossible.",
      }
    }
    return {
      deleted: Array.isArray(json.deleted) ? json.deleted : [],
      skipped: Array.isArray(json.skipped) ? json.skipped : [],
    }
  } catch {
    return { deleted: [], skipped: [], error: "Erreur réseau — réessayez." }
  }
}
