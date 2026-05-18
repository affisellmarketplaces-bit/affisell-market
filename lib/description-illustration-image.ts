import { measureImageFile } from "@/lib/product-image-upload"

export const DESCRIPTION_ILLUSTRATION_MAX = 4
export const DESCRIPTION_ILLUSTRATION_MIN_W = 400
export const DESCRIPTION_ILLUSTRATION_MIN_H = 400

const MAX_EDGE = 1200

export class DescriptionIllustrationSizeError extends Error {
  constructor(
    readonly fileName: string,
    readonly minW: number,
    readonly minH: number
  ) {
    super("too_small")
    this.name = "DescriptionIllustrationSizeError"
  }
}

/** Resize for description illustrations (no background removal — fast for paste). */
export async function processDescriptionIllustrationFile(file: File): Promise<string> {
  const dim = await measureImageFile(file)
  if (dim.width < DESCRIPTION_ILLUSTRATION_MIN_W || dim.height < DESCRIPTION_ILLUSTRATION_MIN_H) {
    throw new DescriptionIllustrationSizeError(
      file.name,
      DESCRIPTION_ILLUSTRATION_MIN_W,
      DESCRIPTION_ILLUSTRATION_MIN_H
    )
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
    return canvas.toDataURL("image/jpeg", 0.88)
  } finally {
    bmp.close()
  }
}

export function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return []
  const seen = new Set<File>()
  const out: File[] = []

  const push = (f: File | null) => {
    if (!f || !f.type.startsWith("image/") || seen.has(f)) return
    seen.add(f)
    out.push(f)
  }

  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      push(dt.files[i] ?? null)
    }
  }

  for (const item of dt.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      push(item.getAsFile())
    }
  }

  return out
}
