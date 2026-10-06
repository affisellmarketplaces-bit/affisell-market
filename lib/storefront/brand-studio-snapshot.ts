/**
 * Brand Studio design snapshot — one immutable value holding every field a merchant can edit.
 *
 * Extracted from `merchant-brand-studio.tsx` so the pieces that need to reason about a whole design (save, dirty check,
 * undo/redo history, local draft recovery, palette suggestions) share one definition and can be tested without React.
 * Client-safe: no Prisma, no server-only imports.
 */
import {
  DEFAULT_STORE_NAME_BADGE,
  type StoreNameBadgeStyle,
} from "@/lib/store-name-badge-styles"
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  homepageSectionsEqual,
  type HomepageSection,
} from "@/lib/storefront-sections-shared"
import {
  DEFAULT_EMBED_WIDGET,
  embedWidgetsEqual,
  type StorefrontEmbedWidget,
} from "@/lib/storefront-embed-shared"
import {
  DEFAULT_STATIC_PAGES,
  staticPagesEqual,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import {
  DEFAULT_STOREFRONT_THEME,
  parseStorefrontTheme,
  type StorefrontGridDensity,
  type StorefrontHeaderBrandAlign,
  type StorefrontHeroStyle,
  type StorefrontLayoutMode,
  type StorefrontSurface,
} from "@/lib/storefront-theme-shared"

/** The store as `/api/store/me` returns it. */
export type BrandStudioStoreRow = {
  name: string
  slug: string
  logoUrl: string | null
  bannerUrl: string | null
  description: string | null
  storefrontTheme?: unknown
}

export type BrandStudioSnapshot = {
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  primaryHex: string
  accent: string
  trustRailText: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  presetId: string | null
  homepageSections: HomepageSection[]
  staticPages: StorefrontStaticPages
  heroVideoUrl: string
  heroVideoShowStoreName: boolean
  embedWidget: StorefrontEmbedWidget
}

export function snapshotFromStore(st: BrandStudioStoreRow): BrandStudioSnapshot {
  const theme = parseStorefrontTheme(st.storefrontTheme)
  return {
    name: st.name,
    description: st.description ?? "",
    bannerUrl: st.bannerUrl ?? "",
    logoUrl: st.logoUrl ?? "",
    primaryHex: theme.primary ?? DEFAULT_STOREFRONT_THEME.primary!,
    accent: theme.accent ?? DEFAULT_STOREFRONT_THEME.accent!,
    trustRailText: theme.trustRailText ?? DEFAULT_STOREFRONT_THEME.trustRailText!,
    nameBadge: theme.nameBadge ?? DEFAULT_STORE_NAME_BADGE,
    layout: theme.layout ?? DEFAULT_STOREFRONT_THEME.layout!,
    heroStyle: theme.heroStyle ?? DEFAULT_STOREFRONT_THEME.heroStyle!,
    gridDensity: theme.gridDensity ?? DEFAULT_STOREFRONT_THEME.gridDensity!,
    surface: theme.surface ?? DEFAULT_STOREFRONT_THEME.surface!,
    headerBrandAlign: theme.headerBrandAlign ?? DEFAULT_STOREFRONT_THEME.headerBrandAlign!,
    presetId: theme.presetId ?? null,
    homepageSections: theme.homepageSections ?? DEFAULT_HOMEPAGE_SECTIONS,
    staticPages: theme.staticPages ?? DEFAULT_STATIC_PAGES,
    heroVideoUrl: theme.heroVideoUrl ?? "",
    heroVideoShowStoreName: theme.heroVideoShowStoreName !== false,
    embedWidget: theme.embedWidget ?? DEFAULT_EMBED_WIDGET,
  }
}

/** Normalizes the editable draft (trim, name length cap) into the value that is compared and saved. */
export function snapshotFromDraft(input: BrandStudioSnapshot): BrandStudioSnapshot {
  return {
    name: input.name.trim().slice(0, 40),
    description: input.description.trim(),
    bannerUrl: input.bannerUrl.trim(),
    logoUrl: input.logoUrl.trim(),
    primaryHex: input.primaryHex,
    accent: input.accent,
    trustRailText: input.trustRailText,
    nameBadge: input.nameBadge,
    layout: input.layout,
    heroStyle: input.heroStyle,
    gridDensity: input.gridDensity,
    surface: input.surface,
    headerBrandAlign: input.headerBrandAlign,
    presetId: input.presetId,
    homepageSections: input.homepageSections,
    staticPages: input.staticPages,
    heroVideoUrl: input.heroVideoUrl.trim(),
    heroVideoShowStoreName: input.heroVideoShowStoreName,
    embedWidget: input.embedWidget,
  }
}

export function snapshotsEqual(a: BrandStudioSnapshot, b: BrandStudioSnapshot): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.bannerUrl === b.bannerUrl &&
    a.logoUrl === b.logoUrl &&
    a.primaryHex === b.primaryHex &&
    a.accent === b.accent &&
    a.trustRailText === b.trustRailText &&
    a.nameBadge === b.nameBadge &&
    a.layout === b.layout &&
    a.heroStyle === b.heroStyle &&
    a.gridDensity === b.gridDensity &&
    a.surface === b.surface &&
    a.headerBrandAlign === b.headerBrandAlign &&
    a.presetId === b.presetId &&
    homepageSectionsEqual(a.homepageSections, b.homepageSections) &&
    staticPagesEqual(a.staticPages, b.staticPages) &&
    a.heroVideoUrl === b.heroVideoUrl &&
    a.heroVideoShowStoreName === b.heroVideoShowStoreName &&
    embedWidgetsEqual(a.embedWidget, b.embedWidget)
  )
}

/**
 * The inverse of `snapshotFromStore`: a store row carrying this snapshot. Anything restored from storage goes back
 * through `snapshotFromStore` → `parseStorefrontTheme`, so stale or tampered data is validated by the same parser the
 * live store uses instead of being trusted.
 */
export function snapshotToStoreRow(snapshot: BrandStudioSnapshot, slug: string): BrandStudioStoreRow {
  return {
    name: snapshot.name,
    slug,
    logoUrl: snapshot.logoUrl || null,
    bannerUrl: snapshot.bannerUrl || null,
    description: snapshot.description || null,
    storefrontTheme: {
      primary: snapshot.primaryHex,
      accent: snapshot.accent,
      trustRailText: snapshot.trustRailText,
      nameBadge: snapshot.nameBadge,
      layout: snapshot.layout,
      heroStyle: snapshot.heroStyle,
      gridDensity: snapshot.gridDensity,
      surface: snapshot.surface,
      headerBrandAlign: snapshot.headerBrandAlign,
      presetId: snapshot.presetId ?? undefined,
      homepageSections: snapshot.homepageSections,
      staticPages: snapshot.staticPages,
      heroVideoUrl: snapshot.heroVideoUrl || undefined,
      heroVideoShowStoreName: snapshot.heroVideoShowStoreName,
      embedWidget: snapshot.embedWidget,
    },
  }
}
