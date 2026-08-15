/** Brand Studio per-field AI generate — client-safe types & helpers. */

import type { BoutiqueTitleTypography } from "@/lib/boutique/boutique-title-typography-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { HomepageSection, HomepageSectionType } from "@/lib/storefront-sections-shared"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"
import type { StorefrontEmbedWidget } from "@/lib/storefront-embed-shared"
import type {
  StorefrontGridDensity,
  StorefrontHeaderBrandAlign,
  StorefrontHeroStyle,
  StorefrontLayoutMode,
  StorefrontSurface,
} from "@/lib/storefront-theme-shared"

export const BRAND_STUDIO_GENERATE_FIELDS = [
  "preset",
  "name",
  "logo",
  "banner",
  "copy",
  "colors",
  "layout",
  "nameBadge",
  "sections",
  "embed",
  "boutiqueTitle",
  "staticPages",
  "faqOrders",
  "sectionContent",
] as const

export type BrandStudioGenerateField = (typeof BRAND_STUDIO_GENERATE_FIELDS)[number]

export function isBrandStudioGenerateField(raw: unknown): raw is BrandStudioGenerateField {
  return typeof raw === "string" && (BRAND_STUDIO_GENERATE_FIELDS as readonly string[]).includes(raw)
}

export type BrandFieldGenerateResponse = {
  field: BrandStudioGenerateField
  source?: "ai" | "rules" | "hf" | "gradient"
  name?: string
  logoUrl?: string
  bannerUrl?: string
  description?: string
  primary?: string
  accent?: string
  trustRailText?: string
  presetId?: string
  layout?: StorefrontLayoutMode
  heroStyle?: StorefrontHeroStyle
  gridDensity?: StorefrontGridDensity
  surface?: StorefrontSurface
  headerBrandAlign?: StorefrontHeaderBrandAlign
  nameBadge?: StoreNameBadgeStyle
  homepageSections?: HomepageSection[]
  staticPages?: StorefrontStaticPages
  embedWidget?: StorefrontEmbedWidget
  boutiqueTitle?: BoutiqueTitleTypography
  sectionType?: HomepageSectionType
}

/** WCAG-friendly trust rail text on bright vs dark header backgrounds. */
export function inferTrustRailTextColor(primaryHex: string): string {
  const hex = primaryHex.replace("#", "").trim()
  if (hex.length !== 6) return "#18181b"
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return "#18181b"
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? "#18181b" : "#f8fafc"
}

/** Map catalog keywords → launch niche (idempotent, no LLM). */
export function inferNicheFromCatalogBlob(blob: string): BrandLaunchNiche {
  const lower = blob.toLowerCase()
  if (/shoe|sneaker|chaussure|mode|fashion|streetwear/.test(lower)) return "fashion"
  if (/tech|gadget|phone|usb|smart|electron/.test(lower)) return "tech"
  if (/fit|sport|gym|wellness|yoga|protein/.test(lower)) return "fitness"
  if (/beauty|skin|cosmet|makeup|skincare/.test(lower)) return "beauty"
  return "fashion"
}

/** Name badge that matches surface + preset mood. */
export function inferNameBadgeStyle(args: {
  surface: StorefrontSurface
  presetId: string | null
}): StoreNameBadgeStyle {
  if (args.surface === "light") return "classic"
  const preset = args.presetId ?? ""
  if (/midnight|quantum|nebula|crimson/.test(preset)) return "neon-slab"
  if (args.surface === "glass") return "holo-ribbon"
  if (/solar|emerald|ocean/.test(preset)) return "orbit-ring"
  return "parallelogram"
}

export function extractStoreInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "AS"
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase()
}
