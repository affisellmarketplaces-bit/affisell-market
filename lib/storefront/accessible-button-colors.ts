/**
 * Background + text colors for a solid button painted in the merchant's accent — guaranteed ≥ 4.5 : 1 (WCAG AA, normal text).
 *
 * "White text on dark colors, dark text on light ones" is not enough: mid-tone accents (coral, emerald, pink, light violet)
 * are readable with NEITHER, so the text color alone cannot fix them. Pick the better of white / near-black, and if even that
 * falls short, move the background's lightness (hue and saturation kept) just far enough. An accent that already passes is
 * returned untouched, so the merchant's color is never changed without a reason.
 */
import { hslToHex, rgbToHsl } from "@/lib/storefront/brand-palette-extract"
import { contrastRatio, hexToRgb } from "@/lib/storefront-theme-contrast"
import { normalizeHexColor } from "@/lib/storefront-theme-shared"

const WHITE = "#ffffff"
const NEAR_BLACK = "#09090b"
const AA = 4.5
const FALLBACK = { bg: "#7c3aed", fg: WHITE } as const

export type ButtonColors = { bg: string; fg: typeof WHITE | typeof NEAR_BLACK }

export function accessibleButtonColors(accent: string | null | undefined): ButtonColors {
  const hex = normalizeHexColor(accent ?? "")
  const rgb = hex ? hexToRgb(hex) : null
  if (!hex || !rgb) return { ...FALLBACK }

  const onWhite = contrastRatio(hex, WHITE) ?? 0
  const onBlack = contrastRatio(hex, NEAR_BLACK) ?? 0
  const fg = onWhite >= onBlack ? WHITE : NEAR_BLACK
  if (Math.max(onWhite, onBlack) >= AA) return { bg: hex, fg }

  // Neither reaches AA: slide lightness away from the text color (darker under white text, lighter under dark text).
  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const step = fg === WHITE ? -0.01 : 0.01
  for (let l = hsl.l + step, i = 0; i < 100 && l > 0 && l < 1; l += step, i += 1) {
    const bg = hslToHex({ ...hsl, l })
    if ((contrastRatio(bg, fg) ?? 0) >= AA) return { bg, fg }
  }
  return { ...FALLBACK }
}
