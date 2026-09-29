/**
 * WCAG 2.1 contrast checks for a merchant's chosen storefront colors — safe for `"use client"`.
 *
 * Brand Studio lets a merchant pick any hex for `primary`/`accent`/`trustRailText`, with no
 * feedback on whether the result is actually legible. Grounded in the real CSS: `--store-accent`
 * is used both as body-scale text (`.store-pdp-accent-text`) and as a full-strength UI background
 * (`.store-pdp-chip-selected`) in `app/globals.css` — so accent gets both a text-contrast check
 * (1.4.3, 4.5:1) and a UI-component check (1.4.11, 3:1), not just one generic ratio. `trustRailText`
 * is checked against the real backgrounds a "light"/"glass" surface renders as light-OS vs.
 * dark-OS (`storefrontSurfaceClass` in storefront-theme-shared.ts): a merchant can't control a
 * buyer's OS theme, so both are checked and either failing is flagged.
 */

export type WcagCriterion = "text" | "ui"
export type WcagRating = "AAA" | "AA" | "fail"

const HEX_RE = /^#([0-9a-f]{6})$/i

/** @returns null for an invalid/non-normalized hex — callers should normalize first. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = HEX_RE.exec(hex.trim())
  if (!m) return null
  const n = Number.parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function srgbChannelToLinear(c: number): number {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(srgbChannelToLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colors, 1 (identical) to 21 (black vs white). Null if either hex is invalid. */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const rgbA = hexToRgb(hexA)
  const rgbB = hexToRgb(hexB)
  if (!rgbA || !rgbB) return null
  const lA = relativeLuminance(rgbA)
  const lB = relativeLuminance(rgbB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * "text" = WCAG 1.4.3 (body-scale text): AA 4.5:1, AAA 7:1.
 * "ui" = WCAG 1.4.11 (buttons/icons/badges/borders — non-text UI components): AA 3:1, AAA 4.5:1.
 */
export function wcagRating(ratio: number | null, criterion: WcagCriterion): WcagRating {
  if (ratio == null) return "fail"
  const [aa, aaa] = criterion === "text" ? [4.5, 7] : [3, 4.5]
  if (ratio >= aaa) return "AAA"
  if (ratio >= aa) return "AA"
  return "fail"
}

export type StorefrontContrastCheck = {
  id: string
  labelKey: string
  criterion: WcagCriterion
  foreground: string
  background: string
  ratio: number | null
  rating: WcagRating
}

const WHITE = "#ffffff"
const NEAR_BLACK = "#09090b"
/** Matches `storefrontSurfaceClass`'s "light"/"glass" light-OS background (zinc-50). */
const LIGHT_SURFACE = "#fafafa"

function buildCheck(
  id: string,
  labelKey: string,
  criterion: WcagCriterion,
  foreground: string | undefined,
  background: string
): StorefrontContrastCheck {
  const fg = foreground ?? "#000000"
  const ratio = contrastRatio(fg, background)
  return { id, labelKey, criterion, foreground: fg, background, ratio, rating: wcagRating(ratio, criterion) }
}

/**
 * Real, rendered color pairs only — not every `color-mix()` tint in globals.css (those blend
 * toward white/black at low percentages and are close to contrast-safe by construction; modeling
 * every blend would be fragile busywork that drifts the moment the CSS changes). These are the
 * full-strength pairs that actually appear on the live storefront.
 */
export function assessStorefrontThemeContrast(theme: {
  primary?: string
  accent?: string
  trustRailText?: string
  surface?: "light" | "dark" | "glass"
}): StorefrontContrastCheck[] {
  const checks: StorefrontContrastCheck[] = [
    buildCheck("accentUiLight", "accentUiLight", "ui", theme.accent, WHITE),
    buildCheck("accentUiDark", "accentUiDark", "ui", theme.accent, NEAR_BLACK),
    buildCheck("primaryText", "primaryText", "text", theme.primary, WHITE),
  ]

  if (theme.surface !== "dark") {
    checks.push(buildCheck("trustRailLight", "trustRailLight", "text", theme.trustRailText, LIGHT_SURFACE))
  }
  // Every surface can render on a dark-OS visitor — "light"/"glass" flip dark via `dark:` classes.
  checks.push(buildCheck("trustRailDark", "trustRailDark", "text", theme.trustRailText, NEAR_BLACK))

  return checks
}

/** Convenience summary for a compact "N/5 pass AA" style rollup. */
export function summarizeStorefrontThemeContrast(checks: StorefrontContrastCheck[]): {
  total: number
  passing: number
  allPass: boolean
} {
  const passing = checks.filter((c) => c.rating !== "fail").length
  return { total: checks.length, passing, allPass: passing === checks.length }
}
