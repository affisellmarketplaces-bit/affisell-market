/** Client gallery pipeline for supplier product photos (square canvas, multi-upload). */

export const PRODUCT_IMAGE_CANVAS = 1200
export const PRODUCT_IMAGE_PAD = 120

/** InstantScan vision payload — smaller JPEG to avoid OpenAI timeouts. */
export const INSTANTSCAN_VISION_MAX_PX = 1024
export const INSTANTSCAN_VISION_JPEG_QUALITY = 0.8

/** Reject only unusably tiny sources; larger images are upscaled on the canvas. */
export const PRODUCT_GALLERY_MIN_SOURCE_PX = 320

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i

export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return IMAGE_EXTENSIONS.test(file.name)
}

/**
 * Safari/macOS: clearing `<input type="file">` invalidates the live FileList.
 * Clone bytes into fresh File objects before resetting the input.
 */
export async function snapshotGalleryFilesFromInput(
  fileList: FileList | File[]
): Promise<File[]> {
  const candidates = Array.from(fileList).filter(isLikelyImageFile)
  const out: File[] = []
  for (const file of candidates) {
    try {
      const bytes = await file.arrayBuffer()
      out.push(
        new File([bytes], file.name || "photo.jpg", {
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified,
        })
      )
    } catch {
      /* skip unreadable entries */
    }
  }
  return out
}

type DecodedImage = {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number, dx: number, dy: number) => void
  cleanup: () => void
}

async function decodeImageFile(file: File): Promise<DecodedImage> {
  try {
    const bmp = await createImageBitmap(file)
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, dw, dh, dx, dy) => ctx.drawImage(bmp, dx, dy, dw, dh),
      cleanup: () => bmp.close?.(),
    }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error("decode"))
        el.src = url
      })
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, dw, dh, dx, dy) => ctx.drawImage(img, dx, dy, dw, dh),
        cleanup: () => URL.revokeObjectURL(url),
      }
    } catch {
      URL.revokeObjectURL(url)
      throw new Error("decode")
    }
  }
}

export async function measureImageFile(file: File): Promise<{ width: number; height: number }> {
  const decoded = await decodeImageFile(file)
  try {
    return { width: decoded.width, height: decoded.height }
  } finally {
    decoded.cleanup()
  }
}

export class ProductImageMinDimensionError extends Error {
  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    super("MIN_DIMENSION")
    this.name = "ProductImageMinDimensionError"
    this.width = width
    this.height = height
  }
}

/** Fast gallery pipeline (resize on grey canvas). Used for supplier multi-upload. */
export async function processProductGalleryImageFile(
  file: File,
  options?: { minWidth?: number; minHeight?: number }
): Promise<string> {
  const minW = options?.minWidth ?? PRODUCT_GALLERY_MIN_SOURCE_PX
  const minH = options?.minHeight ?? PRODUCT_GALLERY_MIN_SOURCE_PX
  const decoded = await decodeImageFile(file)
  try {
    if (decoded.width < minW || decoded.height < minH) {
      throw new ProductImageMinDimensionError(decoded.width, decoded.height)
    }
    const canvas = document.createElement("canvas")
    canvas.width = PRODUCT_IMAGE_CANVAS
    canvas.height = PRODUCT_IMAGE_CANVAS
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No canvas")

    ctx.fillStyle = "#F5F5F5"
    ctx.fillRect(0, 0, PRODUCT_IMAGE_CANVAS, PRODUCT_IMAGE_CANVAS)

    const maxSize = PRODUCT_IMAGE_CANVAS - PRODUCT_IMAGE_PAD * 2
    const scale = Math.min(maxSize / decoded.width, maxSize / decoded.height)
    const width = decoded.width * scale
    const height = decoded.height * scale
    const x = (PRODUCT_IMAGE_CANVAS - width) / 2
    const y = (PRODUCT_IMAGE_CANVAS - height) / 2
    decoded.draw(ctx, width, height, x, y)
    return canvas.toDataURL("image/jpeg", 0.8)
  } finally {
    decoded.cleanup()
  }
}

/**
 * Re-encode a gallery data URL for InstantScan (max 1024px, JPEG q=0.8).
 * Idempotent if input is already small enough.
 */
export async function compressDataUrlForInstantScan(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("decode"))
    el.src = dataUrl
  })

  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  if (!srcW || !srcH) return dataUrl

  const scale = Math.min(1, INSTANTSCAN_VISION_MAX_PX / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL("image/jpeg", INSTANTSCAN_VISION_JPEG_QUALITY)
}

const GALLERY_UPLOAD_CONCURRENCY = 4

/** Process several files in parallel (bounded concurrency). */
export async function processProductGalleryImageFiles(
  files: File[],
  options?: { minWidth?: number; minHeight?: number; concurrency?: number }
): Promise<
  Array<
    | { ok: true; file: File; dataUrl: string }
    | { ok: false; file: File; reason: "min_dimension" | "process"; width?: number; height?: number }
  >
> {
  const concurrency = Math.max(1, options?.concurrency ?? GALLERY_UPLOAD_CONCURRENCY)
  const queue = [...files]
  const out: Awaited<ReturnType<typeof processProductGalleryImageFiles>> = []

  async function worker() {
    for (;;) {
      const file = queue.shift()
      if (!file) return
      try {
        const dataUrl = await processProductGalleryImageFile(file, options)
        out.push({ ok: true, file, dataUrl })
      } catch (e) {
        if (e instanceof ProductImageMinDimensionError) {
          out.push({
            ok: false,
            file,
            reason: "min_dimension",
            width: e.width,
            height: e.height,
          })
        } else {
          out.push({ ok: false, file, reason: "process" })
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()))
  return out
}

/** Optional background removal — much slower; not used for bulk gallery upload. */
export async function processProductImageToDataUrl(file: File): Promise<string> {
  const { removeBackgroundFromFile } = await import("@/lib/background-removal-client")
  const blob = await removeBackgroundFromFile(file)

  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = PRODUCT_IMAGE_CANVAS
        canvas.height = PRODUCT_IMAGE_CANVAS
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("No canvas"))
          return
        }

        ctx.fillStyle = "#F5F5F5"
        ctx.fillRect(0, 0, PRODUCT_IMAGE_CANVAS, PRODUCT_IMAGE_CANVAS)

        const maxSize = PRODUCT_IMAGE_CANVAS - PRODUCT_IMAGE_PAD * 2
        const scale = Math.min(maxSize / img.width, maxSize / img.height)
        const width = img.width * scale
        const height = img.height * scale
        const x = (PRODUCT_IMAGE_CANVAS - width) / 2
        const y = (PRODUCT_IMAGE_CANVAS - height) / 2

        ctx.drawImage(img, x, y, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.9))
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      reject(new Error("decode"))
    }
    img.src = blobUrl
  })
}
