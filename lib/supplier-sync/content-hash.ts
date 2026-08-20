import { createHash } from "node:crypto"

import type { IntegrationProvider } from "@prisma/client"

import type { MappedAffisellProduct } from "@/lib/supplier-sync/types"

/** Stable hash for differential sync — only business fields that affect storefront. */
export function productContentHash(input: {
  name: string
  description: string
  basePriceCents: number
  stock: number
  images: string[]
  categoryLabel: string
}): string {
  const normalized = {
    name: input.name.trim(),
    description: input.description.trim().slice(0, 8000),
    basePriceCents: input.basePriceCents,
    stock: input.stock,
    images: [...input.images].sort(),
    categoryLabel: input.categoryLabel.trim(),
  }
  return createHash("sha256").update(JSON.stringify(normalized), "utf8").digest("hex")
}

export function hashFromMapped(mapped: MappedAffisellProduct): string {
  return productContentHash({
    name: mapped.name,
    description: mapped.description,
    basePriceCents: mapped.basePriceCents,
    stock: mapped.stock,
    images: mapped.images,
    categoryLabel: mapped.categoryLabel,
  })
}

export function providerFromPlatform(platform: string): IntegrationProvider | null {
  const p = platform.trim().toLowerCase()
  if (p === "shopify") return "SHOPIFY"
  if (p === "woocommerce") return "WOOCOMMERCE"
  if (p === "custom_api" || p === "custom-api") return "CUSTOM_API"
  return null
}
