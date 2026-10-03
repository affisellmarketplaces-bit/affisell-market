/**
 * Per-product reseller exclusivity — pure rules (no Prisma value imports, client-safe).
 *
 * A supplier grants ONE reseller exclusive rights on a product for a fixed term. While it is active nobody else can
 * list (create or publish) that product; expiry is evaluated from the date, so there is no cron to keep in sync.
 *
 * Defaults (deliberate, documented here and in the supplier UI):
 *  - term: 7–365 days, 90 by default;
 *  - the HOLDER may release at any time; the SUPPLIER may revoke only inside a short cooling-off window after the
 *    grant (a mis-click), because a commitment the supplier can drop whenever a product gets hot is worthless to the
 *    reseller who invests in marketing it;
 *  - granting is refused while other resellers already list the product, unless the supplier explicitly asks to
 *    remove them (they are unlisted — never deleted — and notified).
 */

import type { Prisma } from "@prisma/client"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const EXCLUSIVITY_MIN_DAYS = 7
export const EXCLUSIVITY_MAX_DAYS = 365
export const EXCLUSIVITY_DEFAULT_DAYS = 90
export const EXCLUSIVITY_SUPPLIER_REVOKE_WINDOW_HOURS = 48
export const EXCLUSIVITY_REQUEST_MESSAGE_MAX = 500

export type ProductExclusivityFields = {
  exclusiveAffiliateId?: string | null
  exclusiveUntil?: Date | string | null
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** The reseller holding an ACTIVE exclusivity, or null (no grant, or it has expired). */
export function exclusiveHolderOf(product: ProductExclusivityFields, now: Date = new Date()): string | null {
  const holder = product.exclusiveAffiliateId?.trim()
  const until = toMs(product.exclusiveUntil)
  if (!holder || until == null || until <= now.getTime()) return null
  return holder
}

export function isExclusivityActive(product: ProductExclusivityFields, now: Date = new Date()): boolean {
  return exclusiveHolderOf(product, now) !== null
}

/** True when an active exclusivity belongs to someone ELSE — this reseller must not list the product. */
export function exclusivityBlocksAffiliate(
  product: ProductExclusivityFields,
  affiliateId: string,
  now: Date = new Date()
): boolean {
  const holder = exclusiveHolderOf(product, now)
  return holder !== null && holder !== affiliateId
}

/** Whole days within [min, max]; anything unusable falls back to the default. */
export function clampExclusivityDays(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : raw
  if (typeof n !== "number" || !Number.isFinite(n)) return EXCLUSIVITY_DEFAULT_DAYS
  return Math.min(EXCLUSIVITY_MAX_DAYS, Math.max(EXCLUSIVITY_MIN_DAYS, Math.round(n)))
}

export function exclusivityEndsAt(from: Date, days: number): Date {
  return new Date(from.getTime() + clampExclusivityDays(days) * DAY_MS)
}

/** The supplier can undo a grant only shortly after making it; after that only the holder can release. */
export function canSupplierRevokeExclusivity(
  grantedAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const at = toMs(grantedAt)
  if (at == null) return false
  return now.getTime() - at <= EXCLUSIVITY_SUPPLIER_REVOKE_WINDOW_HOURS * HOUR_MS
}

/**
 * Catalogue filter for a reseller: hide products exclusive to someone else (they cannot be added anyway), keep
 * open products, expired grants and the reseller's own exclusives.
 */
export function catalogExclusivityWhere(affiliateId: string, now: Date = new Date()): Prisma.ProductWhereInput {
  return {
    OR: [
      { exclusiveAffiliateId: null },
      { exclusiveUntil: null },
      { exclusiveUntil: { lte: now } },
      { exclusiveAffiliateId: affiliateId },
    ],
  }
}

export type AffiliateExclusivityState = "none" | "mine" | "other" | "requested"

/** What a reseller sees for one product. `requested` = they asked and the supplier has not answered. */
export function affiliateExclusivityState(args: {
  product: ProductExclusivityFields
  affiliateId: string
  hasOpenRequest: boolean
  now?: Date
}): AffiliateExclusivityState {
  const holder = exclusiveHolderOf(args.product, args.now ?? new Date())
  if (holder === args.affiliateId) return "mine"
  if (holder) return "other"
  return args.hasOpenRequest ? "requested" : "none"
}

/** Standard 409 body for a blocked listing attempt. */
export function exclusivityConflictBody(until: Date) {
  return {
    error: "product_exclusive",
    message: `Ce produit est en exclusivité chez un autre revendeur jusqu'au ${until.toISOString().slice(0, 10)}.`,
    until: until.toISOString(),
  }
}

/**
 * For routes that already loaded the product row: the 409 body when someone ELSE holds an active exclusivity on it,
 * otherwise null. No extra query.
 */
export function exclusivityBlockBody(
  product: ProductExclusivityFields,
  affiliateId: string,
  now: Date = new Date()
): ReturnType<typeof exclusivityConflictBody> | null {
  if (!exclusivityBlocksAffiliate(product, affiliateId, now)) return null
  const until = toMs(product.exclusiveUntil)
  return until == null ? null : exclusivityConflictBody(new Date(until))
}
