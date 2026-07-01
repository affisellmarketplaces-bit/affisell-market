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

export function storefrontHeaderTrustRailStyle(primary: string): CSSProperties {
  const p = normalizeHexColor(primary) ?? "#18181b"
  return {
    background: `linear-gradient(180deg, color-mix(in srgb, ${p} 86%, black 12%) 0%, color-mix(in srgb, ${p} 92%, black 6%) 100%)`,
    borderBottomColor: `color-mix(in srgb, ${p} 50%, white 8%)`,
  }
}

export function storefrontHeaderTextTone(isLight: boolean): "light" | "dark" {
  return isLight ? "dark" : "light"
}
