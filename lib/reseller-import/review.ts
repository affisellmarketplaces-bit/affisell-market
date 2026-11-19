/**
 * Reseller URL imports — import, validation and publication are three separate steps (founder rule 2026-11-18:
 * a product nobody has verified is never sellable automatically).
 *
 * 1. IMPORT — a reseller pastes a URL: the product is created (or refreshed) as a DRAFT on the platform "Import Vault"
 *    supplier account, state `pending`, and the reseller's listing is created UNLISTED. Nothing can be bought.
 * 2. VALIDATION — Affisell (ADMIN) reviews the sheet: approve or reject, with a reason. Approval passes the same
 *    "ready to publish" gate as a hand-made sheet (product safety, identity).
 * 3. PUBLICATION — on approval the product is published and the listings whose reseller asked to go live are listed.
 *    Rejection keeps the product a draft and every listing of it unlisted.
 *
 * No migration: the state is carried by one reserved product tag (`import-review:<state>`), every decision is an
 * `AuditLog` row. A product that already exists in the catalogue and is published (an URL that matches an existing
 * catalogue product) needs no review: the reseller simply lists an already-validated product.
 */
export const IMPORT_REVIEW_TAG_PREFIX = "import-review:"

/** `Product.importSource` of a reseller URL import (same value as `RESELLER_URL_IMPORT_SOURCE`). */
export const RESELLER_URL_IMPORT_SOURCE_VALUE = "reseller_url_import"

export const IMPORT_REVIEW_STATES = ["pending", "approved", "rejected"] as const
export type ImportReviewState = (typeof IMPORT_REVIEW_STATES)[number]

export function importReviewTag(state: ImportReviewState): string {
  return `${IMPORT_REVIEW_TAG_PREFIX}${state}`
}

/** The review state written on a product's tags, or null for a product that never went through the reseller import. */
export function importReviewStateFromTags(tags: ReadonlyArray<string> | null | undefined): ImportReviewState | null {
  for (const tag of tags ?? []) {
    if (!tag.startsWith(IMPORT_REVIEW_TAG_PREFIX)) continue
    const state = tag.slice(IMPORT_REVIEW_TAG_PREFIX.length)
    if ((IMPORT_REVIEW_STATES as readonly string[]).includes(state)) return state as ImportReviewState
  }
  return null
}

/** Tags with exactly one review state (any previous one removed). Other tags are kept, in order. */
export function withImportReviewState(tags: ReadonlyArray<string> | null | undefined, state: ImportReviewState): string[] {
  const kept = (tags ?? []).filter((t) => !t.startsWith(IMPORT_REVIEW_TAG_PREFIX))
  return [...kept, importReviewTag(state)]
}

/**
 * State after a (re-)import. A new product starts `pending`. Re-importing an APPROVED product keeps it approved (same
 * product, content refreshed — no new review), a rejected one stays rejected (a re-import is not an appeal).
 */
export function importReviewStateAfterImport(current: ImportReviewState | null): ImportReviewState {
  return current ?? "pending"
}

export type ReviewDecision = "approve" | "reject"

/** Allowed transitions: pending → approved | rejected; rejected → approved (second look); approved → rejected (pulled). */
export function canApplyReviewDecision(current: ImportReviewState | null, decision: ReviewDecision): boolean {
  if (current == null) return false
  if (decision === "approve") return current !== "approved"
  return current !== "rejected"
}

/** A listing may be LISTED only on a product that is published and on sale (and, for an import, approved). */
export function mayListOnProduct(product: {
  active: boolean
  isDraft: boolean
  tags?: ReadonlyArray<string> | null
}): boolean {
  if (!product.active || product.isDraft) return false
  const state = importReviewStateFromTags(product.tags)
  return state == null || state === "approved"
}

/**
 * The state the admin review starts from. A reseller import created before this flow (no tag) is reviewable as if it
 * were pending — the founder decides whether those legacy products are pulled; the review itself is explicit.
 */
export function reviewableState(product: { importSource?: string | null; tags?: ReadonlyArray<string> | null }): ImportReviewState | null {
  const state = importReviewStateFromTags(product.tags)
  if (state) return state
  return product.importSource === RESELLER_URL_IMPORT_SOURCE_VALUE ? "pending" : null
}

/**
 * Three notions kept apart (founder rule 2026-11-18):
 * 1. ADMIN REVIEW of the import (pending / approved / rejected / legacy) — an admin's judgement of the source;
 * 2. COMPLIANCE of the product sheet — the blocking product-safety data (`evaluateListingReadiness`), judged STRICTLY
 *    here whatever `LISTING_READINESS_MODE` says: the observation mode is for supplier forms, never a way around the
 *    rule for a product Affisell itself validates;
 * 3. PUBLICATION — allowed only when 1 is `approved` AND 2 has no blocking issue. An approval never bypasses 2.
 */
export type ImportPublicationStatus =
  | { publishable: true }
  | { publishable: false; reason: "not_approved" | "rejected" | "compliance_blocking" | "stock_unconfirmed"; blocking: string[] }

export function importPublicationStatus(args: {
  reviewState: ImportReviewState | "legacy_unreviewed"
  compliance: { applicable: boolean; blocking: ReadonlyArray<string> }
  /** The source gave no quantity (lib/import-stock.ts): never sellable until an admin confirms one. */
  stockUnconfirmed?: boolean
}): ImportPublicationStatus {
  const blocking = args.compliance.applicable ? [...args.compliance.blocking] : []
  if (args.reviewState === "rejected") return { publishable: false, reason: "rejected", blocking }
  if (args.reviewState !== "approved") return { publishable: false, reason: "not_approved", blocking }
  if (blocking.length > 0) return { publishable: false, reason: "compliance_blocking", blocking }
  if (args.stockUnconfirmed) return { publishable: false, reason: "stock_unconfirmed", blocking }
  return { publishable: true }
}
