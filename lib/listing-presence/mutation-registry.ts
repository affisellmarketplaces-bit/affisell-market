/**
 * EVERY code path that can change the life of a reseller listing (`AffiliateProduct`: creation, listing, unlisting,
 * relisting, deletion) and how its provenance reaches the presence history. Pure data.
 *
 * It is not documentation only: `listing-mutation-provenance.test.ts` scans the repository with the TypeScript parser
 * (`lib/testing/listing-mutation-scan.ts`) and fails when
 *  - a write that may change a listing's life exists and is NOT in this registry (a new path, an extra call),
 *  - an entry no longer matches a write (stale),
 *  - a path said « declared » does not declare, or declares another source than the one written here,
 *  - a path inherits a price source the presence history does not know,
 *  - an application path (app/, lib/) is left without provenance.
 * Writes that provably do not touch `isListed` (an update whose `data` literal has no `isListed`) are not listed.
 *
 * `key` = file#enclosing function#method[#rank] — stable when lines move, changed when the code really changes.
 */
import type { ListingPresenceSource } from "./sources"

export type ListingLifecycleChange = "create" | "list" | "unlist" | "relist" | "delete"
export type ListingMutationActor = "reseller" | "supplier" | "admin" | "merchant_account" | "import" | "script" | "demo"

export type ListingMutationEntry = {
  key: string
  changes: readonly ListingLifecycleChange[]
  actor: ListingMutationActor
  /** Where the action comes from (route, job, script, function called by…). */
  entry: string
  /**
   * declared = the write declares its source in its own transaction; inherited_price_source = declared through the
   * price-history helper (the trigger falls back to it); wrapper = a helper whose callers are listed themselves.
   */
  attribution: "declared" | "inherited_price_source" | "wrapper"
  sources: readonly ListingPresenceSource[]
  note?: string
}

