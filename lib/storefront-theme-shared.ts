/** Storefront theme — safe for `"use client"` (no Prisma). */

import {
  parseStoreNameBadgeStyle,
  type StoreNameBadgeStyle,
} from "@/lib/store-name-badge-styles"
import { parseHomepageSections, type HomepageSection } from "@/lib/storefront-sections-shared"
import {
  parseEmbedWidget,
  type StorefrontEmbedWidget,
} from "@/lib/storefront-embed-shared"
import { normalizeHeroVideoUrl } from "@/lib/storefront-hero-video-shared"
import {
  parseStaticPages,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import {
  parseStorefrontBrandOps,
  type StorefrontBrandOps,
} from "@/lib/storefront-theme-ops-shared"

export type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
export type { StorefrontEmbedWidget } from "@/lib/storefront-embed-shared"
export type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"
export type { StorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"

export const STOREFRONT_LAYOUT_MODES = ["classic", "immersive", "minimal"] as const
export type StorefrontLayoutMode = (typeof STOREFRONT_LAYOUT_MODES)[number]

export const STOREFRONT_HERO_STYLES = ["banner", "gradient", "video", "none"] as const
export type StorefrontHeroStyle = (typeof STOREFRONT_HERO_STYLES)[number]

export const STOREFRONT_GRID_DENSITIES = ["cozy", "compact", "spacious"] as const
export type StorefrontGridDensity = (typeof STOREFRONT_GRID_DENSITIES)[number]

export const STOREFRONT_SURFACES = ["light", "dark", "glass"] as const
export type StorefrontSurface = (typeof STOREFRONT_SURFACES)[number]

export const STOREFRONT_HEADER_BRAND_ALIGNS = ["left", "center", "right"] as const
export type StorefrontHeaderBrandAlign = (typeof STOREFRONT_HEADER_BRAND_ALIGNS)[number]

export type StorefrontTheme = {
  primary?: string
  accent?: string
  /** Trust rail label color (Powered by / Secure checkout). Default black for readability. */
  trustRailText?: string
  nameBadge?: StoreNameBadgeStyle
  layout?: StorefrontLayoutMode
  heroStyle?: StorefrontHeroStyle
  gridDensity?: StorefrontGridDensity
  surface?: StorefrontSurface
  headerBrandAlign?: StorefrontHeaderBrandAlign
  /** Optional preset id for Brand Studio UI only. */
  presetId?: string
  /** Optional Veo / HTTPS loop for hero when heroStyle is `video`. */
  heroVideoUrl?: string
  /** Embeddable shop widget (iframe snippet in Brand Studio). */
  embedWidget?: StorefrontEmbedWidget
  /** Ordered homepage blocks for `/shops/{slug}`. */
  homepageSections?: HomepageSection[]
  /** Optional About / FAQ / Returns pages on the public storefront. */
  staticPages?: StorefrontStaticPages
  /** Cron / ops metadata — preserved across Brand Studio saves. */
  brandOps?: StorefrontBrandOps
}

const HEX_RE = /^#[0-9a-f]{6}$/i

export const DEFAULT_STOREFRONT_THEME: StorefrontTheme = {
  primary: "#18181b",
  accent: "#7c3aed",
  trustRailText: "#18181b",
  layout: "classic",
  heroStyle: "banner",
  gridDensity: "cozy",
  surface: "light",
  headerBrandAlign: "left",
}

function parseEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof raw !== "string") return fallback
  const v = raw.trim().toLowerCase() as T
  return (allowed as readonly string[]).includes(v) ? v : fallback
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
  const trustRailText =
    normalizeHexColor(o.trustRailText) ?? DEFAULT_STOREFRONT_THEME.trustRailText
  const nameBadge = parseStoreNameBadgeStyle(o.nameBadge)
  return {
    primary,
    accent,
    trustRailText,
    nameBadge,
    layout: parseEnum(o.layout, STOREFRONT_LAYOUT_MODES, DEFAULT_STOREFRONT_THEME.layout!),
    heroStyle: parseEnum(o.heroStyle, STOREFRONT_HERO_STYLES, DEFAULT_STOREFRONT_THEME.heroStyle!),
    heroVideoUrl: normalizeHeroVideoUrl(o.heroVideoUrl),
    embedWidget: parseEmbedWidget(o.embedWidget),
    gridDensity: parseEnum(
      o.gridDensity,
      STOREFRONT_GRID_DENSITIES,
      DEFAULT_STOREFRONT_THEME.gridDensity!
    ),
    surface: parseEnum(o.surface, STOREFRONT_SURFACES, DEFAULT_STOREFRONT_THEME.surface!),
    headerBrandAlign: parseEnum(
      o.headerBrandAlign,
      STOREFRONT_HEADER_BRAND_ALIGNS,
      DEFAULT_STOREFRONT_THEME.headerBrandAlign!
    ),
    presetId: typeof o.presetId === "string" ? o.presetId.slice(0, 40) : undefined,
    homepageSections: parseHomepageSections(o.homepageSections),
    staticPages: parseStaticPages(o.staticPages),
    brandOps: parseStorefrontBrandOps(o.brandOps),
  }
}

