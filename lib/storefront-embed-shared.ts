/** Embed widget config — safe for `"use client"` (no Prisma). */

import { appBaseUrl } from "@/lib/app-base-url"

export type StorefrontEmbedWidget = {
  enabled: boolean
  title?: string
  productLimit?: number
}

export const DEFAULT_EMBED_WIDGET: StorefrontEmbedWidget = {
  enabled: false,
  productLimit: 4,
}

const MAX_TITLE = 80
const MIN_PRODUCTS = 2
const MAX_PRODUCTS = 6

export function parseEmbedWidget(raw: unknown): StorefrontEmbedWidget {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_EMBED_WIDGET }
  }
  const o = raw as Record<string, unknown>
  let productLimit = DEFAULT_EMBED_WIDGET.productLimit!
  if (typeof o.productLimit === "number" && Number.isFinite(o.productLimit)) {
    productLimit = Math.min(MAX_PRODUCTS, Math.max(MIN_PRODUCTS, Math.round(o.productLimit)))
  }
  const title =
    typeof o.title === "string" && o.title.trim()
      ? o.title.trim().slice(0, MAX_TITLE)
      : undefined
  return {
    enabled: o.enabled === true,
    title,
    productLimit,
  }
}

export function serializeEmbedWidget(widget: StorefrontEmbedWidget): string {
  return JSON.stringify(widget)
}

export function embedWidgetsEqual(a: StorefrontEmbedWidget, b: StorefrontEmbedWidget): boolean {
  return serializeEmbedWidget(a) === serializeEmbedWidget(b)
}

export function storeEmbedPagePath(slug: string): string {
  return `/embed/shops/${encodeURIComponent(slug)}`
}

export function storeEmbedPublicUrl(slug: string): string {
  const base = appBaseUrl().replace(/\/$/, "")
  return `${base}${storeEmbedPagePath(slug)}`
}

export function buildStoreEmbedIframeSnippet(args: {
  slug: string
  storeName: string
  width?: number
  height?: number
}): string {
  const src = storeEmbedPublicUrl(args.slug)
  const width = args.width ?? 420
  const height = args.height ?? 520
  const title = args.storeName.trim() || "Affisell store"
  return `<iframe src="${src}" title="${title.replace(/"/g, "&quot;")}" width="${width}" height="${height}" style="border:0;border-radius:16px;max-width:100%;width:100%" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
}
