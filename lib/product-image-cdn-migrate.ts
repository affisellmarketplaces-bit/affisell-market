import { isInlineDataImageUrl } from "@/lib/supplier-product-images"

export type InlineImageScanRow = {
  productId: string
  productName: string
  supplierId: string
  inlineCount: number
  totalImages: number
}

export type InlineListingScanRow = {
  listingId: string
  productId: string
  inlineCount: number
  totalImages: number
}

export function parseInlineDataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/)
  if (!match) throw new Error("invalid_data_image_url")
  return Buffer.from(match[2]!, "base64")
}

export function countInlineImageUrls(urls: string[]): number {
  return urls.filter((u) => isInlineDataImageUrl(u)).length
}

export function hasInlineImageUrls(urls: string[]): boolean {
  return countInlineImageUrls(urls) > 0
}

export type MigrateImageUrlFn = (params: {
  userId: string
  dataUrl: string
  productId: string
  index: number
}) => Promise<string>

/** Map gallery URLs — inline data: entries are uploaded; others pass through. */
export async function migrateImageUrlArray(
  urls: string[],
  ctx: { userId: string; productId: string },
  migrate: MigrateImageUrlFn
): Promise<string[]> {
  const out: string[] = []
  for (let index = 0; index < urls.length; index++) {
    const url = urls[index]!.trim()
    if (!url) continue
    if (!isInlineDataImageUrl(url)) {
      out.push(url)
      continue
    }
    const cdn = await migrate({ userId: ctx.userId, dataUrl: url, productId: ctx.productId, index })
    out.push(cdn)
  }
  return out.slice(0, 10)
}

export function scanProductInlineImages(
  rows: Array<{ id: string; name: string; supplierId: string; images: string[] }>
): InlineImageScanRow[] {
  return rows
    .map((row) => ({
      productId: row.id,
      productName: row.name,
      supplierId: row.supplierId,
      inlineCount: countInlineImageUrls(row.images),
      totalImages: row.images.length,
    }))
    .filter((row) => row.inlineCount > 0)
}

export function scanListingInlineImages(
  rows: Array<{ id: string; productId: string; customImages: string[] }>
): InlineListingScanRow[] {
  return rows
    .map((row) => ({
      listingId: row.id,
      productId: row.productId,
      inlineCount: countInlineImageUrls(row.customImages),
      totalImages: row.customImages.length,
    }))
    .filter((row) => row.inlineCount > 0)
}
