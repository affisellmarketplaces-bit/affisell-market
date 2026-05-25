/** Storefront theme — safe for `"use client"` (no Prisma). */

export type StorefrontTheme = {
  primary?: string
  accent?: string
}

const HEX_RE = /^#[0-9a-f]{6}$/i

export const DEFAULT_STOREFRONT_THEME: StorefrontTheme = {
  primary: "#18181b",
  accent: "#7c3aed",
}

export function normalizeHexColor(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const t = raw.trim().toLowerCase()
  if (!t) return undefined
  const withHash = t.startsWith("#") ? t : `#${t}`
  if (!HEX_RE.test(withHash)) return undefined
  return withHash
}

export function parseStorefrontTheme(raw: unknown): StorefrontTheme {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_STOREFRONT_THEME }
  }
  const o = raw as Record<string, unknown>
  const primary = normalizeHexColor(o.primary) ?? DEFAULT_STOREFRONT_THEME.primary
  const accent = normalizeHexColor(o.accent) ?? DEFAULT_STOREFRONT_THEME.accent
  return { primary, accent }
}

export function themeToCssVars(theme: StorefrontTheme): Record<string, string> {
  const t = parseStorefrontTheme(theme)
  return {
    "--store-primary": t.primary ?? DEFAULT_STOREFRONT_THEME.primary!,
    "--store-accent": t.accent ?? DEFAULT_STOREFRONT_THEME.accent!,
  }
}

export function themeFromFormFields(primaryRaw: unknown, accentRaw: unknown): StorefrontTheme {
  return {
    primary: normalizeHexColor(primaryRaw) ?? DEFAULT_STOREFRONT_THEME.primary,
    accent: normalizeHexColor(accentRaw) ?? DEFAULT_STOREFRONT_THEME.accent,
  }
}
