import "server-only"

import sharp from "sharp"
import { put } from "@vercel/blob"

import { fetchPublicImageBytes } from "@/lib/safe-remote-image.server"

const MAX_EDGE = 1024

export async function processTryOnUserImage(bytes: Buffer, _mimeType: string): Promise<{
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

/**
 * Download an image whose URL is not ours: a garment URL a supplier typed, or the output URL of a prediction. Goes
 * through the connection-time SSRF guard (private/loopback/metadata addresses, redirects, size, time) instead of a
 * bare `fetch`. A refused or failed download throws, as before.
 */
export async function fetchImageBytes(url: string): Promise<Buffer> {
  return fetchPublicImageBytes(url.trim(), {
    maxBytes: 10 * 1024 * 1024,
    timeoutMs: 12_000,
    maxRedirects: 3,
    allowHttp: true,
  })
}

/** True when the HOSTNAME is a Vercel Blob one — not merely when the URL contains that text somewhere. */
export function isVercelBlobUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === "https:" && url.hostname.toLowerCase().endsWith(".blob.vercel-storage.com")
  } catch {
    return false
  }
}

/** Replicate must fetch garment/human URLs — mirror hotlink-protected sources to Blob. */
export async function mirrorExternalImageToTryOnBlob(params: {
  sourceUrl: string
  folder: "garments" | "inputs"
  keySuffix: string
}): Promise<string> {
  const trimmed = params.sourceUrl.trim()
  if (isVercelBlobUrl(trimmed)) {
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
