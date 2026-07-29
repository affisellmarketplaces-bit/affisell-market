/**
 * Affisell role × feature matrix — client-safe (no Prisma).
 * Single source of truth for what each interface may surface in discovery UI
 * (nav, ⌘K, Magic Lab). Dashboard route guards stay in dashboard-session.
 */

export type AffisellUiRole = "CUSTOMER" | "SUPPLIER" | "AFFILIATE" | "GUEST" | "ADMIN" | "AGENT"

export type FeatureAudience = "buyer" | "supplier" | "affiliate" | "merchant" | "public" | "acquisition"

export type FeatureSurfaceId =
  | "marketplace"
  | "pulseDiscover"
  | "auctions"
  | "luxe"
  | "cartWishlistOrders"
  | "agentShopping"
  | "magicLab"
  | "dropforge"
  | "affisellStock"
  | "supplyHub"
  | "supplierImport"
  | "radarOps"
  | "brandStudio"
  | "swipeHub"
  | "battle"
  | "affiliateCatalog"
  | "sellAcquisition"

/** High-level catalog for product / ops reviews. */
export const ROLE_FEATURE_MATRIX: Record<
  FeatureSurfaceId,
  { audience: FeatureAudience; buyerVisible: boolean; note: string }
> = {
  marketplace: { audience: "buyer", buyerVisible: true, note: "Core buyer catalog" },
  pulseDiscover: { audience: "buyer", buyerVisible: true, note: "Public Pulse feed" },
  auctions: { audience: "buyer", buyerVisible: true, note: "Buyer auctions" },
  luxe: { audience: "buyer", buyerVisible: true, note: "Buyer luxe" },
  cartWishlistOrders: { audience: "buyer", buyerVisible: true, note: "Buyer commerce" },
  agentShopping: { audience: "buyer", buyerVisible: true, note: "Buyer agent" },
  magicLab: {
    audience: "merchant",
    buyerVisible: false,
    note: "Magic Lab directory — merchants only in chrome; /lab role-filters content",
  },
  dropforge: { audience: "supplier", buyerVisible: false, note: "Supplier DropForge" },
  affisellStock: { audience: "supplier", buyerVisible: false, note: "Supplier Affisell Stock" },
  supplyHub: { audience: "supplier", buyerVisible: false, note: "Supplier Supply Hub" },
  supplierImport: { audience: "supplier", buyerVisible: false, note: "Supplier import suite" },
  radarOps: {
    audience: "merchant",
    buyerVisible: false,
    note: "Radar ops for merchants; public /radar marketing stays acquisition",
  },
  brandStudio: { audience: "affiliate", buyerVisible: false, note: "Reseller Brand Studio" },
  swipeHub: { audience: "affiliate", buyerVisible: false, note: "Reseller Swipe Hub" },
  battle: { audience: "affiliate", buyerVisible: false, note: "Affiliate Pulse Battle" },
  affiliateCatalog: { audience: "affiliate", buyerVisible: false, note: "Reseller catalog" },
  sellAcquisition: {
    audience: "acquisition",
    buyerVisible: true,
    note: "/sell signup CTAs OK for buyers/guests",
  },
}

export function normalizeUiRole(role: string | null | undefined): AffisellUiRole {
  const r = (role ?? "").trim().toUpperCase()
  if (r === "SUPPLIER") return "SUPPLIER"
  if (r === "AFFILIATE") return "AFFILIATE"
  if (r === "ADMIN") return "ADMIN"
  if (r === "AGENT") return "AGENT"
  if (r === "CUSTOMER") return "CUSTOMER"
  return "GUEST"
}

export function isMerchantUiRole(role: string | null | undefined): boolean {
  const r = normalizeUiRole(role)
  return r === "SUPPLIER" || r === "AFFILIATE" || r === "ADMIN"
}

/** Show Magic Lab / merchant ops chrome (nav pill, footer product link). */
export function canSeeMagicLabChrome(role: string | null | undefined): boolean {
  return isMerchantUiRole(role)
}

/** Soft: hide heavy B2B home Radar bands for logged-in buyers. */
export function canSeeHomeMerchantRadar(role: string | null | undefined): boolean {
  const r = normalizeUiRole(role)
  return r !== "CUSTOMER"
}
