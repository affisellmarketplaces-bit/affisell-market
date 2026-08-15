/** Storefront header chrome — client-safe (no Prisma). */

import type { CSSProperties } from "react"

import { normalizeHexColor } from "@/lib/storefront-theme-shared"

export const STOREFRONT_HEADER_COLOR_SWATCHES = [
  "#18181b",
  "#0f172a",
  "#1e1b4b",
  "#4c1d95",
  "#064e3b",
  "#881337",
  "#7c2d12",
  "#f8fafc",
  "#faf5ff",
] as const

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHexColor(hex)
  if (!n) return null
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

/** WCAG relative luminance — used to pick light vs dark header text. */
export function storefrontHeaderLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const channels = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

export function isLightStorefrontHeader(primary: string): boolean {
  return storefrontHeaderLuminance(primary) > 0.58
}

export function storefrontHeaderShellStyle(primary: string, accent: string): CSSProperties {
  const p = normalizeHexColor(primary) ?? "#18181b"
  const a = normalizeHexColor(accent) ?? "#7c3aed"
  return {
    background: `linear-gradient(180deg, color-mix(in srgb, ${p} 90%, white 6%) 0%, color-mix(in srgb, ${p} 94%, black 8%) 100%)`,
    borderBottomColor: `color-mix(in srgb, ${p} 55%, white 14%)`,
    "--store-header-accent-glow": `color-mix(in srgb, ${a} 24%, transparent)`,
  } as CSSProperties
}

export function storefrontHeaderTrustRailStyle(primary: string, accent?: string): CSSProperties {
  const p = normalizeHexColor(primary) ?? "#18181b"
  const a = normalizeHexColor(accent) ?? "#7c3aed"
  return {
    background: `linear-gradient(90deg, color-mix(in srgb, ${a} 14%, white 86%) 0%, color-mix(in srgb, ${p} 8%, white 92%) 48%, color-mix(in srgb, ${a} 12%, white 88%) 100%)`,
    borderBottomColor: `color-mix(in srgb, ${a} 32%, ${p} 14%)`,
    boxShadow: `inset 0 1px 0 0 color-mix(in srgb, white 72%, transparent)`,
  }
}

/** Default black — merchants can override via `storefrontTheme.trustRailText`. */
export function storefrontTrustRailTextColor(trustRailText?: string): string {
  return normalizeHexColor(trustRailText) ?? "#18181b"
}

export type StorefrontTrustRailColors = {
  text: string
  icon: string
  pillBorder: string
  pillBg: string
}

const TRUST_RAIL_SURFACE = "#f4f4f5"

function contrastRatio(foreground: string, background: string): number {
  const fg = storefrontHeaderLuminance(foreground)
  const bg = storefrontHeaderLuminance(background)
  const lighter = Math.max(fg, bg)
  const darker = Math.min(fg, bg)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Ensures trust rail labels stay readable on the light glass band (ignores low-contrast accent picks). */
export function resolveStorefrontTrustRailColors(
  primary: string,
  accent?: string,
  trustRailText?: string
): StorefrontTrustRailColors {
  const a = normalizeHexColor(accent) ?? "#7c3aed"
  const p = normalizeHexColor(primary) ?? "#18181b"
  const custom = normalizeHexColor(trustRailText)

  let text = "#0f172a"
  if (custom && contrastRatio(custom, TRUST_RAIL_SURFACE) >= 4.5) {
    text = custom
  }

  return {
    text,
    icon: a,
    pillBorder: `color-mix(in srgb, ${a} 42%, ${p} 18%)`,
    pillBg: `color-mix(in srgb, ${a} 10%, white 90%)`,
  }
}

export function storefrontHeaderTextTone(isLight: boolean): "light" | "dark" {
  return isLight ? "dark" : "light"
}
