/** Opens the global mobile buyer hub drawer (PublicNav ☰ + catalog toolbar). */
export const MOBILE_BUYER_HUB_OPEN_EVENT = "affisell:mobile-buyer-hub-open"

export function openMobileBuyerHub(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(MOBILE_BUYER_HUB_OPEN_EVENT))
}
