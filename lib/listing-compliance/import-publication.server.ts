import { applyListingReadinessGate, type ReadinessSource } from "@/lib/listing-compliance/gate.server"
import type { ReadinessInput } from "@/lib/listing-compliance/evaluate"
import type { ListingReadinessMode } from "@/lib/listing-compliance/mode"

/**
 * Chantier 3 — automated imports pass the SAME publication gate as a hand-made sheet (founder decision 2026-11-18:
 * imported products stay drafts until validated; one definition of "ready to publish").
 *
 * An import that asks to go live (`wantLive`) is checked with `applyListingReadinessGate` as a new publication:
 * - `off` / `warn` (default): nothing changes, `warn` logs `[listing-readiness] would_refuse_if_enforced`;
 * - `enforce`: a product that is not ready is CREATED AS A DRAFT instead of being refused — an import is a batch,
 *   one incomplete row must not fail the others; the supplier completes it and publishes it from its catalogue.
 * Never throws (the gate itself never does).
 */
export function decideImportPublication(args: {
  source: Extract<ReadinessSource, `import_${string}`>
  supplierId: string
  productId?: string | null
  listingKind?: string | null
  wantLive: boolean
  attributes?: ReadinessInput["attributes"]
  mode?: ListingReadinessMode
}): { live: boolean; downgradedToDraft: boolean } {
  if (!args.wantLive) return { live: false, downgradedToDraft: false }
  const { decision } = applyListingReadinessGate({
    source: args.source,
    supplierId: args.supplierId,
    productId: args.productId ?? null,
    listingKind: args.listingKind ?? null,
    attributes: args.attributes ?? [],
    context: "new_publication",
    mode: args.mode,
  })
  if (!decision.block) return { live: true, downgradedToDraft: false }
  console.log("[listing-readiness]", {
    source: args.source,
    supplierId: args.supplierId,
    productId: args.productId ?? null,
    result: "import_downgraded_to_draft",
    blocking: decision.blocking.map((i) => i.code),
  })
  return { live: false, downgradedToDraft: true }
}
