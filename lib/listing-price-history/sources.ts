/**
 * Who changed a reseller's selling price — the values a writer may declare for its transaction (the database trigger
 * of migration 20261117090000_listing_price_history records them; anything undeclared is "unattributed"). Pure.
 */
export const LISTING_PRICE_SOURCES = [
  "reseller_ui", // the reseller's own listing editor / listings API
  "listing_create", // a listing created (catalogue add, quick add, invitation, URL import…)
  "margin_auto_fix", // the reseller clicked "fix my margins" (reseller-approved automation)
  "auto_adjust", // the variant auto-adjust cron (only for listings where the reseller switched pricingAutoAdjust on)
  "import", // bulk / Radar / URL imports
  "admin", // an admin action
  "script", // a maintenance or seed script
  "unattributed", // written without a declaration (default of the trigger)
] as const

export type ListingPriceSource = (typeof LISTING_PRICE_SOURCES)[number]

const ACTOR_RE = /^[A-Za-z0-9_:-]{1,64}$/

export function isListingPriceSource(v: unknown): v is ListingPriceSource {
  return typeof v === "string" && (LISTING_PRICE_SOURCES as readonly string[]).includes(v)
}

/** The actor id as the trigger will keep it (it drops anything else). */
export function sanitizeListingPriceActor(v: unknown): string | null {
  return typeof v === "string" && ACTOR_RE.test(v.trim()) ? v.trim() : null
}
