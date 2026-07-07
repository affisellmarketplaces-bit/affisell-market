import "server-only"

import { unstable_cache } from "next/cache"
import sharp from "sharp"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { listingCardImageCacheTag } from "@/lib/listing-card-image-shared"
import { isUsableProductImageUrl } from "@/lib/product-image-url"
import { prisma } from "@/lib/prisma"

const CARD_MAX_WIDTH = 480
const CARD_WEBP_QUALITY = 80

function pickFirstUsableListingImage(
  customImages: string[] | null | undefined,
  productImages: string[] | null | undefined
): string | null {
  for (const raw of customImages ?? []) {
    if (isUsableProductImageUrl(raw)) return raw.trim()
  }
  for (const raw of productImages ?? []) {
    if (isUsableProductImageUrl(raw)) return raw.trim()
  }
  return null
}

function parseDataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/)
  if (!match) throw new Error("Invalid data image URL")
  return Buffer.from(match[2]!, "base64")
}

async function sourceBytes(sourceUrl: string): Promise<Buffer> {
  if (sourceUrl.startsWith("data:image/")) {
    return parseDataUrlToBuffer(sourceUrl)
  }
  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    const res = await fetch(sourceUrl, { cache: "force-cache", next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Image fetch failed (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  }
  throw new Error("Unsupported image source")
}

async function renderListingCardWebp(sourceUrl: string): Promise<Buffer> {
  const input = await sourceBytes(sourceUrl)
  return sharp(input)
    .rotate()
    .resize({ width: CARD_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: CARD_WEBP_QUALITY })
    .toBuffer()
}

async function loadListingCardWebpUncached(listingId: string): Promise<Buffer | null> {
  const row = await prisma.affiliateProduct.findFirst({
    where: { id: listingId, ...buyerListedAffiliateProductWhere },
    select: {
      customImages: true,
      product: { select: { images: true } },
    },
  })
  if (!row) return null

  const source = pickFirstUsableListingImage(row.customImages, row.product.images)
  if (!source) return null

  try {
    return await renderListingCardWebp(source)
  } catch (error) {
    console.error("[listing-card-image]", { listingId, error })
    return null
  }
}

const loadListingCardWebpCached = (listingId: string) =>
  unstable_cache(
    () => loadListingCardWebpUncached(listingId),
    ["listing-card-image-v1", listingId],
    { revalidate: 86_400, tags: [listingCardImageCacheTag(listingId)] }
  )()

export async function getListingCardImageWebp(listingId: string): Promise<Buffer | null> {
  const id = listingId.trim()
  if (!id) return null
  return loadListingCardWebpCached(id)
}
