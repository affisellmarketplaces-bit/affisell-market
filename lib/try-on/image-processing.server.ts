import "server-only"

import sharp from "sharp"
import { put } from "@vercel/blob"

const MAX_EDGE = 1024

export async function processTryOnUserImage(bytes: Buffer, mimeType: string): Promise<{
  bytes: Buffer
  contentType: string
  width: number
  height: number
}> {
  const pipeline = sharp(bytes, { failOn: "error" }).rotate()
  const meta = await pipeline.metadata()
  const width = meta.width ?? MAX_EDGE
  const height = meta.height ?? MAX_EDGE
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))

  const out = await pipeline
    .resize({
      width: scale < 1 ? Math.round(width * scale) : undefined,
      height: scale < 1 ? Math.round(height * scale) : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toBuffer()

  const outMeta = await sharp(out).metadata()
  return {
    bytes: out,
    contentType: "image/webp",
    width: outMeta.width ?? width,
    height: outMeta.height ?? height,
  }
}

export async function uploadTryOnBlob(params: {
  bytes: Buffer
  contentType: string
  folder: "inputs" | "outputs" | "garments"
  keySuffix: string
}): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured for try-on uploads")
  }
  const date = new Date().toISOString().slice(0, 10)
  const key = `try-on/${params.folder}/${date}/${Date.now()}-${params.keySuffix}.webp`
  const blob = await put(key, params.bytes, {
    access: "public",
    contentType: params.contentType,
    token,
  })
  return blob.url
}

export async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status})`)
  }
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

/** Replicate must fetch garment/human URLs — mirror hotlink-protected sources to Blob. */
export async function mirrorExternalImageToTryOnBlob(params: {
  sourceUrl: string
  folder: "garments" | "inputs"
  keySuffix: string
}): Promise<string> {
  const trimmed = params.sourceUrl.trim()
  if (trimmed.includes(".blob.vercel-storage.com")) {
    return trimmed
  }

  const bytes = await fetchImageBytes(trimmed)
  const processed = await sharp(bytes, { failOn: "error" })
    .rotate()
    .webp({ quality: 90 })
    .toBuffer()

  return uploadTryOnBlob({
    bytes: processed,
    contentType: "image/webp",
    folder: params.folder,
    keySuffix: params.keySuffix,
  })
}
