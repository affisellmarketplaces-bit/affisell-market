/**
 * Who changed a listing's presence in a shop — the values a writer may declare for its transaction (the database
 * trigger of migration 20261124090000_listing_presence_history records them). Undeclared: the trigger falls back to the
 * price-history declaration of the same transaction (the listing editor declares `reseller_ui`), else `unattributed`.
 * Pure.
 */
export const LISTING_PRESENCE_SOURCES = [
  "reseller_ui", // the reseller's own listing editor / listings API (also inherited from the price-history declaration)
  "reseller_bulk", // the reseller's bulk list / unlist / delete action
  "reseller_remove", // the reseller removed a listing (deleted or unlisted when orders reference it)
  "listing_create", // a listing created (catalogue add, quick add, invitation, URL import…)
  "replacement", // withdraw / replace an unsellable product (reseller-confirmed)
  "admin_review", // an admin decision on a reseller URL import (approve / publish / reject)
  "exclusivity", // a product made exclusive to another reseller
  "supplier_withdrawal", // the supplier removed / archived its product
  "import", // bulk / Radar / URL imports
  "admin", // another admin action
  "account_deletion", // a merchant deleted its account (its listings, or the listings of its products, are deleted)
  "demo", // the Demo Lab fixtures (kept apart from real activity)
  "script", // a maintenance or seed script
  "unattributed", // written without a declaration (default of the trigger)
] as const

export type ListingPresenceSource = (typeof LISTING_PRESENCE_SOURCES)[number]

const ACTOR_RE = /^[A-Za-z0-9_:-]{1,64}$/

export function isListingPresenceSource(v: unknown): v is ListingPresenceSource {
  return typeof v === "string" && (LISTING_PRESENCE_SOURCES as readonly string[]).includes(v)
}

export function sanitizePresenceActor(v: unknown): string | null {
  return typeof v === "string" && ACTOR_RE.test(v.trim()) ? v.trim() : null
}