export function themeToCssVars(theme: StorefrontTheme): Record<string, string> {
  const t = parseStorefrontTheme(theme)
  return {
    "--store-primary": t.primary ?? DEFAULT_STOREFRONT_THEME.primary!,
    "--store-accent": t.accent ?? DEFAULT_STOREFRONT_THEME.accent!,
    "--store-trust-rail-text": t.trustRailText ?? DEFAULT_STOREFRONT_THEME.trustRailText!,
  }
}

export function storefrontGridClass(density: StorefrontGridDensity | undefined): string {
  switch (density ?? "cozy") {
    case "compact":
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    case "spacious":
      return "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    default:
      return "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
  }
}

export function storefrontSurfaceClass(surface: StorefrontSurface | undefined): string {
  switch (surface ?? "light") {
    case "dark":
      return "affisell-store-surface-dark bg-zinc-950 text-zinc-100"
    case "glass":
      return "affisell-store-surface-glass bg-gradient-to-b from-zinc-100 via-violet-50/40 to-zinc-50 dark:from-zinc-950 dark:via-violet-950/30 dark:to-zinc-950"
    default:
      return "affisell-store-surface-light bg-zinc-50 dark:bg-zinc-950"
  }
}

export type BrandStudioThemeInput = {
  primary?: unknown
  accent?: unknown
  trustRailText?: unknown
  nameBadge?: unknown
  layout?: unknown
  heroStyle?: unknown
  gridDensity?: unknown
  surface?: unknown
  headerBrandAlign?: unknown
  presetId?: unknown
  homepageSections?: unknown
  staticPages?: unknown
  heroVideoUrl?: unknown
  embedWidget?: unknown
}

export function themeFromBrandStudioFields(
  existing: StorefrontTheme,
  input: BrandStudioThemeInput
): StorefrontTheme {
  return {
    primary:
      input.primary !== undefined && input.primary !== null
        ? normalizeHexColor(input.primary) ?? existing.primary
        : existing.primary,
    accent:
      input.accent !== undefined && input.accent !== null
        ? normalizeHexColor(input.accent) ?? existing.accent
        : existing.accent,
    trustRailText:
      input.trustRailText !== undefined && input.trustRailText !== null
        ? normalizeHexColor(input.trustRailText) ?? existing.trustRailText
        : existing.trustRailText,
    nameBadge:
      input.nameBadge !== undefined && input.nameBadge !== null
        ? parseStoreNameBadgeStyle(input.nameBadge)
        : existing.nameBadge,
    layout:
      input.layout !== undefined && input.layout !== null
        ? parseEnum(input.layout, STOREFRONT_LAYOUT_MODES, existing.layout ?? "classic")
        : existing.layout,
    heroStyle:
      input.heroStyle !== undefined && input.heroStyle !== null
        ? parseEnum(input.heroStyle, STOREFRONT_HERO_STYLES, existing.heroStyle ?? "banner")
        : existing.heroStyle,
    gridDensity:
      input.gridDensity !== undefined && input.gridDensity !== null
        ? parseEnum(input.gridDensity, STOREFRONT_GRID_DENSITIES, existing.gridDensity ?? "cozy")
        : existing.gridDensity,
    surface:
      input.surface !== undefined && input.surface !== null
        ? parseEnum(input.surface, STOREFRONT_SURFACES, existing.surface ?? "light")
        : existing.surface,
    headerBrandAlign:
      input.headerBrandAlign !== undefined && input.headerBrandAlign !== null
        ? parseEnum(
            input.headerBrandAlign,
            STOREFRONT_HEADER_BRAND_ALIGNS,
            existing.headerBrandAlign ?? "left"
          )
        : existing.headerBrandAlign,
    presetId:
      input.presetId !== undefined && input.presetId !== null
        ? typeof input.presetId === "string"
          ? input.presetId.slice(0, 40)
          : undefined
        : existing.presetId,
    homepageSections:
      input.homepageSections !== undefined && input.homepageSections !== null
        ? parseHomepageSections(input.homepageSections)
        : existing.homepageSections,
    staticPages:
      input.staticPages !== undefined && input.staticPages !== null
        ? parseStaticPages(input.staticPages)
        : existing.staticPages,
    heroVideoUrl:
      input.heroVideoUrl !== undefined && input.heroVideoUrl !== null
        ? typeof input.heroVideoUrl === "string" && !input.heroVideoUrl.trim()
          ? undefined
          : normalizeHeroVideoUrl(input.heroVideoUrl) ?? existing.heroVideoUrl
        : existing.heroVideoUrl,
    embedWidget:
      input.embedWidget !== undefined && input.embedWidget !== null
        ? parseEmbedWidget(input.embedWidget)
        : existing.embedWidget,
    brandOps: existing.brandOps,
  }
}

/** @deprecated use themeFromBrandStudioFields */
export function themeFromFormFields(
  primaryRaw: unknown,
  accentRaw: unknown,
  nameBadgeRaw?: unknown
): StorefrontTheme {
  return themeFromBrandStudioFields(parseStorefrontTheme({}), {
    primary: primaryRaw,
    accent: accentRaw,
    nameBadge: nameBadgeRaw,
  })
}
