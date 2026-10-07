import "server-only"

import { normalizeGtin } from "@/lib/listing-compliance/gtin"
import { IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { prisma } from "@/lib/prisma"

export type DuplicateReason = "gtin" | "same_image" | "same_name"

export type DuplicateMatch = {
  id: string
  name: string
  reason: DuplicateReason
  isDraft: boolean
  active: boolean
}

export type DuplicateQuery = {
  supplierId: string
  gtin?: string | null
  name?: string | null
  imageUrl?: string | null
  /** The product being edited (never a duplicate of itself). */
  excludeId?: string | null
}

const MAX_MATCHES = 5
/** Reasons in order of certainty: the first reason found for a product wins. */
const PRIORITY: DuplicateReason[] = ["gtin", "same_image", "same_name"]

/**
 * Other products of the SAME supplier that look like the one being entered. Advisory only — the supplier decides
 * (two colours may legitimately be separate listings). Other suppliers' products are never considered: several
 * wholesalers selling the same GTIN is normal on a marketplace and is not a conflict.
 */
export async function findSupplierProductDuplicates(q: DuplicateQuery): Promise<DuplicateMatch[]> {
  const notSelf = q.excludeId ? { id: { not: q.excludeId } } : {}
  const gtin = q.gtin ? normalizeGtin(q.gtin) : ""
  const name = q.name?.trim() ?? ""
  const imageUrl = q.imageUrl?.trim() ?? ""
  const select = { id: true, name: true, isDraft: true, active: true } as const

  const [byGtin, byImage, byName] = await Promise.all([
    gtin.length >= 8
      ? prisma.productAttribute.findMany({
          where: { key: IDENTITY_KEYS.gtin, value: gtin, product: { supplierId: q.supplierId, ...notSelf } },
          select: { product: { select } },
          take: MAX_MATCHES,
        })
      : Promise.resolve([]),
    imageUrl.startsWith("http")
      ? prisma.product.findMany({
          where: { supplierId: q.supplierId, images: { has: imageUrl }, ...notSelf },
          select,
          take: MAX_MATCHES,
        })
      : Promise.resolve([]),
    name.length >= 3
      ? prisma.product.findMany({
          where: { supplierId: q.supplierId, name: { equals: name, mode: "insensitive" }, ...notSelf },
          select,
          take: MAX_MATCHES,
        })
      : Promise.resolve([]),
  ])

  const found = new Map<string, DuplicateMatch>()
  const add = (p: { id: string; name: string; isDraft: boolean; active: boolean }, reason: DuplicateReason) => {
    const existing = found.get(p.id)
    if (existing && PRIORITY.indexOf(existing.reason) <= PRIORITY.indexOf(reason)) return
    found.set(p.id, { id: p.id, name: p.name, reason, isDraft: p.isDraft, active: p.active })
  }
  for (const row of byGtin) add(row.product, "gtin")
  for (const p of byImage) add(p, "same_image")
  for (const p of byName) add(p, "same_name")

  return [...found.values()]
    .sort((a, b) => PRIORITY.indexOf(a.reason) - PRIORITY.indexOf(b.reason))
    .slice(0, MAX_MATCHES)
}
