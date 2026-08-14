/**
 * Affisell storefront format registry — client-safe (no Prisma).
 * Single source of truth for roles, routes, and Demo Lab test links.
 */

import { FEATURED_THEME_INDICES } from "@/lib/boutique/storefront-themes"
import { HOMEPAGE_SECTION_TYPES } from "@/lib/storefront-sections-shared"
import { STOREFRONT_THEME_PRESETS } from "@/lib/storefront-theme-presets"
import {
  STOREFRONT_GRID_DENSITIES,
  STOREFRONT_HEADER_BRAND_ALIGNS,
  STOREFRONT_HERO_STYLES,
  STOREFRONT_LAYOUT_MODES,
  STOREFRONT_SURFACES,
} from "@/lib/storefront-theme-shared"
import { STORE_NAME_BADGE_CATALOG } from "@/lib/store-name-badge-styles"
import { STOREFRONT_THEME_COUNT } from "@/lib/boutique/storefront-theme-engine"
import { BRAND_LAUNCH_NICHES } from "@/lib/storefront-brand-launch"

export const STOREFRONT_FORMAT_IDS = [
  "brand-studio-shops",
  "boutique-procedural",
  "supplier-storefront",
  "legion-profile",
  "embed-widget",
] as const

export type StorefrontFormatId = (typeof STOREFRONT_FORMAT_IDS)[number]

export type StorefrontFormatAudience = "buyer" | "affiliate" | "supplier" | "creator"

export type StorefrontFormatTier = "primary" | "channel"

export type StorefrontFormatDefinition = {
  id: StorefrontFormatId
  tier: StorefrontFormatTier
  audiences: StorefrontFormatAudience[]
  routePattern: string
  /** Dashboard where merchants configure this format */
  merchantStudioPath: string | null
  relatedIds: StorefrontFormatId[]
  optionCounts: {
    layouts?: number
    heroStyles?: number
    surfaces?: number
    presets?: number
    proceduralSkins?: number
    homepageBlocks?: number
  }
}

export type StorefrontFormatsLabSlugs = {
  affiliateStoreSlug: string | null
  supplierStoreSlug: string | null
  legionUsername: string | null
}

export type StorefrontFormatTestLink = {
  id: string
  labelKey: string
  href: string
  external?: boolean
  disabled?: boolean
  disabledReasonKey?: string
}

export const STOREFRONT_FORMAT_CATALOG: StorefrontFormatDefinition[] = [
  {
    id: "brand-studio-shops",
    tier: "primary",
    audiences: ["buyer", "affiliate"],
    routePattern: "/shops/{slug}",
    merchantStudioPath: "/dashboard/affiliate/brand-studio",
    relatedIds: ["boutique-procedural", "embed-widget"],
    optionCounts: {
      layouts: STOREFRONT_LAYOUT_MODES.length,
      heroStyles: STOREFRONT_HERO_STYLES.length,
      surfaces: STOREFRONT_SURFACES.length,
      presets: STOREFRONT_THEME_PRESETS.length,
      homepageBlocks: HOMEPAGE_SECTION_TYPES.length,
    },
  },
  {
    id: "boutique-procedural",
    tier: "primary",
    audiences: ["buyer", "affiliate"],
    routePattern: "/boutique/{slug}",
    merchantStudioPath: "/dashboard/affiliate/brand-studio",
    relatedIds: ["brand-studio-shops"],
    optionCounts: {
      proceduralSkins: STOREFRONT_THEME_COUNT,
    },
  },
  {
    id: "supplier-storefront",
    tier: "primary",
    audiences: ["buyer", "supplier"],
    routePattern: "/store/supplier/{slug}",
    merchantStudioPath: "/dashboard/supplier/storefront",
    relatedIds: [],
    optionCounts: {
      layouts: STOREFRONT_LAYOUT_MODES.length,
      heroStyles: STOREFRONT_HERO_STYLES.length,
      surfaces: STOREFRONT_SURFACES.length,
      presets: STOREFRONT_THEME_PRESETS.length,
    },
  },
  {
    id: "legion-profile",
    tier: "primary",
    audiences: ["buyer", "creator"],
    routePattern: "/u/{username}",
    merchantStudioPath: "/dashboard/affiliate/settings/store",
    relatedIds: [],
    optionCounts: {},
  },
  {
    id: "embed-widget",
    tier: "channel",
    audiences: ["buyer", "affiliate"],
    routePattern: "/embed/shops/{slug}",
    merchantStudioPath: "/dashboard/affiliate/brand-studio",
    relatedIds: ["brand-studio-shops"],
    optionCounts: {},
  },
]

