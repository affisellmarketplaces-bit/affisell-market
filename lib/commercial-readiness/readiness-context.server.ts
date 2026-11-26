import "server-only"

import { resolveCategoryAffisellCommissionBps } from "@/lib/affisell-platform-commission.server"
import { assertProductCreationAllowed } from "@/lib/growth/catalog-cap.server"
import { readListingReadinessMode } from "@/lib/listing-compliance/mode"
import type { ListingReadinessMode } from "@/lib/listing-compliance/mode"
import { positiveQualityEvidence } from "@/lib/listing-quality/quality-effect"
import { loadQualityEffectReport } from "@/lib/listing-quality/quality-effect.server"
import type { QualityEvidence } from "@/lib/listing-quality/sheet-checklist"
import { resolveSupplierFeeBpsForOrder } from "@/lib/marketplace-supplier-fee"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"

/**
 * The facts a publication depends on that only the server knows, read with the SAME functions the publication routes
 * use. ONE loader for the readiness panel (`GET /api/supplier/publication-rules`) and the catalogue health. Each fact is
 * `null` when it can not be read — the engine then does not judge it (an unknown rule is never a blocker).
 */
export type PublicationRules = {
  listingReadinessMode: ListingReadinessMode
  merchantVerified: boolean | null
  catalogCapReached: boolean | null
}

export async function loadPublicationRules(supplierId: string): Promise<PublicationRules> {
  const [merchant, cap] = await Promise.all([
    merchantVerificationGate(supplierId).then((g) => g.allowed).catch(() => null),
    assertProductCreationAllowed(supplierId).then((c) => !c.allowed).catch(() => null),
  ])
  return { listingReadinessMode: readListingReadinessMode(), merchantVerified: merchant, catalogCapReached: cap }
}

/** Distinct categories resolved per call; beyond, the fee is unknown (net per sale not judged — never invented). */
export const FEE_LOOKUP_MAX_CATEGORIES = 40

/**
 * Affisell's catalogue fee THIS supplier pays, per category — same resolution as `GET
 * /api/supplier/category-affisell-commission` and the settlement (negotiated `User.supplierFeeBps*` over the grid).
 * A category that could not be read is absent from the map.
 */
export async function loadSupplierFeeBpsByCategory(supplierId: string, categoryIds: ReadonlyArray<string | null>): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const ids = [...new Set(categoryIds.filter((c): c is string => typeof c === "string" && c.trim() !== ""))].slice(0, FEE_LOOKUP_MAX_CATEGORIES)
  if (ids.length === 0) return out
  const overrides = await prisma.user
    .findUnique({ where: { id: supplierId }, select: { supplierFeeBps: true, supplierFeeBpsCatalog: true } })
    .catch(() => null)
  await Promise.all(
    ids.map(async (id) => {
      try {
        const categoryFeeBps = await resolveCategoryAffisellCommissionBps(id)
        out.set(id, resolveSupplierFeeBpsForOrder({ usesAffisellAutoBuy: false, supplier: overrides ?? {}, categoryFeeBps }))
      } catch {
        /* unknown fee: not judged */
      }
    }),
  )
  return out
}

/** The marketplace aggregate associations (positive verdicts only); unreadable = none (recommendations then carry no figure). */
export async function loadQualityEvidenceSafe(): Promise<QualityEvidence[]> {
  try {
    return positiveQualityEvidence(await loadQualityEffectReport())
  } catch (error) {
    console.error("[readiness] quality_evidence_unreadable", error instanceof Error ? error.message : "unknown")
    return []
  }
}
