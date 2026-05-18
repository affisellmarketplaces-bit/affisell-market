export type ProductCardViewMode = "customer" | "merchant"

export type ResolveProductCardViewModeInput = {
  /** Explicit override from parent (wins over path heuristics). */
  viewMode?: ProductCardViewMode
  pathname?: string | null
  role?: string | null
  previewAsCustomer?: boolean
}

export function normalizeUserRole(role: string | null | undefined): string | null {
  if (!role || typeof role !== "string") return null
  return role.trim().toUpperCase() || null
}

export function isAffiliateRole(role: string | null | undefined): boolean {
  return role?.trim().toLowerCase() === "affiliate"
}

export function isSupplierRole(role: string | null | undefined): boolean {
  const r = role?.trim().toLowerCase()
  return r === "supplier"
}

export function isMerchantRole(role: string | null | undefined): boolean {
  return isAffiliateRole(role) || isSupplierRole(role)
}

/** True when margin / sold count / supplier line may be shown on product cards. */
export function showMerchantProductCardFields(viewMode: ProductCardViewMode): boolean {
  return viewMode === "merchant"
}

export function resolveProductCardViewMode(input: ResolveProductCardViewModeInput): ProductCardViewMode {
  if (input.viewMode) return input.viewMode
  if (input.previewAsCustomer) return "customer"

  const path = (input.pathname ?? "").split("?")[0] ?? ""

  if (/^\/shop\/[^/]+\/product\/[^/]+/.test(path)) {
    return "customer"
  }

  if (path === "/marketplace" || path.startsWith("/marketplace/")) {
    if (isMerchantRole(input.role) && !input.previewAsCustomer) {
      return "merchant"
    }
    return "customer"
  }

  return "customer"
}

export const PREVIEW_AS_CUSTOMER_STORAGE_KEY = "affisell-preview-as-customer"