export const LISTING_MUTATION_REGISTRY: readonly ListingMutationEntry[] = [
  // ── Reseller ────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: "app/api/affiliate/add/route.ts#POST#upsert", changes: ["create", "relist"], actor: "reseller", entry: "POST /api/affiliate/add", attribution: "declared", sources: ["listing_create"] },
  { key: "app/api/affiliate/products/add/route.ts#POST#upsert", changes: ["create", "relist"], actor: "reseller", entry: "POST /api/affiliate/products/add", attribution: "declared", sources: ["listing_create"] },
  { key: "app/api/affiliate/listings/route.ts#POST#upsertListingWithPriceSource", changes: ["create", "relist"], actor: "reseller", entry: "POST /api/affiliate/listings", attribution: "inherited_price_source", sources: ["listing_create"] },
  { key: "app/api/affiliate/listings/[id]/route.ts#PATCH#updateListingWithPriceSource", changes: ["list", "unlist", "relist"], actor: "reseller", entry: "PATCH /api/affiliate/listings/[id] (listing editor)", attribution: "inherited_price_source", sources: ["reseller_ui"] },
  { key: "app/api/affiliate/products/[id]/route.ts#PATCH#updateListingWithPriceSource", changes: ["list", "unlist", "relist"], actor: "reseller", entry: "PATCH /api/affiliate/products/[id]", attribution: "inherited_price_source", sources: ["reseller_ui"] },
  { key: "app/api/affiliate/products/bulk/route.ts#PATCH#updateMany#2", changes: ["list", "unlist", "relist"], actor: "reseller", entry: "PATCH /api/affiliate/products/bulk", attribution: "declared", sources: ["reseller_bulk"] },
  { key: "lib/affiliate-listing-remove.ts#removeAffiliateListingsFromStorefront#deleteMany", changes: ["delete"], actor: "reseller", entry: "reseller removes listings (no order references them)", attribution: "declared", sources: ["reseller_remove"] },
  { key: "lib/affiliate-listing-remove.ts#removeAffiliateListingsFromStorefront#updateMany", changes: ["unlist"], actor: "reseller", entry: "reseller removes listings (orders reference them → unlisted)", attribution: "declared", sources: ["reseller_remove"] },
  { key: "lib/affiliate-publish-listing.server.ts#publishAffiliateListingIfAllowed#update", changes: ["list", "relist"], actor: "reseller", entry: "reseller publishes one listing", attribution: "declared", sources: ["reseller_ui"] },
  { key: "lib/affiliate-publish-listing.server.ts#syncAffiliateStorefrontListingsLive#updateMany", changes: ["list", "relist"], actor: "reseller", entry: "reseller puts its storefront live", attribution: "declared", sources: ["reseller_ui"] },
  { key: "lib/affiliate-quick-add-listing.server.ts#quickAddAffiliateListing#create", changes: ["create"], actor: "reseller", entry: "quick add (catalogue, copilot, replacement, shop demand)", attribution: "declared", sources: ["listing_create"] },
  { key: "lib/reseller-replacement/replace.server.ts#withdrawReplacedListing#updateMany", changes: ["unlist"], actor: "reseller", entry: "replace an unsellable product (confirmed)", attribution: "declared", sources: ["replacement"] },
  { key: "lib/reseller-replacement/replace.server.ts#withdrawListing#updateMany", changes: ["unlist"], actor: "reseller", entry: "withdraw an unsellable product (confirmed)", attribution: "declared", sources: ["replacement"] },
  { key: "lib/supplier-invitation-affiliate-listing.ts#ensureInviterDraftListingForInvite#create", changes: ["create"], actor: "reseller", entry: "listing created by a supplier invitation", attribution: "declared", sources: ["listing_create"] },
  { key: "lib/product-request-commission.server.ts#createProductRequestCommissionDraft#create", changes: ["create"], actor: "reseller", entry: "listing created from a product-request quote", attribution: "declared", sources: ["listing_create"] },
  // ── Imports ─────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: "lib/affiliate-url-import.server.ts#commitResellerUrlImport#upsert", changes: ["create"], actor: "import", entry: "reseller URL import (listing created unlisted, awaiting review)", attribution: "declared", sources: ["import"] },
  { key: "lib/marketplace/import-from-url.server.ts#importMarketplaceFromUrl#upsert", changes: ["create"], actor: "import", entry: "marketplace URL import", attribution: "declared", sources: ["import"] },
  { key: "lib/marketplace/import-from-url.server.ts#publishMarketplaceImport#update", changes: ["list"], actor: "import", entry: "marketplace URL import publish batch", attribution: "declared", sources: ["import"] },
  { key: "lib/radar/radar-import-bridge.server.ts#createAffiliateDraftsBulk#createMany", changes: ["create"], actor: "import", entry: "Radar bridge", attribution: "declared", sources: ["import"] },
  { key: "lib/radar/radar-import-bridge.server.ts#createAffiliateDraftsBulk#update", changes: ["list", "unlist"], actor: "import", entry: "Radar bridge", attribution: "declared", sources: ["import"] },
  // ── Supplier ────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: "lib/supplier-product-remove.server.ts#deleteSupplierProduct#deleteMany", changes: ["delete"], actor: "supplier", entry: "supplier deletes its product", attribution: "declared", sources: ["supplier_withdrawal"] },
  { key: "lib/supplier-product-remove.server.ts#recallSupplierProduct#updateMany", changes: ["unlist"], actor: "supplier", entry: "supplier withdraws / archives its product", attribution: "declared", sources: ["supplier_withdrawal"] },
  { key: "lib/supplier-delete-drafts.server.ts#bulkDeleteSupplierDrafts#deleteMany", changes: ["delete"], actor: "supplier", entry: "supplier bulk-deletes draft products", attribution: "declared", sources: ["supplier_withdrawal"], note: "declared 2026-11-24 (was unattributed)" },
  // ── Admin / platform decisions ──────────────────────────────────────────────────────────────────────────────────
  { key: "lib/product-exclusivity.server.ts#grantProductExclusivity#updateMany", changes: ["unlist"], actor: "admin", entry: "product made exclusive to one reseller", attribution: "declared", sources: ["exclusivity"] },
  { key: "lib/reseller-import/review.server.ts#applyResellerImportReview#updateMany", changes: ["list"], actor: "admin", entry: "POST /api/admin/reseller-imports/<id>/review (approve)", attribution: "declared", sources: ["admin_review"] },
  { key: "lib/reseller-import/review.server.ts#applyResellerImportReview#updateMany#2", changes: ["unlist"], actor: "admin", entry: "POST /api/admin/reseller-imports/<id>/review (reject)", attribution: "declared", sources: ["admin_review"] },
  { key: "lib/reseller-import/review.server.ts#publishApprovedResellerImport#updateMany", changes: ["list"], actor: "admin", entry: "POST /api/admin/reseller-imports/<id>/publish", attribution: "declared", sources: ["admin_review"] },
  // ── Account deletion ────────────────────────────────────────────────────────────────────────────────────────────
  { key: "lib/delete-merchant-account.ts#deleteMerchantUser#deleteMany", changes: ["delete"], actor: "merchant_account", entry: "reseller deletes its account (its events are purged in the same transaction)", attribution: "declared", sources: ["account_deletion"], note: "declared 2026-11-24 (was unattributed)" },
  { key: "lib/delete-merchant-account.ts#deleteMerchantUser#deleteMany#2", changes: ["delete"], actor: "merchant_account", entry: "supplier deletes its account (OTHER resellers' listings of its products disappear)", attribution: "declared", sources: ["account_deletion"], note: "declared 2026-11-24 (was unattributed)" },
  // ── Demo Lab ────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: "lib/demo/ensure-demo-users.ts#ensureDemoAffiliateListing#update", changes: ["relist"], actor: "demo", entry: "Demo Lab fixtures (npm run demo:ensure, enterDemoLabAction)", attribution: "declared", sources: ["demo"], note: "declared 2026-11-24 (was unattributed)" },
  { key: "lib/demo/ensure-demo-users.ts#ensureDemoAffiliateListing#create", changes: ["create"], actor: "demo", entry: "Demo Lab fixtures", attribution: "declared", sources: ["demo"], note: "declared 2026-11-24 (was unattributed)" },
  // ── Helpers whose callers are listed above ──────────────────────────────────────────────────────────────────────
  { key: "lib/listing-price-history/record.server.ts#updateListingWithPriceSource#update", changes: ["list", "unlist", "relist"], actor: "reseller", entry: "helper — see its callers", attribution: "wrapper", sources: [] },
  { key: "lib/listing-price-history/record.server.ts#upsertListingWithPriceSource#upsert", changes: ["create", "relist"], actor: "reseller", entry: "helper — see its callers", attribution: "wrapper", sources: [] },
  // ── Scripts and seeds ───────────────────────────────────────────────────────────────────────────────────────────
  { key: "prisma/seed.ts#seedGoogleTaxonomy#deleteMany", changes: ["delete"], actor: "script", entry: "prisma seed", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "prisma/clear-products.ts#main#deleteMany", changes: ["delete"], actor: "script", entry: "clear-products script", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "scripts/copy-to-prod.ts#main#upsert", changes: ["create"], actor: "script", entry: "copy-to-prod script", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "scripts/create-test-order-three-way.ts#main#create", changes: ["create"], actor: "script", entry: "test-order fixture script", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "scripts/ensure-seo-parasite-fixture.ts#main#upsert", changes: ["create"], actor: "script", entry: "SEO fixture script", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "scripts/hide-internal-test-products.ts#main#updateMany", changes: ["unlist"], actor: "script", entry: "hide-internal-test-products script (raw set_config)", attribution: "declared", sources: ["script"] },
  { key: "scripts/seed-social-proof-local.ts#main#create", changes: ["create"], actor: "script", entry: "local social-proof seed", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "scripts/test-vat-flow.ts#ensureAffiliateListing#update", changes: ["relist"], actor: "script", entry: "VAT flow test script", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
  { key: "scripts/test-vat-flow.ts#ensureAffiliateListing#create", changes: ["create"], actor: "script", entry: "VAT flow test script", attribution: "declared", sources: ["script"], note: "declared 2026-11-24" },
] as const

/**
 * What the history CANNOT attribute, by construction (stated, never filled in):
 *  - writes made in another tool (psql, a database console) without the declaration: recorded `unattributed`;
 *  - events recorded before a source was declared on a path: never rewritten (the table is append-only);
 *  - listings older than the history: no event at all, period start unknown (`rebuildPresence`).
 */
export const PROVENANCE_LIMITS = [
  "écriture hors application sans déclaration (console SQL) : « unattributed »",
  "événements antérieurs à la déclaration d'un chemin : jamais réécrits",
  "annonces antérieures à l'historique : aucun événement, début inconnu",
] as const
