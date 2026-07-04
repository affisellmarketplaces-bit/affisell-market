/** Brand Pulse readiness — client-safe (no Prisma). */

import { getEnabledHomepageSections } from "@/lib/storefront-sections-shared"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"
import type {
  StorefrontHeroStyle,
  StorefrontLayoutMode,
  StorefrontSurface,
} from "@/lib/storefront-theme-shared"
import type { HomepageSection } from "@/lib/storefront-sections-shared"

export type BrandPulseCheckId =
  | "identity"
  | "description"
  | "logo"
  | "heroVisual"
  | "preset"
  | "premiumLayout"
  | "sections"
  | "staticPages"
  | "embed"
  | "liveProducts"
  | "customDomain"

export type BrandPulseCheck = {
  id: BrandPulseCheckId
  done: boolean
  weight: number
}

export type BrandPulseResult = {
  score: number
  checks: BrandPulseCheck[]
  readyToShare: boolean
}

export type BrandPulseInput = {
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  presetId: string | null
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  heroVideoUrl: string
  surface: StorefrontSurface
  embedEnabled: boolean
  homepageSections: HomepageSection[]
  staticPages: StorefrontStaticPages
  liveListingCount: number
  customDomainVerified: boolean
  role: "AFFILIATE" | "SUPPLIER"
}

function countEnabledStaticPages(pages: StorefrontStaticPages): number {
  return (["about", "faq", "returns"] as const).filter((k) => pages[k]?.enabled).length
}

export function computeBrandPulse(input: BrandPulseInput): BrandPulseResult {
  const enabledSections = getEnabledHomepageSections(input.homepageSections)
  const hasHeroVisual =
    Boolean(input.bannerUrl.trim()) ||
    input.heroStyle === "video" ||
    input.heroStyle === "gradient"
  const premiumLayout =
    input.layout === "immersive" || input.surface === "glass" || input.surface === "dark"

  const checks: BrandPulseCheck[] = [
    { id: "identity", done: input.name.trim().length >= 2, weight: 8 },
    {
      id: "description",
      done: input.description.trim().length >= 24,
      weight: 12,
    },
    { id: "logo", done: Boolean(input.logoUrl.trim()), weight: 10 },
    { id: "heroVisual", done: hasHeroVisual, weight: 12 },
    { id: "preset", done: Boolean(input.presetId?.trim()), weight: 8 },
    { id: "premiumLayout", done: premiumLayout, weight: 10 },
    {
      id: "sections",
      done: enabledSections.length >= 3,
      weight: 12,
    },
    {
      id: "staticPages",
      done: countEnabledStaticPages(input.staticPages) >= 1,
      weight: 8,
    },
    { id: "embed", done: input.embedEnabled, weight: 8 },
  ]

  if (input.role === "AFFILIATE") {
    checks.push({
      id: "liveProducts",
      done: input.liveListingCount >= 1,
      weight: 14,
    })
  }

  checks.push({
    id: "customDomain",
    done: input.customDomainVerified,
    weight: 8,
  })

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
  const earned = checks.filter((c) => c.done).reduce((sum, c) => sum + c.weight, 0)
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0

  const readyToShare =
    score >= 72 &&
    checks.find((c) => c.id === "description")?.done === true &&
    checks.find((c) => c.id === "heroVisual")?.done === true &&
    (input.role !== "AFFILIATE" ||
      checks.find((c) => c.id === "liveProducts")?.done === true)

  return { score, checks, readyToShare }
}
