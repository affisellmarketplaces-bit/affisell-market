import type { PrismaClient } from "@prisma/client"

import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import { CATEGORIES_AFFISELL } from "@/lib/ai/categories"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse, type LeafPath } from "@/lib/category-browse"
import { recordCategorySuggestion } from "@/lib/category-suggestion-log.server"
import { prisma } from "@/lib/prisma"

/** Auto-apply when AI confidence is at or above this (marketplace browse). */
const AUTO_APPLY_AI_CONFIDENCE = 0.72
/** Apply + queue ops review between these bounds. */
const REVIEW_QUEUE_MIN_CONFIDENCE = 0.52
type BrowseCtx = {
  leafPaths: LeafPath[]
  allowedBreadcrumbs: string[]
  loadedAt: number
}

let browseCache: BrowseCtx | null = null
const BROWSE_CACHE_MS = 5 * 60_000

async function getBrowseContext(client: PrismaClient = prisma): Promise<BrowseCtx> {
  const now = Date.now()
  if (browseCache && now - browseCache.loadedAt < BROWSE_CACHE_MS) {
    return browseCache
  }
  const rows = await fetchAllCategoriesForBrowse(client)
  const { leafPaths } = buildCategoryBrowse(rows)
  const allowedBreadcrumbs =
    leafPaths.length > 0 ? leafPaths.map((lp) => lp.breadcrumb) : [...CATEGORIES_AFFISELL]
  browseCache = { leafPaths, allowedBreadcrumbs, loadedAt: now }
  return browseCache
}

export type AutoCategorizeResult =
  | {
      ok: true
      applied: true
      leafId: string
      breadcrumb: string
      source: "ai"
      needsReview?: boolean
    }
  | { ok: true; applied: false; reason: "low_confidence" | "skipped" }
  | { ok: false; error: string }

async function applyCategory(
  productId: string,
  leafId: string,
  breadcrumb: string,
  confidence: number,
  reason: string,
  queueReview: boolean
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { categoryId: leafId },
    })
    if (queueReview) {
      await tx.productReview.deleteMany({ where: { productId } })
      await tx.productReview.create({
        data: {
          productId,
          suggestedCategory: breadcrumb,
          confidence,
          reason,
        },
      })
    }
  })
}

/**
 * Classify a live marketplace product into the Affisell category tree (leaf `categoryId`)
 * with the semantic engine; never from keywords alone.
 */
export async function autoCategorizeProduct(
  productId: string,
  options?: { force?: boolean; allowDraft?: boolean; client?: PrismaClient }
): Promise<AutoCategorizeResult> {
  const client = options?.client ?? prisma

  const product = await client.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      categoryId: true,
      isDraft: true,
      active: true,
    },
  })

  if (!product) return { ok: false, error: "not_found" }
  if (!options?.allowDraft && (product.isDraft || !product.active)) {
    return { ok: true, applied: false, reason: "skipped" }
  }
  if (product.categoryId && !options?.force) {
    return { ok: true, applied: false, reason: "skipped" }
  }

  const title = product.name.trim()
  if (!title) return { ok: true, applied: false, reason: "skipped" }

  const description = product.description?.trim() ?? ""
  const imageUrl =
    Array.isArray(product.images) && typeof product.images[0] === "string" && product.images[0].trim()
      ? product.images[0].trim()
      : undefined

  const { leafPaths, allowedBreadcrumbs } = await getBrowseContext(client)

  // Semantic engine on the FULL taxonomy (Claude, then Groq running the same identify → choose pipeline).
  // A title-keyword match is never enough to write a category onto a product: it cannot tell "Action Figure" from
  // "Articles de collection" and used to put such products in the wrong aisle silently. When no engine can answer
  // (or none is sure), the product stays uncategorised so the supplier picks — better than a wrong shelf.
  const { suggestions, error } = await classifyAffisellProduct(
    { title, description, imageUrl },
    { allowedBreadcrumbs, leafPaths }
  )

  if (error && suggestions.length === 0) {
    return { ok: false, error }
  }

  const top = suggestions[0]
  if (!top?.leafId) {
    return { ok: true, applied: false, reason: "low_confidence" }
  }

  if (top.confidence >= AUTO_APPLY_AI_CONFIDENCE) {
    await applyCategory(productId, top.leafId, top.category, top.confidence, top.reason, false)
    await recordCategorySuggestion({ productId, leafId: top.leafId, confidence: top.confidence, applied: true })
    return {
      ok: true,
      applied: true,
      leafId: top.leafId,
      breadcrumb: top.category,
      source: "ai",
    }
  }

  if (top.confidence >= REVIEW_QUEUE_MIN_CONFIDENCE) {
    await applyCategory(productId, top.leafId, top.category, top.confidence, top.reason, true)
    await recordCategorySuggestion({
      productId,
      leafId: top.leafId,
      confidence: top.confidence,
      applied: true,
      needsReview: true,
    })
    return {
      ok: true,
      applied: true,
      leafId: top.leafId,
      breadcrumb: top.category,
      source: "ai",
      needsReview: true,
    }
  }

  await recordCategorySuggestion({ productId, leafId: top.leafId, confidence: top.confidence, applied: false })
  return { ok: true, applied: false, reason: "low_confidence" }
}

/** Fire-and-forget after API response — does not block the supplier UI. */
export function scheduleProductAutoCategorization(
  productId: string,
  options?: { force?: boolean; allowDraft?: boolean }
): void {
  const run = () => {
    void autoCategorizeProduct(productId, options).catch((e) => {
      console.error("[auto-categorize]", productId, e)
    })
  }
  if (typeof setImmediate === "function") {
    setImmediate(run)
  } else {
    void Promise.resolve().then(run)
  }
}

/** Invalidate in-memory taxonomy cache (e.g. after seeding categories). */
export function clearCategoryBrowseCache(): void {
  browseCache = null
}
