import "server-only"

import {
  normalizeSupplierMediaFilename,
  uploadSupplierMediaBuffer,
} from "@/lib/supplier-media-storage.server"
import { processSupplierGalleryImageBytes } from "@/lib/supplier-gallery-process.server"

/** Process + persist one supplier gallery image (HEIC-safe). Multi-backend storage. */
export async function uploadSupplierGalleryImage(params: {
  userId: string
  bytes: Buffer
  filename: string
}): Promise<{ url: string; storage: string }> {
  const processed = await processSupplierGalleryImageBytes(params.bytes)
  const filenameBase = normalizeSupplierMediaFilename(params.filename)
  const result = await uploadSupplierMediaBuffer({
    userId: params.userId,
    bytes: processed,
    contentType: "image/jpeg",
    ext: "jpg",
    kind: "image",
    filenameBase,
    subfolder: "supplier-gallery",
  })
  console.log("[supplier-gallery-upload]", {
    userId: params.userId,
    storage: result.storage,
    result: "ok",
  })
  return result
}
