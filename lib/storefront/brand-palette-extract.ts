/**
 * Brand palette from a logo — pure functions over RGBA pixels (no DOM, no React), so they are deterministic and testable.
 *
 * A merchant's logo already carries their brand colors; asking them to find the matching hex values by hand is where
 * most storefronts end up on default blue. This reads the logo's dominant colors and proposes a `primary` and an `accent`
 * — and, because a color taken straight from a logo is often illegible as text or too faint as a button, nudges each one
 * (lightness only, hue and saturation kept) until it satisfies the SAME WCAG checks the studio's contrast panel runs:
 *   • primary on white, body text:        ≥ 4.5 : 1   (`primaryText`)
 *   • accent as a UI color, light + dark: ≥ 3 : 1 on white AND on near-black (`accentUiLight` / `accentUiDark`)
 * The suggestion therefore never turns the contrast panel red.
 */
import { contrastRatio, hexToRgb, relativeLuminance } from "@/lib/storefront-theme-contrast"

export type BrandPaletteColor = { hex: string; share: number }

export type BrandPaletteSuggestion = {
  /** Accessible primary (text-safe on white). */
  primary: string
  /** Accessible accent (UI-safe on both light and dark). */
  accent: string
  /** The logo's raw dominant colors, most prominent first (for display), before accessibility adjustment. */
  dominant: BrandPaletteColor[]
  /** True when the logo had no second distinct color and the accent was derived from the primary. */
  accentDerived: boolean
}

const MIN_PIXELS = 12
/** Slightly inside the exact luminance band [0.109, 0.30] the accent checks require, so rounding to hex cannot fail. */
const ACCENT_LUM_MIN = 0.12
const ACCENT_LUM_MAX = 0.27
const PRIMARY_MIN_CONTRAST_ON_WHITE = 4.6

type Hsl = { h: number; s: number; l: number }
type Cluster = { r: number; g: number; b: number; count: number; score: number }

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h * 60, s, l }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: [number, number, number]
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`
}

function hexToHsl(hex: string): Hsl {
  const rgb = hexToRgb(hex)!
  return rgbToHsl(rgb[0], rgb[1], rgb[2])
}

function luminanceOf(hex: string): number {
  return relativeLuminance(hexToRgb(hex)!)
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Darkens (same hue/saturation) until the color is readable as body text on white. */
export function makePrimaryAccessible(hex: string): string {
  const hsl = hexToHsl(hex)
  let { l } = hsl
  for (let i = 0; i < 100; i += 1) {
    const candidate = hslToHex({ ...hsl, l })
    if ((contrastRatio(candidate, "#ffffff") ?? 0) >= PRIMARY_MIN_CONTRAST_ON_WHITE) return candidate
    l -= 0.01
    if (l < 0) break
  }
  return hslToHex({ ...hsl, l: 0.05 })
}

/** Moves lightness (same hue/saturation) until the color is a safe UI color on both white and near-black backgrounds. */
export function makeAccentAccessible(hex: string): string {
  const hsl = hexToHsl(hex)
  const lum = (l: number) => luminanceOf(hslToHex({ ...hsl, l }))
  let l = hsl.l
  for (let i = 0; i < 100; i += 1) {
    const current = lum(l)
    if (current >= ACCENT_LUM_MIN && current <= ACCENT_LUM_MAX) return hslToHex({ ...hsl, l })
    l += current < ACCENT_LUM_MIN ? 0.01 : -0.01
    if (l <= 0 || l >= 1) break
  }
  // Pure black/white-ish input: no lightness works at zero saturation, so give it a neutral blue-grey that does.
  return makeAccentAccessible(hslToHex({ h: hsl.h, s: Math.max(hsl.s, 0.4), l: 0.4 }))
}

/**
 * @param pixels flat RGBA array (e.g. `ImageData.data` of a logo downscaled to ~64×64)
 * @returns null when the image has too few visible, non-white pixels to say anything (blank, white, or fully transparent)
 */
export function extractBrandPalette(pixels: ArrayLike<number>): BrandPaletteSuggestion | null {
  // 1) Bucket visible, non-background pixels into a 16³ color grid.
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>()
  let total = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3]!
    if (a < 128) continue
    const r = pixels[i]!
    const g = pixels[i + 1]!
    const b = pixels[i + 2]!
    if (r > 234 && g > 234 && b > 234) continue // white / paper background
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.count += 1
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
    total += 1
  }
  if (total < MIN_PIXELS) return null

  // 2) Score buckets: prominence × vividness, so a big grey outline does not beat a smaller brand color.
  const scored: Cluster[] = [...buckets.values()].map((b) => {
    const r = b.r / b.count
    const g = b.g / b.count
    const bl = b.b / b.count
    const { s, l } = rgbToHsl(r, g, bl)
    const midtone = l > 0.12 && l < 0.88 ? 1 : 0.6
    return { r, g, b: bl, count: b.count, score: b.count * (0.25 + s) * midtone }
  })
  scored.sort((a, b) => b.score - a.score)

  // 3) Greedy merge of near-identical shades into clusters.
  const clusters: Cluster[] = []
  for (const c of scored) {
    const near = clusters.find((k) => Math.hypot(k.r - c.r, k.g - c.g, k.b - c.b) < 56)
    if (near) {
      const n = near.count + c.count
      near.r = (near.r * near.count + c.r * c.count) / n
      near.g = (near.g * near.count + c.g * c.count) / n
      near.b = (near.b * near.count + c.b * c.count) / n
      near.count = n
      near.score += c.score
    } else {
      clusters.push({ ...c })
    }
  }
  clusters.sort((a, b) => b.score - a.score)

  const dominant: BrandPaletteColor[] = [...clusters]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({ hex: rgbToHex(c.r, c.g, c.b), share: c.count / total }))

  // 4) Primary = top-scoring cluster; accent = the next one that is clearly a different hue, else derived.
  const top = clusters[0]!
  const primaryRaw = rgbToHex(top.r, top.g, top.b)
  const primaryHsl = hexToHsl(primaryRaw)

  const second = clusters.slice(1).find((c) => {
    const hsl = rgbToHsl(c.r, c.g, c.b)
    return hsl.s >= 0.2 && (primaryHsl.s < 0.2 || hueDistance(hsl.h, primaryHsl.h) >= 25)
  })

  let accentRaw: string
  let accentDerived = false
  if (second) {
    accentRaw = rgbToHex(second.r, second.g, second.b)
  } else {
    // Split-complementary of the primary, vivid enough to read as an accent rather than a tint.
    accentRaw = hslToHex({ h: primaryHsl.h + 150, s: Math.max(0.55, primaryHsl.s), l: 0.45 })
    accentDerived = true
  }

  const primary = makePrimaryAccessible(primaryRaw)
  let accent = makeAccentAccessible(accentRaw)
  // Two near-identical colors make a flat storefront: push the accent's hue away if they collapsed together.
  if ((contrastRatio(primary, accent) ?? 21) < 1.35) {
    const hsl = hexToHsl(accent)
    accent = makeAccentAccessible(hslToHex({ ...hsl, h: hsl.h + 45, s: Math.max(hsl.s, 0.5) }))
  }

  return { primary, accent, dominant, accentDerived }
}
