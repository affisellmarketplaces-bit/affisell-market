/**
 * Upload gallery images via API — multipart raw file or client-processed JPEG fallback.
 */

import {
  processProductGalleryImageFile,
  ProductImageMinDimensionError,
} from "@/lib/product-image-upload"

const UPLOAD_CONCURRENCY = 2
const UPLOAD_RETRIES = 2
const UPLOAD_TIMEOUT_MS = 90_000
/** Vercel serverless body ~4.5 MB — large iPhone photos must use client-processed JPEG. */
const MULTIPART_MAX_BYTES = 3_500_000

type PersistResult = { ok: true; url: string } | { ok: false; status?: number; detail?: string }

function uploadSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
  }
  return undefined
}

function isMinDimensionDetail(detail: string | undefined): boolean {
  if (!detail) return false
  return /minimum\s+320|too small|MIN_DIMENSION/i.test(detail)
}

export function shouldSkipClientFallback(result: PersistResult & { ok: false }): boolean {
  if (result.status === 401 || result.status === 403) return true
  return isMinDimensionDetail(result.detail)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function uploadGalleryMultipart(file: File): Promise<PersistResult> {
  const form = new FormData()
  form.append("file", file, file.name)

  let last: PersistResult = { ok: false, detail: "upload_failed" }

  for (let attempt = 0; attempt <= UPLOAD_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/upload/processed-image", {
        method: "POST",
        credentials: "same-origin",
        body: form,
        signal: uploadSignal(),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string; error?: string }
        last = { ok: false, status: res.status, detail: json.detail ?? json.error }
        console.log("[supplier-gallery-image]", {
          filename: file.name,
          status: res.status,
          persisted: false,
          attempt,
          detail: last.detail,
        })
        if (res.status < 500 || attempt >= UPLOAD_RETRIES) return last
      } else {
        const json = (await res.json()) as { url?: string }
        const url = json.url?.trim()
        if (!url) return { ok: false, detail: "missing_url" }
        console.log("[supplier-gallery-image]", { filename: file.name, persisted: true, via: "multipart" })
        return { ok: true, url }
      }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError"
      last = {
        ok: false,
        detail: timedOut ? "upload_timeout" : error instanceof Error ? error.message : "upload_failed",
      }
      console.log("[supplier-gallery-image]", {
        filename: file.name,
        persisted: false,
        attempt,
        error: last.detail,
      })
    }
    if (attempt < UPLOAD_RETRIES) await sleep(400 * (attempt + 1))
  }

  return last
}

async function uploadGalleryDataUrl(dataUrl: string, filename: string): Promise<PersistResult> {
  if (!dataUrl.startsWith("data:image/")) {
    const trimmed = dataUrl.trim()
    return trimmed ? { ok: true, url: trimmed } : { ok: false, detail: "empty_url" }
  }

  let last: PersistResult = { ok: false, detail: "upload_failed" }

  for (let attempt = 0; attempt <= UPLOAD_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/upload/processed-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: uploadSignal(),
        body: JSON.stringify({
          imageData: dataUrl,
          filename: filename.replace(/\.[^/.]+$/, "") || "gallery",
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string; error?: string }
        last = { ok: false, status: res.status, detail: json.detail ?? json.error }
        if (res.status < 500 || attempt >= UPLOAD_RETRIES) return last
      } else {
        const json = (await res.json()) as { url?: string }
        const url = json.url?.trim()
        if (!url) return { ok: false, detail: "missing_url" }
        console.log("[supplier-gallery-image]", { filename, persisted: true, via: "json" })
        return { ok: true, url }
      }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError"
      last = {
        ok: false,
        detail: timedOut ? "upload_timeout" : error instanceof Error ? error.message : "upload_failed",
      }
    }
    if (attempt < UPLOAD_RETRIES) await sleep(400 * (attempt + 1))
  }

  return last
}

async function uploadGalleryFileViaClientProcess(file: File): Promise<PersistResult> {
  try {
    const dataUrl = await processProductGalleryImageFile(file)
    return uploadGalleryDataUrl(dataUrl, file.name)
  } catch (error) {
    if (error instanceof ProductImageMinDimensionError) {
      return {
        ok: false,
        status: 400,
        detail: `Minimum 320×320 px (got ${error.width}×${error.height})`,
      }
    }
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "client_process_failed",
    }
  }
}

/** Multipart when small enough; otherwise client JPEG pipeline (under Vercel body limit). */
export async function uploadGalleryFile(file: File): Promise<PersistResult> {
  if (file.size > MULTIPART_MAX_BYTES) {
    return uploadGalleryFileViaClientProcess(file)
  }

  const direct = await uploadGalleryMultipart(file)
  if (direct.ok) return direct
  if (shouldSkipClientFallback(direct)) return direct

  const fallback = await uploadGalleryFileViaClientProcess(file)
  if (fallback.ok) return fallback

  return direct.detail ? direct : fallback
}

/** Prefer raw file upload (HEIC-safe server pipeline). */
export async function persistSupplierGalleryFile(file: File): Promise<string | null> {
  const result = await uploadGalleryFile(file)
  return result.ok ? result.url : null
}

export async function persistSupplierGalleryImage(
  dataUrl: string,
  filename: string
): Promise<string> {
  const result = await uploadGalleryDataUrl(dataUrl, filename)
  if (result.ok) return result.url
  if (!dataUrl.startsWith("data:image/")) return dataUrl.trim()
  return dataUrl
}

/** Persist several gallery files with bounded parallelism. */
export type GalleryPersistResult = { url: string | null; error?: string }

export async function persistSupplierGalleryFiles(files: File[]): Promise<GalleryPersistResult[]> {
  const out: GalleryPersistResult[] = new Array(files.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      const i = cursor
      cursor += 1
      if (i >= files.length) return
      const file = files[i]!
      const result = await uploadGalleryFile(file)
      out[i] = result.ok ? { url: result.url } : { url: null, error: result.detail }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, () => worker())
  )
  return out
}

/** @deprecated Prefer persistSupplierGalleryFiles — kept for URL paste flows. */
export async function persistSupplierGalleryImages(
  items: Array<{ dataUrl: string; filename: string }>
): Promise<string[]> {
  const out: string[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      const i = cursor
      cursor += 1
      if (i >= items.length) return
      const item = items[i]!
      const result = await uploadGalleryDataUrl(item.dataUrl, item.filename)
      out[i] = result.ok ? result.url : item.dataUrl
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, () => worker())
  )
  return out
}
