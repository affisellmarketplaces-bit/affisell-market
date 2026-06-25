/** Upload processed gallery JPEG to Supabase via API — fallback to data URL when storage is unavailable. */

const UPLOAD_CONCURRENCY = 3

export async function persistSupplierGalleryImage(
  dataUrl: string,
  filename: string
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl.trim()

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
      console.log("[supplier-gallery-image]", { filename, status: res.status, persisted: false })
      return dataUrl
    }
    const json = (await res.json()) as { url?: string }
    const url = json.url?.trim()
    if (!url) return dataUrl
    console.log("[supplier-gallery-image]", { filename, persisted: true })
    return url
  } catch (error) {
    console.log("[supplier-gallery-image]", {
      filename,
      persisted: false,
      error: error instanceof Error ? error.message : "upload_failed",
    })
    return dataUrl
  }
}

/** Persist several gallery images with bounded parallelism. */
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
