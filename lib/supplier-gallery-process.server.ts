import "server-only"

import sharp from "sharp"

export const SUPPLIER_GALLERY_CANVAS = 1200
export const SUPPLIER_GALLERY_PAD = 120
export const SUPPLIER_GALLERY_MIN_PX = 320

export class SupplierGalleryMinDimensionError extends Error {
  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    super(`MIN_DIMENSION:${width}x${height}`)
    this.name = "SupplierGalleryMinDimensionError"
    this.width = width
    this.height = height
  }
}

/** Square grey canvas — mirrors client gallery pipeline; handles HEIC/HEIF via sharp. */
export async function processSupplierGalleryImageBytes(bytes: Buffer): Promise<Buffer> {
  const rotated = sharp(bytes, { failOn: "error" }).rotate()
  const meta = await rotated.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width < SUPPLIER_GALLERY_MIN_PX || height < SUPPLIER_GALLERY_MIN_PX) {
    throw new SupplierGalleryMinDimensionError(width, height)
  }

  const maxSize = SUPPLIER_GALLERY_CANVAS - SUPPLIER_GALLERY_PAD * 2
  const contained = await rotated
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "contain",
      background: { r: 245, g: 245, b: 245 },
      withoutEnlargement: false,
    })
    .flatten({ background: "#F5F5F5" })
    .toBuffer()

  return sharp({
    create: {
      width: SUPPLIER_GALLERY_CANVAS,
      height: SUPPLIER_GALLERY_CANVAS,
      channels: 3,
      background: "#F5F5F5",
    },
  })
    .composite([{ input: contained, gravity: "center" }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
}
