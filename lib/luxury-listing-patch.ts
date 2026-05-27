import type { Prisma } from "@prisma/client"

import {
  LUXURY_TIER_COLLECTION,
  LUXURY_TIER_LUXE,
  LUXURY_TIER_NONE,
  parseLuxuryTier,
} from "@/lib/luxury-constants"
import { prisma } from "@/lib/prisma"

export type LuxuryListingPatchResult =
  | { ok: true; data: Prisma.AffiliateProductUpdateInput }
  | { ok: false; error: string; status: number }

/** Validate and build Prisma patch for affiliate luxury curation fields. */
export async function buildLuxuryListingPatch(
  body: Record<string, unknown>
): Promise<LuxuryListingPatchResult> {
  const luxuryTier = parseLuxuryTier(body.luxuryTier)
  if (luxuryTier === undefined) {
    return { ok: true, data: {} }
  }

  const data: Prisma.AffiliateProductUpdateInput = {}

  if (luxuryTier === LUXURY_TIER_COLLECTION) {
    const colId = typeof body.luxuryCollectionId === "string" ? body.luxuryCollectionId.trim() : ""
    if (!colId) {
      return { ok: false, error: "Luxury collection required", status: 400 }
    }
    const col = await prisma.luxuryCollection.findFirst({
      where: { id: colId, active: true },
      select: { id: true },
    })
    if (!col) {
      return { ok: false, error: "Invalid luxury collection", status: 400 }
    }
    data.luxuryTier = LUXURY_TIER_COLLECTION
    data.luxuryCollection = { connect: { id: colId } }
    return { ok: true, data }
  }

  if (luxuryTier === LUXURY_TIER_LUXE) {
    data.luxuryTier = LUXURY_TIER_LUXE
    data.luxuryCollection = { disconnect: true }
    return { ok: true, data }
  }

  data.luxuryTier = LUXURY_TIER_NONE
  data.luxuryCollection = { disconnect: true }
  return { ok: true, data }
}

export type LuxuryListingCreateFields = {
  luxuryTier: string
  luxuryCollectionId: string | null
}

export async function resolveLuxuryListingCreateFields(
  body: Record<string, unknown>
): Promise<{ ok: true; fields: LuxuryListingCreateFields } | { ok: false; error: string; status: number }> {
  const patch = await buildLuxuryListingPatch(body)
  if (!patch.ok) return patch

  if (patch.data.luxuryTier === LUXURY_TIER_COLLECTION) {
    const colId =
      typeof body.luxuryCollectionId === "string" ? body.luxuryCollectionId.trim() : ""
    return {
      ok: true,
      fields: { luxuryTier: LUXURY_TIER_COLLECTION, luxuryCollectionId: colId },
    }
  }
  if (patch.data.luxuryTier === LUXURY_TIER_LUXE) {
    return { ok: true, fields: { luxuryTier: LUXURY_TIER_LUXE, luxuryCollectionId: null } }
  }
  if (patch.data.luxuryTier === LUXURY_TIER_NONE) {
    return { ok: true, fields: { luxuryTier: LUXURY_TIER_NONE, luxuryCollectionId: null } }
  }
  return { ok: true, fields: { luxuryTier: LUXURY_TIER_NONE, luxuryCollectionId: null } }
}
