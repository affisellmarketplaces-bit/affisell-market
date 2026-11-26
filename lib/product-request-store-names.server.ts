import "server-only"

import { prisma } from "@/lib/prisma"
import { resellerFacingSupplierName } from "@/lib/supplier-public-label"

/**
 * Public store names of the suppliers who quoted, for the reseller's quote list.
 * A quote used to carry the supplier's account e-mail and personal name; the
 * reseller now sees the store name or « Fournisseur Affisell » (founder decision
 * 2026-11-19). A failed read = no names (the UI falls back), never an error.
 */
export async function loadSupplierStoreNames(supplierIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(supplierIds.filter((id) => typeof id === "string" && id))]
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  try {
    const stores = await prisma.store.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, name: true },
    })
    for (const s of stores) {
      const name = resellerFacingSupplierName(s)
      if (name) out.set(s.userId, name)
    }
  } catch (err) {
    console.warn("[product-request] store_names_unavailable", err instanceof Error ? err.message : "unknown")
  }
  return out
}
