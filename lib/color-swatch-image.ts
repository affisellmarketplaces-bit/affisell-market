import { measureImageFile } from "@/lib/product-image-upload"
import { COLOR_SWATCH_IMAGE_MAX_STORED } from "@/lib/color-swatch-store"

export { COLOR_SWATCH_IMAGE_MAX_STORED, trimColorSwatchImageForStore } from "@/lib/color-swatch-store"

export const COLOR_SWATCH_MIN_W = 80
export const COLOR_SWATCH_MIN_H = 80
const MAX_EDGE = 512

export class ColorSwatchSizeError extends Error {
  constructor(
    readonly fileName: string,
    readonly minW: number,
    readonly minH: number
  ) {
    super("too_small")
    this.name = "ColorSwatchSizeError"
  }
}

/** Compact JPEG data URL for PDP color swatches (paste / file upload). */
export async function processColorSwatchFile(file: File): Promise<string> {
  const dim = await measureImageFile(file)
  if (dim.width < COLOR_SWATCH_MIN_W || dim.height < COLOR_SWATCH_MIN_H) {
    throw new ColorSwatchSizeError(file.name, COLOR_SWATCH_MIN_W, COLOR_SWATCH_MIN_H)
  }

  const bmp = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas")
    ctx.drawImage(bmp, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    if (dataUrl.length > COLOR_SWATCH_IMAGE_MAX_STORED) {
      throw new Error("Image trop lourde après compression.")
    }
    return dataUrl
  } finally {
    bmp.close()
  }
}
