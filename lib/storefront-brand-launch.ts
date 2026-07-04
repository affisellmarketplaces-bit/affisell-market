import {
  DEFAULT_HOMEPAGE_SECTIONS,
  updateHomepageSectionContent,
  type HomepageSection,
  type HomepageSectionContent,
} from "@/lib/storefront-sections-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import {
  buildDefaultStaticPages,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import type {
  StorefrontGridDensity,
  StorefrontHeaderBrandAlign,
  StorefrontHeroStyle,
  StorefrontLayoutMode,
  StorefrontSurface,
} from "@/lib/storefront-theme-shared"

export const BRAND_LAUNCH_NICHES = ["fashion", "tech", "fitness", "beauty"] as const
export type BrandLaunchNiche = (typeof BRAND_LAUNCH_NICHES)[number]

const NICHE_PRESET: Record<BrandLaunchNiche, string> = {
  fashion: "rose-editorial",
  tech: "midnight-orbit",
  fitness: "emerald-luxe",
  beauty: "violet-pulse",
}

export type BrandLaunchConfig = {
  niche: BrandLaunchNiche
  presetId: string
  primary: string
  accent: string
  trustRailText: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  description: string
  homepageSections: HomepageSection[]
  staticPages: StorefrontStaticPages
}

function enableSections(
  base: HomepageSection[],
  enabled: HomepageSection["type"][]
): HomepageSection[] {
  const enabledSet = new Set(enabled)
  return base.map((s) => ({ ...s, enabled: enabledSet.has(s.type) }))
}

function withSectionCopy(
  sections: HomepageSection[],
  copy: Partial<Record<HomepageSection["type"], HomepageSectionContent>>
): HomepageSection[] {
  let out = sections
  for (const [type, patch] of Object.entries(copy) as Array<
    [HomepageSection["type"], NonNullable<(typeof copy)[HomepageSection["type"]]>]
  >) {
    if (!patch) continue
    out = updateHomepageSectionContent(out, type, patch)
  }
  return out
}

function themeFieldsFromPreset(presetId: string): StorefrontTheme {
  const preset = findStorefrontThemePreset(presetId)
  if (!preset) {
    return findStorefrontThemePreset("violet-pulse")!.theme
  }
  return preset.theme
}

export function buildBrandLaunchConfig(args: {
  niche: BrandLaunchNiche
  description: string
  storeName: string
}): BrandLaunchConfig {
  const presetId = NICHE_PRESET[args.niche]
  const theme = themeFieldsFromPreset(presetId)

  let sections = DEFAULT_HOMEPAGE_SECTIONS.map((s) => ({ ...s }))

  switch (args.niche) {
    case "fashion":
      sections = enableSections(sections, [
        "hero",
        "story",
        "bestsellers",
        "products",
        "trust",
        "cta",
      ])
      sections = withSectionCopy(sections, {
        story: { eyebrow: "Curated edit", body: args.description },
        bestsellers: { productLimit: 8 },
        cta: {
          eyebrow: "New drops",
          title: "Shop the collection",
          body: "Limited pieces selected for your audience.",
          buttonLabel: "Browse catalog",
          buttonHref: "/discover",
        },
      })
      break
    case "tech":
      sections = enableSections(sections, [
        "hero",
        "bestsellers",
        "products",
        "social-proof",
        "trust",
      ])
      sections = withSectionCopy(sections, {
        story: { body: args.description },
        bestsellers: { productLimit: 6 },
        "social-proof": {
          quote: "Fast delivery and exactly as described — premium feel.",
          author: "Verified buyer",
          stat: "4.8★ avg. rating",
        },
      })
      break
    case "fitness":
      sections = enableSections(sections, [
        "hero",
        "story",
        "products",
        "trust",
        "newsletter",
      ])
      sections = withSectionCopy(sections, {
        story: { eyebrow: "Train smart", body: args.description },
        newsletter: {
          title: "Get drop alerts",
          body: "Be first when new performance gear goes live.",
          placeholder: "your@email.com",
          buttonLabel: "Notify me",
        },
      })
      break
    case "beauty":
      sections = enableSections(sections, [
        "hero",
        "story",
        "bestsellers",
        "products",
        "trust",
        "cta",
      ])
      sections = withSectionCopy(sections, {
        story: { eyebrow: "Clean beauty", body: args.description },
        bestsellers: { productLimit: 8 },
        cta: {
          eyebrow: "Glow routine",
          title: "Discover bestsellers",
          body: "Dermatologist-trusted picks for your community.",
          buttonLabel: "Shop now",
          buttonHref: "/discover",
        },
      })
      break
  }

  return applySmartLaunchLayout({
    niche: args.niche,
    presetId,
    primary: theme.primary ?? "#18181b",
    accent: theme.accent ?? "#8b5cf6",
    trustRailText: theme.trustRailText ?? theme.accent ?? "#8b5cf6",
    nameBadge: theme.nameBadge ?? "classic",
    layout: theme.layout ?? "classic",
    heroStyle: theme.heroStyle ?? "gradient",
    gridDensity: theme.gridDensity ?? "cozy",
    surface: theme.surface ?? "light",
    headerBrandAlign: theme.headerBrandAlign ?? "left",
    description: args.description,
    homepageSections: sections,
    staticPages: buildDefaultStaticPages({
      storeName: args.storeName,
      description: args.description,
    }),
  })
}

/** Phase 7 — niche-aware immersive defaults (pairs with Brand OS 6B). */
function applySmartLaunchLayout(config: BrandLaunchConfig): BrandLaunchConfig {
  switch (config.niche) {
    case "fashion":
    case "beauty":
      return {
        ...config,
        layout: "immersive",
        heroStyle: config.heroStyle === "banner" ? "gradient" : config.heroStyle,
        surface: config.surface === "light" ? "glass" : config.surface,
      }
    case "tech":
      return { ...config, layout: "immersive" }
    default:
      return config
  }
}

export function isBrandLaunchNiche(raw: string): raw is BrandLaunchNiche {
  return (BRAND_LAUNCH_NICHES as readonly string[]).includes(raw)
}
