/**
 * Zero-Wait CDN uploader — starts on file select, blocks publish until durable URL ready.
 */

import { PRODUCT_IMAGE_CANVAS } from "@/lib/product-image-upload"

export const ZERO_WAIT_CHUNK_BYTES = 512 * 1024
export const ZERO_WAIT_MAX_RETRIES = 3
export const ZERO_WAIT_BASE_BACKOFF_MS = 400

export type ZeroWaitUploadStatus =
  | "pending"
  | "processing"
  | "uploading"
  | "ready"
  | "error"

export type ZeroWaitUploadSlot = {
  id: string
  fileName: string
  status: ZeroWaitUploadStatus
  progress: number
  previewUrl: string | null
  durableUrl: string | null
  /** Client-processed JPEG data URL — InstantScan fallback when CDN hotlink fails. */
  processedDataUrl?: string | null
  error: string | null
}

export type ZeroWaitProcessFile = (file: File) => Promise<string>

export type ZeroWaitUploadChunk = (
  blob: Blob,
  meta: { fileName: string; chunkIndex: number; totalChunks: number }
) => Promise<{ url?: string; complete?: boolean }>

export function computeRetryBackoffMs(attempt: number): number {
  const n = Math.max(0, attempt)
  return ZERO_WAIT_BASE_BACKOFF_MS * 2 ** n
}

export function splitBlobIntoChunks(blob: Blob, chunkSize = ZERO_WAIT_CHUNK_BYTES): Blob[] {
  const chunks: Blob[] = []
  let offset = 0
  while (offset < blob.size) {
    chunks.push(blob.slice(offset, offset + chunkSize))
    offset += chunkSize
  }
  return chunks
}

export function canPublishWithUploads(slots: ZeroWaitUploadSlot[]): boolean {
  const withFiles = slots.filter((s) => s.status !== "pending" || s.fileName)
  if (withFiles.length === 0) return false
  return withFiles.every((s) => s.status === "ready" && Boolean(s.durableUrl?.trim()))
}

export function publishBlockedUploadMessage(slots: ZeroWaitUploadSlot[]): string | null {
  if (canPublishWithUploads(slots)) return null
  const busy = slots.filter((s) => s.status === "processing" || s.status === "uploading")
  if (busy.length > 0) {
    return "Upload en cours — vous pouvez continuer à remplir le formulaire. Publication disponible quand les photos sont prêtes."
  }
  const errored = slots.filter((s) => s.status === "error")
  if (errored.length > 0) {
    return errored[0]?.error ?? "Une photo n'a pas pu être envoyée. Réessayez l'upload."
  }
  if (slots.every((s) => s.status === "pending")) {
    return "Ajoutez au moins une photo produit."
  }
  return "Les images doivent être hébergées (CDN) avant publication."
}

export function createUploadSlot(id: string, file: File): ZeroWaitUploadSlot {
  return {
    id,
    fileName: file.name,
    status: "pending",
    progress: 0,
    previewUrl: null,
    durableUrl: null,
    error: null,
  }
}

/** Prefer AVIF when supported; JPEG fallback for Safari older builds. */
export async function encodeProductImageBlob(
  file: File,
  processFile: ZeroWaitProcessFile,
  onProcessedDataUrl?: (dataUrl: string) => void
): Promise<Blob> {
  const dataUrl = await processFile(file)
  onProcessedDataUrl?.(dataUrl)
  const res = await fetch(dataUrl)
  const jpegBlob = await res.blob()

  if (typeof createImageBitmap !== "function") return jpegBlob

  try {
    const bitmap = await createImageBitmap(jpegBlob)
    const canvas = document.createElement("canvas")
    canvas.width = PRODUCT_IMAGE_CANVAS
    canvas.height = PRODUCT_IMAGE_CANVAS
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close?.()
      return jpegBlob
    }
    ctx.fillStyle = "#F5F5F5"
    ctx.fillRect(0, 0, PRODUCT_IMAGE_CANVAS, PRODUCT_IMAGE_CANVAS)
    const pad = 120
    const max = PRODUCT_IMAGE_CANVAS - pad * 2
    const scale = Math.min(max / bitmap.width, max / bitmap.height)
    const w = bitmap.width * scale
    const h = bitmap.height * scale
    ctx.drawImage(bitmap, (PRODUCT_IMAGE_CANVAS - w) / 2, (PRODUCT_IMAGE_CANVAS - h) / 2, w, h)
    bitmap.close?.()

    const avif = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/avif", 0.82)
    })
    if (avif && avif.size > 0) return avif

    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    })
    return jpeg ?? jpegBlob
  } catch {
    return jpegBlob
  }
}

export async function uploadBlobWithChunkRetry(
  blob: Blob,
  fileName: string,
  uploadChunk: ZeroWaitUploadChunk,
  onProgress?: (pct: number) => void
): Promise<string> {
  const chunks = splitBlobIntoChunks(blob)
  let lastUrl = ""

  for (let i = 0; i < chunks.length; i++) {
    let attempt = 0
    let done = false
    while (attempt <= ZERO_WAIT_MAX_RETRIES && !done) {
      try {
        const result = await uploadChunk(chunks[i]!, {
          fileName,
          chunkIndex: i,
          totalChunks: chunks.length,
        })
        if (result.url) lastUrl = result.url
        if (result.complete && result.url) return result.url
        done = true
        onProgress?.(Math.round(((i + 1) / chunks.length) * 100))
      } catch (err) {
        attempt++
        if (attempt > ZERO_WAIT_MAX_RETRIES) {
          throw err instanceof Error ? err : new Error("upload_failed")
        }
        await new Promise((r) => setTimeout(r, computeRetryBackoffMs(attempt - 1)))
      }
    }
  }

  if (!lastUrl) throw new Error("missing_url")
  return lastUrl
}

export type RunZeroWaitUploadArgs = {
  slot: ZeroWaitUploadSlot
  file: File
  processFile: ZeroWaitProcessFile
  uploadWhole: (blob: Blob, fileName: string) => Promise<string>
  onUpdate: (patch: Partial<ZeroWaitUploadSlot>) => void
}

/** Orchestrates processing → encode → upload with progress callbacks. */
export async function runZeroWaitUpload(args: RunZeroWaitUploadArgs): Promise<ZeroWaitUploadSlot> {
  const { slot, file, processFile, uploadWhole, onUpdate } = args
  let previewUrl: string | null = null

  try {
    onUpdate({ status: "processing", progress: 5, error: null })
    previewUrl = URL.createObjectURL(file)
    onUpdate({ previewUrl, progress: 15 })

    const encoded = await encodeProductImageBlob(file, processFile, (dataUrl) => {
      onUpdate({ processedDataUrl: dataUrl, progress: 25 })
    })
    onUpdate({ status: "uploading", progress: 40 })

    const durableUrl = await uploadWhole(encoded, file.name.replace(/\.[^/.]+$/, "") || "product")
    onUpdate({ status: "ready", progress: 100, durableUrl })

    return {
      ...slot,
      status: "ready",
      progress: 100,
      previewUrl,
      durableUrl,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed"
    onUpdate({ status: "error", error: message, progress: 0 })
    return {
      ...slot,
      status: "error",
      previewUrl,
      error: message,
      progress: 0,
    }
  }
}
