/** Pixel rect of an object-contain image inside a container (with optional padding). */
export type ContainedImageRect = {
  left: number
  top: number
  width: number
  height: number
}

export type BoxPadding = {
  top: number
  right: number
  bottom: number
  left: number
}

export function parsePaddingPx(padding: string): BoxPadding {
  const parts = padding.split(/\s+/).map((p) => parseFloat(p) || 0)
  if (parts.length === 1) {
    return { top: parts[0]!, right: parts[0]!, bottom: parts[0]!, left: parts[0]! }
  }
  if (parts.length === 2) {
    return { top: parts[0]!, right: parts[1]!, bottom: parts[0]!, left: parts[1]! }
  }
  if (parts.length === 3) {
    return { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[1]! }
  }
  return { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[3]! }
}

/** Matches CSS `object-fit: contain` placement in a padded box. */
export function computeObjectContainRect(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  padding: BoxPadding = { top: 0, right: 0, bottom: 0, left: 0 }
): ContainedImageRect {
  const innerW = Math.max(0, containerWidth - padding.left - padding.right)
  const innerH = Math.max(0, containerHeight - padding.top - padding.bottom)

  if (innerW <= 0 || innerH <= 0) {
    return { left: padding.left, top: padding.top, width: 0, height: 0 }
  }
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { left: padding.left, top: padding.top, width: innerW, height: innerH }
  }

  const scale = Math.min(innerW / naturalWidth, innerH / naturalHeight)
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  const left = padding.left + (innerW - width) / 2
  const top = padding.top + (innerH - height) / 2

  return { left, top, width, height }
}

/** Pointer position as 0–100% inside the contained image (null if outside). */
export function pointerPercentInContainedImage(
  localX: number,
  localY: number,
  image: ContainedImageRect
): { x: number; y: number } | null {
  if (image.width <= 0 || image.height <= 0) return null
  if (
    localX < image.left ||
    localY < image.top ||
    localX > image.left + image.width ||
    localY > image.top + image.height
  ) {
    return null
  }
  const x = ((localX - image.left) / image.width) * 100
  const y = ((localY - image.top) / image.height) * 100
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  }
}
