import "server-only"

import type { ResolvedMedusaProduct } from "@/types/medusa"

const DEFAULT_MEDUSA_URL = "http://localhost:9000"

function medusaBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
    DEFAULT_MEDUSA_URL
  ).replace(/\/$/, "")
}

function publishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim() || undefined
}

type MedusaProductRow = {
  id: string
  handle?: string
  title?: string
  thumbnail?: string | null
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
  variants?: Array<{ id?: string }>
  product_try_on?: {
    try_on_enabled?: boolean
    tryon_garment_url?: string | null
  } | null
}

function normalizeMedusaProduct(row: MedusaProductRow, handle: string): ResolvedMedusaProduct {
  const linked = row.product_try_on
  const tryOnEnabled = row.try_on_enabled ?? linked?.try_on_enabled ?? false
  const garmentUrl = row.tryon_garment_url ?? linked?.tryon_garment_url ?? null
  return {
    source: "medusa",
    id: row.id,
    handle: row.handle ?? handle,
    title: row.title ?? handle,
    thumbnail: row.thumbnail ?? null,
    try_on_enabled: Boolean(tryOnEnabled),
    tryon_garment_url: garmentUrl,
  }
}

export async function fetchMedusaProductByHandle(handle: string): Promise<ResolvedMedusaProduct | null> {
  const base = medusaBackendUrl()
  const key = publishableKey()
  const params = new URLSearchParams({
    handle,
    fields: "id,handle,title,thumbnail,+product_try_on.*,try_on_enabled,tryon_garment_url",
    limit: "1",
  })

  const headers: Record<string, string> = { Accept: "application/json" }
  if (key) headers["x-publishable-api-key"] = key

  try {
    const res = await fetch(`${base}/store/products?${params.toString()}`, {
      headers,
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[medusa-fetch]", { handle, status: res.status, result: "http_error" })
      return null
    }
    const data = (await res.json()) as { products?: MedusaProductRow[] }
    const row = data.products?.[0]
    if (!row) return null
    return normalizeMedusaProduct(row, handle)
  } catch (error) {
    console.error("[medusa-fetch]", { handle, error, result: "fetch_failed" })
    return null
  }
}

/** First variant id for Medusa order sync (Affisell 1 product = 1 variant). */
export async function fetchMedusaFirstVariantIdByHandle(handle: string): Promise<string | null> {
  const base = medusaBackendUrl()
  const key = publishableKey()
  const params = new URLSearchParams({
    handle,
    fields: "id,variants.id",
    limit: "1",
  })

  const headers: Record<string, string> = { Accept: "application/json" }
  if (key) headers["x-publishable-api-key"] = key

  try {
    const res = await fetch(`${base}/store/products?${params.toString()}`, {
      headers,
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[medusa-variant]", { handle, status: res.status, result: "http_error" })
      return null
    }
    const data = (await res.json()) as { products?: MedusaProductRow[] }
    const variantId = data.products?.[0]?.variants?.[0]?.id
    return variantId ?? null
  } catch (error) {
    console.error("[medusa-variant]", { handle, error, result: "fetch_failed" })
    return null
  }
}

/** Prisma fallback when Medusa is unreachable — matches Affisell catalog try-on flags. */
export async function fetchLocalTryOnProductFallback(
  handle: string
): Promise<ResolvedMedusaProduct | null> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const slugLike = handle.replace(/-/g, " ")
    const product = await prisma.product.findFirst({
      where: {
        tryOnEnabled: true,
        tryOnGarmentUrl: { not: null },
        OR: [
          { id: handle },
          { name: { contains: slugLike, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        images: true,
        tryOnEnabled: true,
        tryOnGarmentUrl: true,
      },
    })
    if (!product?.tryOnGarmentUrl) return null
    const images = product.images
    const thumb =
      Array.isArray(images) && typeof images[0] === "string" ? images[0] : null
    return {
      source: "local",
      id: product.id,
      handle,
      title: product.name,
      thumbnail: thumb,
      try_on_enabled: product.tryOnEnabled,
      tryon_garment_url: product.tryOnGarmentUrl,
    }
  } catch (error) {
    console.error("[medusa-fetch]", { handle, error, result: "local_fallback_failed" })
    return null
  }
}

export async function resolveProductForTryOnPage(
  handle: string
): Promise<ResolvedMedusaProduct | null> {
  const medusa = await fetchMedusaProductByHandle(handle)
  if (medusa) return medusa
  return fetchLocalTryOnProductFallback(handle)
}
