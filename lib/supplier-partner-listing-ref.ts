import { createHash } from "node:crypto"

import { signingSecret } from "@/lib/security/app-secret"

/**
 * Opaque handle shown to suppliers when a partner has listed their SKU.
 * Does not reveal marketplace URL, partner identity, or resale price.
 * Affisell support can resolve: load `AffiliateProduct` rows for the product and
 * match `supplierFacingPartnerListingRef(row.id)` to this value.
 */
export function supplierFacingPartnerListingRef(listingId: string): string {
  // Fails closed outside development / test: the literal is public (lib/security/app-secret.ts).
  const secret = signingSecret(
    "supplier partner listing refs",
    ["SUPPLIER_PARTNER_LISTING_REF_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"],
    "affisell-dev-supplier-partner-ref"
  )
  const raw = createHash("sha256").update(secret).update("\0").update(listingId).digest("hex")
  return `APS-${raw.slice(0, 12).toUpperCase()}`
}
