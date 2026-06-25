/** Upload gallery images to Supabase via API — CDN URL required for product autosave. */

const UPLOAD_CONCURRENCY = 3

type PersistResult = { ok: true; url: string } | { ok: false; status?: number; detail?: string }

async function uploadGalleryFile(file: File): Promise<PersistResult> {
  const form = new FormData()
  form.append("file", file, file.name)
  try {
    const res = await fetch("/api/upload/processed-image", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { detail?: string; error?: string }
      console.log("[supplier-gallery-image]", {
        filename: file.name,
        status: res.status,
        persisted: false,
        detail: json.detail ?? json.error,
      })
      return { ok: false, status: res.status, detail: json.detail ?? json.error }
    }
    const json = (await res.json()) as { url?: string }
    const url = json.url?.trim()
    if (!url) return { ok: false, detail: "missing_url" }
    console.log("[supplier-gallery-image]", { filename: file.name, persisted: true })
    return { ok: true, url }
  } catch (error) {
    console.log("[supplier-gallery-image]", {
      filename: file.name,
      persisted: false,
      error: error instanceof Error ? error.message : "upload_failed",
    })
    return { ok: false, detail: "upload_failed" }
  }
}

async function uploadGalleryDataUrl(dataUrl: string, filename: string): Promise<PersistResult> {
  if (!dataUrl.startsWith("data:image/")) {
    const trimmed = dataUrl.trim()
    return trimmed ? { ok: true, url: trimmed } : { ok: false, detail: "empty_url" }
  }

  try {
    const res = await fetch("/api/upload/processed-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        imageData: dataUrl,
        filename: filename.replace(/\.[^/.]+$/, "") || "gallery",
      }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { detail?: string; error?: string }
      return { ok: false, status: res.status, detail: json.detail ?? json.error }
    }
    const json = (await res.json()) as { url?: string }
    const url = json.url?.trim()
    if (!url) return { ok: false, detail: "missing_url" }
    return { ok: true, url }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "upload_failed",
    }
  }
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
export async function persistSupplierGalleryFiles(files: File[]): Promise<Array<string | null>> {
  const out: Array<string | null> = new Array(files.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      const i = cursor
      cursor += 1
      if (i >= files.length) return
      out[i] = await persistSupplierGalleryFile(files[i]!)
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
      out[i] = await persistSupplierGalleryImage(item.dataUrl, item.filename)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, () => worker())
  )
  return out
}