export const BRAND_STUDIO_OPTION_MATRIX = {
  layouts: STOREFRONT_LAYOUT_MODES,
  heroStyles: STOREFRONT_HERO_STYLES,
  surfaces: STOREFRONT_SURFACES,
  gridDensities: STOREFRONT_GRID_DENSITIES,
  headerAligns: STOREFRONT_HEADER_BRAND_ALIGNS,
  nameBadges: STORE_NAME_BADGE_CATALOG.map((b) => b.id),
  smartLaunchNiches: BRAND_LAUNCH_NICHES,
  homepageSections: HOMEPAGE_SECTION_TYPES,
} as const

export const BOUTIQUE_SHOWCASE_THEME_REFS = FEATURED_THEME_INDICES.map(
  (index) => `t-${String(index).padStart(4, "0")}`
)

export function findStorefrontFormat(id: StorefrontFormatId): StorefrontFormatDefinition {
  const found = STOREFRONT_FORMAT_CATALOG.find((f) => f.id === id)
  if (!found) throw new Error(`unknown_storefront_format:${id}`)
  return found
}

function enc(segment: string): string {
  return encodeURIComponent(segment.trim())
}

export function buildStorefrontFormatTestLinks(
  formatId: StorefrontFormatId,
  slugs: StorefrontFormatsLabSlugs
): StorefrontFormatTestLink[] {
  const affiliate = slugs.affiliateStoreSlug?.trim() || null
  const supplier = slugs.supplierStoreSlug?.trim() || null
  const legion = slugs.legionUsername?.trim() || null

  switch (formatId) {
    case "brand-studio-shops":
      if (!affiliate) {
        return [
          {
            id: "fallback-browse",
            labelKey: "links.shopsBrowse",
            href: "/shops/browse",
          },
        ]
      }
      return [
        {
          id: "live-buyer",
          labelKey: "links.liveBuyer",
          href: `/shops/${enc(affiliate)}`,
        },
        {
          id: "owner-preview",
          labelKey: "links.ownerPreview",
          href: `/shops/${enc(affiliate)}?preview=affiliate`,
        },
        {
          id: "brand-studio",
          labelKey: "links.brandStudio",
          href: "/dashboard/affiliate/brand-studio",
        },
      ]
    case "boutique-procedural":
      if (!affiliate) {
        return [{ id: "fallback-browse", labelKey: "links.shopsBrowse", href: "/shops/browse" }]
      }
      return [
        {
          id: "boutique-default",
          labelKey: "links.boutiqueLive",
          href: `/boutique/${enc(affiliate)}`,
        },
        ...BOUTIQUE_SHOWCASE_THEME_REFS.slice(0, 4).map((themeRef, i) => ({
          id: `boutique-theme-${i}`,
          labelKey: "links.boutiqueTheme",
          href: `/boutique/${enc(affiliate)}?theme=${enc(themeRef)}`,
        })),
        {
          id: "brand-studio",
          labelKey: "links.brandStudio",
          href: "/dashboard/affiliate/brand-studio",
        },
      ]
    case "supplier-storefront":
      if (!supplier) {
        return [
          {
            id: "fallback-discover",
            labelKey: "links.discover",
            href: "/discover",
          },
        ]
      }
      return [
        {
          id: "supplier-live",
          labelKey: "links.supplierLive",
          href: `/store/supplier/${enc(supplier)}`,
        },
        {
          id: "supplier-studio",
          labelKey: "links.supplierStudio",
          href: "/dashboard/supplier/storefront",
        },
      ]
    case "legion-profile":
      if (!legion) {
        return [
          {
            id: "legion-unavailable",
            labelKey: "links.legionSetup",
            href: "/dashboard/affiliate/settings/store",
            disabled: true,
            disabledReasonKey: "links.legionMissing",
          },
        ]
      }
      return [
        {
          id: "legion-live",
          labelKey: "links.legionLive",
          href: `/u/${enc(legion)}`,
        },
        {
          id: "legion-settings",
          labelKey: "links.legionSettings",
          href: "/dashboard/affiliate/settings/store",
        },
      ]
    case "embed-widget":
      if (!affiliate) {
        return [
          {
            id: "embed-studio",
            labelKey: "links.brandStudioEmbed",
            href: "/dashboard/affiliate/brand-studio",
          },
        ]
      }
      return [
        {
          id: "embed-live",
          labelKey: "links.embedLive",
          href: `/embed/shops/${enc(affiliate)}`,
          disabled: true,
          disabledReasonKey: "links.embedRequiresEnable",
        },
        {
          id: "embed-studio",
          labelKey: "links.brandStudioEmbed",
          href: "/dashboard/affiliate/brand-studio",
        },
      ]
    default: {
      const _exhaustive: never = formatId
      return _exhaustive
    }
  }
}
