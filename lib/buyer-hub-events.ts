/** Opens the global mobile buyer hub drawer (PublicNav ☰ + catalog toolbar). */
export const MOBILE_BUYER_HUB_OPEN_EVENT = "affisell:mobile-buyer-hub-open"

/** Opens the full-screen mobile search overlay (header 🔍). */
export const MOBILE_SEARCH_OPEN_EVENT = "affisell:mobile-search-open"

export function openMobileBuyerHub(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(MOBILE_BUYER_HUB_OPEN_EVENT))
}

export function openMobileSearch(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(MOBILE_SEARCH_OPEN_EVENT))
}
