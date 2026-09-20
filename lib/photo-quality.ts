/**
 * Product photo quality — pure, client-safe. A storefront looks like a copied feed when its photos are small,
 * repeated, oddly cropped or shot on a busy background. Everything here is MEASURED (pixels, bytes, hashes);
 * nothing is guessed. Text overlays and watermarks cannot be measured reliably — they go to the optional AI review.
 */

/** Below this the photo cannot be zoomed and looks blurry on a retina phone. */
export const PHOTO_MIN_SIDE_HARD = 600
/** Comfortable for zoom on desktop and phones. */
export const PHOTO_MIN_SIDE_GOOD = 1000
export const GALLERY_MIN_PHOTOS = 3

export type PhotoIssue =
  | "unreadable"
  | "too_small"
  | "low_res"
  | "extreme_ratio"
  | "over_compressed"
  | "dark_background"
  | "busy_background"
  | "duplicate"

export type PhotoMetrics = {
  width: number
  height: number
  bytes: number
  format: string
  /** Mean luma (0–255) of the four corners: a studio / marketplace-standard shot has bright, uniform corners. */
  cornerLuma: [number, number, number, number]
  /** 64-bit difference hash (16 hex chars) for near-duplicate detection. */
  dHash: string
}

export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}

/** Two photos this close (of 64 bits) are the same picture re-cropped / re-compressed. */
export const DUPLICATE_HAMMING_MAX = 5

export function assessPhoto(m: PhotoMetrics, opts?: { isMain?: boolean }): PhotoIssue[] {
  const issues: PhotoIssue[] = []
  const side = Math.min(m.width, m.height)
  if (side < PHOTO_MIN_SIDE_HARD) issues.push("too_small")
  else if (side < PHOTO_MIN_SIDE_GOOD) issues.push("low_res")
  const ratio = m.width / Math.max(1, m.height)
  if (ratio < 0.6 || ratio > 1.7) issues.push("extreme_ratio")
  // Big canvas, tiny file = heavy compression artefacts.
  if (side >= PHOTO_MIN_SIDE_HARD && m.bytes < side * 22) issues.push("over_compressed")
  if (opts?.isMain) {
    const mean = m.cornerLuma.reduce((a, b) => a + b, 0) / 4
    const spread = Math.max(...m.cornerLuma) - Math.min(...m.cornerLuma)
    if (mean < 110) issues.push("dark_background")
    else if (spread > 70) issues.push("busy_background")
  }
  return issues
}

export type GalleryIssue = "too_few" | "mixed_sizes" | "duplicates"

export type GalleryAssessment = {
  perImage: { issues: PhotoIssue[] }[]
  galleryIssues: GalleryIssue[]
  /** 0–100. */
  score: number
}

/** `metrics[i]` is null when the image could not be read (unreachable, not an image, too large…). */
export function assessGallery(metrics: readonly (PhotoMetrics | null)[]): GalleryAssessment {
  const perImage = metrics.map((m, i): { issues: PhotoIssue[] } =>
    m ? { issues: assessPhoto(m, { isMain: i === 0 }) } : { issues: ["unreadable"] }
  )

  // Duplicates: a later photo close to an earlier one.
  metrics.forEach((m, i) => {
    if (!m) return
    for (let j = 0; j < i; j++) {
      const other = metrics[j]
      if (other && hammingHex(m.dHash, other.dHash) <= DUPLICATE_HAMMING_MAX) {
        perImage[i]!.issues.push("duplicate")
        break
      }
    }
  })

  const readable = metrics.filter((m): m is PhotoMetrics => m != null)
  const galleryIssues: GalleryIssue[] = []
  if (readable.length < GALLERY_MIN_PHOTOS) galleryIssues.push("too_few")
  if (perImage.some((p) => p.issues.includes("duplicate"))) galleryIssues.push("duplicates")
  const sides = readable.map((m) => Math.min(m.width, m.height))
  if (sides.length >= 2 && Math.max(...sides) > Math.min(...sides) * 2.2) galleryIssues.push("mixed_sizes")

  // Score: main photo counts double; each blocking issue costs, soft issues cost less.
  const weightOf = (issue: PhotoIssue) =>
    issue === "unreadable" || issue === "too_small" ? 30 : issue === "duplicate" || issue === "extreme_ratio" ? 14 : 8
  let penalty = 0
  perImage.forEach((p, i) => {
    const w = i === 0 ? 2 : 1
    for (const issue of p.issues) penalty += weightOf(issue) * w
  })
  penalty += galleryIssues.length * 10
  const score = Math.max(0, Math.min(100, 100 - Math.round(penalty / Math.max(1, Math.sqrt(perImage.length)))))
  return { perImage, galleryIssues, score }
}

/**
 * Marketplace CDNs serve thumbnails through a size suffix: `…/S123.jpg_640x640.jpg`, `….jpg_Q90.jpg_.webp`.
 * The un-suffixed URL is the original. Returned only as a CANDIDATE — the caller must verify it is bigger and loads.
 */
export function originalResolutionCandidate(url: string): string | null {
  const m = /^(https?:\/\/[^?#]*?\.(?:jpe?g|png|webp))_(?:\d{2,4}x\d{2,4}|Q\d{1,3})[^/?#]*$/i.exec(url.trim())
  if (m) return m[1]!
  return null
}
