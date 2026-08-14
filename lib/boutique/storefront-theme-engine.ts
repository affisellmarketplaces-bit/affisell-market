/** Procedural color engine — 1024 client-safe boutique skins (no Prisma). */

export const STOREFRONT_THEME_COUNT = 1024

export type StorefrontThemeCssVars = {
  shellBg: string
  shellGradientFrom: string
  shellGradientVia: string
  shellGradientTo: string
  blob1: string
  blob2: string
  blob3: string
  accent: string
  accentSoft: string
  cardBg: string
  cardBorder: string
  cardShadow: string
  cardTitle: string
  cardMuted: string
  price: string
  headerWord: string
  headerAccentFrom: string
  headerAccentTo: string
  headerMuted: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  buttonFrom: string
  buttonTo: string
  buttonShadow: string
  footerBorder: string
  footerText: string
  aiButtonBg: string
  aiButtonBorder: string
  aiButtonText: string
  regenerateBg: string
  regenerateBorder: string
  regenerateText: string
  /** Sticky merchant nav on /boutique — evolves with procedural regenerations. */
  merchantHeaderFrom: string
  merchantHeaderVia: string
  merchantHeaderTo: string
  merchantHeaderBorder: string
  merchantHeaderGlow: string
  merchantHeaderBadgeBorder: string
  merchantHeaderBadgeIcon: string
  merchantHeaderActive: string
  merchantHeaderActiveGlow: string
  merchantHeaderCartBadge: string
  merchantHeaderCartBadgeText: string
  merchantHeaderLogoFrom: string
  merchantHeaderLogoTo: string
  merchantHeaderLogoTop: string
  merchantHeaderLogoBottom: string
  merchantHeaderShadow: string
}

export type StorefrontThemeDefinition = {
  id: string
  index: number
  label: string
  family: string
  isDark: boolean
  previewBg: string
  previewAccent: string
  cssVars: StorefrontThemeCssVars
}

const LEGACY_THEME_INDEX: Record<string, number> = {
  "dark-futuristic": 0,
  "light-minimal": 128,
  "luxury-obsidian": 384,
  "neon-cyber": 640,
}

const GOLDEN_ANGLE = 137.508

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${clamp(s, 0, 100)}% ${clamp(l, 0, 100)}%)`
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${Math.round(h)}, ${clamp(s, 0, 100)}%, ${clamp(l, 0, 100)}%, ${clamp(a, 0, 1)})`
}

function themeIdFromIndex(index: number): string {
  const safe = ((index % STOREFRONT_THEME_COUNT) + STOREFRONT_THEME_COUNT) % STOREFRONT_THEME_COUNT
  return `t-${String(safe).padStart(4, "0")}`
}

function parseThemeIndex(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  if (trimmed in LEGACY_THEME_INDEX) return LEGACY_THEME_INDEX[trimmed] ?? null
  const match = /^t-(\d{1,4})$/i.exec(trimmed)
  if (!match) return null
  const index = Number.parseInt(match[1] ?? "", 10)
  if (!Number.isFinite(index) || index < 0 || index >= STOREFRONT_THEME_COUNT) return null
  return index
}

const FAMILY_NAMES = [
  "Aurora",
  "Nebula",
  "Prism",
  "Obsidian",
  "Velvet",
  "Crystal",
  "Pulse",
  "Horizon",
  "Solstice",
  "Eclipse",
  "Mirage",
  "Zenith",
] as const

function schemeHues(baseHue: number, scheme: number): [number, number, number] {
  const h = baseHue % 360
  switch (scheme % 6) {
    case 0:
      return [h, (h + 180) % 360, (h + 60) % 360]
    case 1:
      return [h, (h + 120) % 360, (h + 240) % 360]
    case 2:
      return [h, (h + 32) % 360, (h + 64) % 360]
    case 3:
      return [h, (h + 150) % 360, (h + 210) % 360]
    case 4:
      return [h, (h + 90) % 360, (h + 270) % 360]
    default:
      return [h, (h + 45) % 360, (h + 315) % 360]
  }
}

