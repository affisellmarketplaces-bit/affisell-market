/**
 * How a supplier is named to anyone who is not that supplier or an Affisell admin
 * (resellers, buyers, the assistant). Founder decision 2026-11-19:
 *
 * - the supplier's STORE name when it has one;
 * - otherwise « Fournisseur Affisell » — never the account e-mail, never the
 *   person's own name: direct supplier contacts are not disclosed by default,
 *   the conversation goes through Affisell's own channels (product requests,
 *   order messages), which keep a trace.
 *
 * Pure and client-safe. The function deliberately takes only the store, so a
 * caller can not pass an e-mail by mistake.
 */

/** Default wording (French — the founder's wording). Client UIs translate `affiliate.supplierAffisell`. */
export const AFFISELL_SUPPLIER_FALLBACK_LABEL = "Fournisseur Affisell"

const MAX_LABEL = 80

/** The supplier's public store name, or null when it has none (blank, or shaped like an e-mail). */
export function resellerFacingSupplierName(
  store: { name?: string | null } | null | undefined
): string | null {
  const raw = typeof store?.name === "string" ? store.name.trim() : ""
  if (!raw) return null
  // A store named with an e-mail address would leak the contact all the same.
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(raw)) return null
  return raw.length > MAX_LABEL ? `${raw.slice(0, MAX_LABEL - 1)}…` : raw
}

/** Store name, or the « Fournisseur Affisell » fallback (pass a translated fallback when you have one). */
export function resellerFacingSupplierLabel(
  store: { name?: string | null } | null | undefined,
  fallback: string = AFFISELL_SUPPLIER_FALLBACK_LABEL
): string {
  return resellerFacingSupplierName(store) ?? fallback
}
