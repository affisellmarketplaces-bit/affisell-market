import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  SUPPLIER_MEDIA_STORAGE_UNAVAILABLE,
  uploadSupplierMediaBuffer,
} from "@/lib/supplier-media-storage-core"

export type BrandStudioMediaKind = "logo" | "banner"

function contentTypeForExt(ext: string): string {
  if (ext === "svg") return "image/svg+xml"
  if (ext === "png") return "image/png"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  return "application/octet-stream"
}

async function saveLocalUpload(
  userId: string,
  prefix: string,
  ext: string,
  bytes: Buffer
): Promise<string> {
  const filename = `${prefix}-${userId}-${Date.now()}.${ext}`
  const dir = path.join(process.cwd(), "public", "uploads")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), bytes)
  return `/uploads/${filename}`
}

/** Persist AI brand logo/banner — cloud first (Vercel-safe), local only in dev. */
export async function persistBrandStudioMedia(args: {
  userId: string
  kind: BrandStudioMediaKind
  ext: string
  bytes: Buffer
}): Promise<{ url: string; storage: string }> {
  const prefix = args.kind === "logo" ? "ai-logo" : "ai-banner"
  const contentType = contentTypeForExt(args.ext)

  try {
    const uploaded = await uploadSupplierMediaBuffer({
      userId: args.userId,
      bytes: args.bytes,
      contentType,
      ext: args.ext,
      kind: "image",
      filenameBase: prefix,
      subfolder: "brand-studio",
    })
    console.log("[brand-studio-media]", {
      kind: args.kind,
      storage: uploaded.storage,
      result: "ok",
    })
    return uploaded
  } catch (cloudErr) {
    if (process.env.VERCEL === "1") {
      const message =
        cloudErr instanceof Error ? cloudErr.message : SUPPLIER_MEDIA_STORAGE_UNAVAILABLE
      console.log("[brand-studio-media]", {
        kind: args.kind,
        result: "error",
        error: message,
      })
      throw new Error(SUPPLIER_MEDIA_STORAGE_UNAVAILABLE)
    }

    const url = await saveLocalUpload(args.userId, prefix, args.ext, args.bytes)
    console.log("[brand-studio-media]", { kind: args.kind, storage: "local", result: "ok" })
    return { url, storage: "local" }
  }
}