/** Compose one of 1024 harmonious skins from index + golden-angle hue wheel. */
export function buildStorefrontTheme(indexInput: number): StorefrontThemeDefinition {
  const index =
    ((indexInput % STOREFRONT_THEME_COUNT) + STOREFRONT_THEME_COUNT) % STOREFRONT_THEME_COUNT
  const baseHue = (index * GOLDEN_ANGLE) % 360
  const scheme = Math.floor(index / 16) % 6
  const band = Math.floor(index / 96) % 4
  const [h1, h2, h3] = schemeHues(baseHue, scheme)

  const isDark = band !== 2
  const satBase = 58 + (index % 17)
  const satAccent = 68 + (index % 11)

  const shellBg = isDark ? hsl(h1, satBase * 0.35, 6 + (index % 5)) : hsl(h1, 18, 97)
  const shellFrom = isDark ? hsl(h1, satBase, 14 + (index % 8)) : hsl(h1, 32, 92)
  const shellVia = isDark ? hsl(h2, satBase * 0.5, 8 + (index % 4)) : hsl(h2, 22, 96)
  const shellTo = isDark ? hsl(h3, satAccent, 22 + (index % 10)) : hsl(h3, 28, 88)

  const cardBg = isDark ? "rgba(255,255,255,0.94)" : "#ffffff"
  const cardBorder = isDark ? "rgba(255,255,255,0.55)" : hsla(h1, 22, 82, 0.45)
  const cardTitle = isDark ? "#111827" : "#0f172a"
  const cardMuted = isDark ? "#6b7280" : "#64748b"
  const price = isDark ? "#0f172a" : "#020617"

  const headerWord = isDark ? "#ffffff" : "#0f172a"
  const headerAccentFrom = isDark ? "#ffffff" : hsl(h1, satAccent, 32)
  const headerAccentTo = hsl(h2, satAccent, isDark ? 72 : 48)
  const headerMuted = isDark ? hsla(h2, 40, 88, 0.72) : hsla(h1, 18, 36, 0.78)

  const family = FAMILY_NAMES[index % FAMILY_NAMES.length] ?? "Aurora"
  const label = `${family} ${index + 1}`

  const merchantHeaderFrom = isDark
    ? hsl(h1, satBase * 0.9, 11 + (index % 6))
    : hsl(h1, satBase * 0.75, 26 + (index % 5))
  const merchantHeaderVia = isDark
    ? hsl(h2, satBase * 0.82, 15 + (index % 5))
    : hsl(h2, satBase * 0.7, 32 + (index % 4))
  const merchantHeaderTo = isDark
    ? hsl(h3, satAccent * 0.95, 26 + (index % 9))
    : hsl(h3, satAccent * 0.85, 40 + (index % 7))
  const merchantHeaderActive = hsl(h3, satAccent, isDark ? 70 : 46)
  const merchantHeaderCartBadge = hsl(h3, satAccent, isDark ? 72 : 54)
  const merchantHeaderLogoTop = hsl(h3, satAccent, isDark ? 78 : 62)
  const merchantHeaderLogoBottom = hsl(h1, satBase * 0.92, isDark ? 38 : 30)

  return {
    id: themeIdFromIndex(index),
    index,
    label,
    family,
    isDark,
    previewBg: shellBg,
    previewAccent: `linear-gradient(135deg, ${hsl(h1, satAccent, isDark ? 55 : 45)}, ${hsl(h2, satAccent, isDark ? 48 : 55)})`,
    cssVars: {
      shellBg,
      shellGradientFrom: shellFrom,
      shellGradientVia: shellVia,
      shellGradientTo: shellTo,
      blob1: hsla(h1, satAccent, isDark ? 52 : 70, isDark ? 0.28 : 0.35),
      blob2: hsla(h2, satAccent, isDark ? 48 : 65, isDark ? 0.22 : 0.28),
      blob3: hsla(h3, satAccent, isDark ? 55 : 72, isDark ? 0.14 : 0.2),
      accent: hsl(h2, satAccent, isDark ? 62 : 42),
      accentSoft: hsla(h2, satAccent, isDark ? 72 : 55, 0.35),
      cardBg,
      cardBorder,
      cardShadow: isDark
        ? "0 12px 40px rgba(0,0,0,0.18)"
        : "0 8px 28px rgba(15,23,42,0.08)",
      cardTitle,
      cardMuted,
      price,
      headerWord,
      headerAccentFrom,
      headerAccentTo,
      headerMuted,
      badgeBg: isDark ? hsla(h1, 55, 42, 0.35) : hsla(h1, 40, 88, 0.65),
      badgeBorder: isDark ? hsla(h2, 60, 70, 0.45) : hsla(h1, 30, 70, 0.35),
      badgeText: isDark ? hsl(h2, 55, 88) : hsl(h1, 35, 32),
      buttonFrom: hsl(h1, satAccent, isDark ? 48 : 44),
      buttonTo: hsl(h2, satAccent, isDark ? 42 : 50),
      buttonShadow: `0 8px 28px ${hsla(h1, satAccent, 45, 0.35)}`,
      footerBorder: isDark ? "rgba(255,255,255,0.12)" : hsla(h1, 15, 75, 0.35),
      footerText: isDark ? "rgba(255,255,255,0.42)" : hsla(h1, 12, 40, 0.65),
      aiButtonBg: isDark ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.92)",
      aiButtonBorder: isDark ? "rgba(255,255,255,0.14)" : hsla(h1, 20, 75, 0.4),
      aiButtonText: isDark ? "#ffffff" : "#0f172a",
      regenerateBg: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)",
      regenerateBorder: isDark ? "rgba(255,255,255,0.22)" : hsla(h1, 18, 72, 0.45),
      regenerateText: isDark ? "rgba(255,255,255,0.92)" : "#334155",
      merchantHeaderFrom,
      merchantHeaderVia,
      merchantHeaderTo,
      merchantHeaderBorder: isDark ? hsla(h2, 55, 72, 0.22) : hsla(h1, 35, 42, 0.28),
      merchantHeaderGlow: hsla(h3, satAccent, isDark ? 58 : 52, isDark ? 0.32 : 0.24),
      merchantHeaderBadgeBorder: hsla(h3, satAccent, isDark ? 72 : 50, 0.78),
      merchantHeaderBadgeIcon: hsl(h3, satAccent, isDark ? 78 : 42),
      merchantHeaderActive,
      merchantHeaderActiveGlow: hsla(h3, satAccent, isDark ? 70 : 48, 0.92),
      merchantHeaderCartBadge,
      merchantHeaderCartBadgeText: isDark ? hsl(h1, satBase * 0.85, 12) : hsl(h1, satBase * 0.75, 16),
      merchantHeaderLogoTop,
      merchantHeaderLogoBottom,
      merchantHeaderLogoFrom: merchantHeaderLogoBottom,
      merchantHeaderLogoTo: merchantHeaderLogoTop,
      merchantHeaderShadow: `0 18px 50px ${hsla(h1, satAccent, isDark ? 22 : 32, isDark ? 0.55 : 0.32)}`,
    },
  }
}

