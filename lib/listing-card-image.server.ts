import "server-only"

import { unstable_cache } from "next/cache"
import sharp from "sharp"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { listingCardImageCacheTag } from "@/lib/listing-card-image-shared"
import { isUsableProductImageUrl } from "@/lib/product-image-url"
import { prisma } from "@/lib/prisma"
import { fetchPublicImageBytes } from "@/lib/safe-remote-image.server"
import { isImageSniff, sniffUploadBytes } from "@/lib/upload-content-sniff"

const CARD_MAX_WIDTH = 480
const CARD_WEBP_QUALITY = 80

/**
 * The source URL is chosen by the affiliate or the supplier, and this route is public: what is fetched and decoded
 * is bounded (size, time, redirects, pixels) and limited to formats a card never needs more than.
 */
const SOURCE_MAX_BYTES = 8 * 1024 * 1024
const SOURCE_TIMEOUT_MS = 8_000
const SOURCE_MAX_REDIRECTS = 3
const SOURCE_MAX_PIXELS = 40_000_000

class ListingCardImageMiss extends Error {
  constructor() {
    super("listing_card_image_miss")
    this.name = "ListingCardImageMiss"
  }
}

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
  // base64 is 4 characters for 3 bytes: refuse before decoding, not after
  if (match[2]!.length > Math.ceil((SOURCE_MAX_BYTES * 4) / 3) + 4) throw new Error("Data image too large")
  return Buffer.from(match[2]!, "base64")
}

async function sourceBytes(sourceUrl: string): Promise<Buffer> {
  if (sourceUrl.startsWith("data:image/")) {
    return parseDataUrlToBuffer(sourceUrl)
  }
  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    return fetchPublicImageBytes(sourceUrl, {
      maxBytes: SOURCE_MAX_BYTES,
      timeoutMs: SOURCE_TIMEOUT_MS,
      maxRedirects: SOURCE_MAX_REDIRECTS,
      allowHttp: true,
    })
  }
  throw new Error("Unsupported image source")
}

async function renderListingCardWebp(sourceUrl: string): Promise<Buffer> {
  const input = await sourceBytes(sourceUrl)
  // Decide the format from the bytes, never from the URL or a header: SVG, AVIF/HEIF and TIFF (the decoders with
  // the most `sharp` advisories) are not needed for a 480 px card and are refused here.
  const sniffed = sniffUploadBytes(input)
  if (!sniffed || !isImageSniff(sniffed.kind)) throw new Error("Unsupported image format")
  return sharp(input, { failOn: "error", limitInputPixels: SOURCE_MAX_PIXELS })
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

/** Cache only successful WebP renders — misses are not stored (avoids sticky placeholders). */
function loadListingCardWebpCached(listingId: string): Promise<Buffer | null> {
  return unstable_cache(
    async () => {
      const buf = await loadListingCardWebpUncached(listingId)
      if (!buf) throw new ListingCardImageMiss()
      return buf.toString("base64")
    },
    ["listing-card-image-v2", listingId],
    { revalidate: 86_400, tags: [listingCardImageCacheTag(listingId)] }
  )()
    .then((encoded) => Buffer.from(encoded, "base64"))
    .catch((error: unknown) => {
      if (error instanceof ListingCardImageMiss) return null
      throw error
    })
}

export async function getListingCardImageWebp(listingId: string): Promise<Buffer | null> {
  const id = listingId.trim()
  if (!id) return null
  return loadListingCardWebpCached(id)
}
