/**
 * Upload inline data:image/* gallery URLs to CDN (R2 / Blob / S3 / Supabase).
 *
 *   npm run db:migrate-inline-images           # apply
 *   npm run db:migrate-inline-images -- --dry-run
 *
 * Idempotent: only rows with data: URLs are touched; re-run skips https entries.
 */

import { config } from "dotenv"

import {
  migrateImageUrlArray,
  parseInlineDataUrlToBuffer,
  scanListingInlineImages,
  scanProductInlineImages,
} from "@/lib/product-image-cdn-migrate"
import { prisma } from "@/lib/prisma"
import { processSupplierGalleryImageBytes } from "@/lib/supplier-gallery-process-core"
import {
  normalizeSupplierMediaFilename,
  uploadSupplierMediaBuffer,
} from "@/lib/supplier-media-storage-core"

config({ path: ".env.local" })
config({ path: ".env" })

const dryRun = process.argv.includes("--dry-run")

async function uploadDataUrlToCdn(params: {
  userId: string
  dataUrl: string
  productId: string
  index: number
}): Promise<string> {
  const raw = parseInlineDataUrlToBuffer(params.dataUrl)
  const processed = await processSupplierGalleryImageBytes(raw)
  const filenameBase = normalizeSupplierMediaFilename(
    `migrate-${params.productId}-${params.index}`
  )
  const result = await uploadSupplierMediaBuffer({
    userId: params.userId,
    bytes: processed,
    contentType: "image/jpeg",
    ext: "jpg",
    kind: "image",
    filenameBase,
    subfolder: "supplier-gallery",
  })
  return result.url
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[migrate-inline-images] DATABASE_URL missing")
    process.exit(1)
  }

  console.log("[migrate-inline-images]", { mode: dryRun ? "dry-run" : "apply" })

  const products = await prisma.product.findMany({
    select: { id: true, name: true, supplierId: true, images: true },
  })
  const productTargets = scanProductInlineImages(products)

  const listings = await prisma.affiliateProduct.findMany({
    select: { id: true, productId: true, customImages: true },
  })
  const listingTargets = scanListingInlineImages(listings)

  const inlineProductUrls = productTargets.reduce((sum, r) => sum + r.inlineCount, 0)
  const inlineListingUrls = listingTargets.reduce((sum, r) => sum + r.inlineCount, 0)

  console.log("[migrate-inline-images]", {
    productsWithInline: productTargets.length,
    inlineProductUrls,
    listingsWithInline: listingTargets.length,
    inlineListingUrls,
  })

  if (productTargets.length === 0 && listingTargets.length === 0) {
    console.log("[migrate-inline-images]", { result: "nothing_to_migrate" })
    return
  }

  if (dryRun) {
    for (const row of productTargets) {
      console.log("[migrate-inline-images]", {
        scope: "product",
        productId: row.productId,
        name: row.productName.slice(0, 60),
        inlineCount: row.inlineCount,
      })
    }
    for (const row of listingTargets) {
      console.log("[migrate-inline-images]", {
        scope: "listing",
        listingId: row.listingId,
        productId: row.productId,
        inlineCount: row.inlineCount,
      })
    }
    return
  }

  const supplierByProduct = new Map(products.map((p) => [p.id, p.supplierId]))
  let productsUpdated = 0
  let listingsUpdated = 0

  for (const target of productTargets) {
    const row = products.find((p) => p.id === target.productId)
    if (!row) continue

    try {
      const nextImages = await migrateImageUrlArray(
        row.images,
        { userId: row.supplierId, productId: row.id },
        async (params) => {
          const url = await uploadDataUrlToCdn(params)
          console.log("[migrate-inline-images]", {
            scope: "product",
            productId: params.productId,
            index: params.index,
            result: "uploaded",
          })
          return url
        }
      )

      await prisma.product.update({
        where: { id: row.id },
        data: { images: nextImages },
      })
      productsUpdated += 1
      console.log("[migrate-inline-images]", {
        scope: "product",
        productId: row.id,
        result: "updated",
        imageCount: nextImages.length,
      })
    } catch (error) {
      console.error("[migrate-inline-images]", {
        scope: "product",
        productId: row.id,
        result: "failed",
        error,
      })
    }
  }

  for (const target of listingTargets) {
    const row = listings.find((l) => l.id === target.listingId)
    if (!row) continue
    const supplierId = supplierByProduct.get(row.productId)
    if (!supplierId) {
      console.error("[migrate-inline-images]", {
        scope: "listing",
        listingId: row.id,
        result: "skipped_no_supplier",
      })
      continue
    }

    try {
      const nextImages = await migrateImageUrlArray(
        row.customImages,
        { userId: supplierId, productId: row.productId },
        async (params) => {
          const url = await uploadDataUrlToCdn(params)
          console.log("[migrate-inline-images]", {
            scope: "listing",
            listingId: row.id,
            index: params.index,
            result: "uploaded",
          })
          return url
        }
      )

      await prisma.affiliateProduct.update({
        where: { id: row.id },
        data: { customImages: nextImages },
      })
      listingsUpdated += 1
      console.log("[migrate-inline-images]", {
        scope: "listing",
        listingId: row.id,
        result: "updated",
        imageCount: nextImages.length,
      })
    } catch (error) {
      console.error("[migrate-inline-images]", {
        scope: "listing",
        listingId: row.id,
        result: "failed",
        error,
      })
    }
  }

  console.log("[migrate-inline-images]", {
    result: "done",
    productsUpdated,
    listingsUpdated,
  })
}

main()
  .catch((error) => {
    console.error("[migrate-inline-images] fatal", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