export function getStorefrontThemeById(id: string): StorefrontThemeDefinition {
  const index = parseThemeIndex(id)
  return buildStorefrontTheme(index ?? 0)
}

export function getStorefrontThemeByIndex(index: number): StorefrontThemeDefinition {
  return buildStorefrontTheme(index)
}

export function parseStorefrontThemeRef(raw: string | null | undefined): string | null {
  const index = parseThemeIndex(raw)
  return index === null ? null : themeIdFromIndex(index)
}

export function nextStorefrontThemeRef(current: string): string {
  const index = parseThemeIndex(current) ?? 0
  return themeIdFromIndex(index + 1)
}

export function themeRefFromVibe(vibe: string): string {
  let hash = 0
  const normalized = vibe.trim().toLowerCase()
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0
  }
  return themeIdFromIndex(hash % STOREFRONT_THEME_COUNT)
}

/** Curated showcase indices for the AI modal grid. */
export const FEATURED_THEME_INDICES = [0, 64, 128, 256, 384, 512, 640, 768, 896, 960, 1008, 1023]

export function storefrontThemeStorageKey(storeSlug: string): string {
  return `affisell:store-theme:${storeSlug}`
}

export const DEFAULT_STOREFRONT_THEME_ID = themeIdFromIndex(0)

export type StorefrontTheme = string
