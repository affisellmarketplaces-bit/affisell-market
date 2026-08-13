import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import {
  BRAND_AI_THEME_PRESET_IDS,
  inferBrandThemeFromCatalog,
  parseGeneratedBrandTheme,
  type BrandAiThemePayload,
  type CatalogThemeHint,
} from "@/lib/storefront-brand-ai-theme-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import { normalizeHexColor } from "@/lib/storefront-theme-shared"

export type { BrandAiThemePayload } from "@/lib/storefront-brand-ai-theme-shared"
export { brandAiThemeToStorefrontTheme } from "@/lib/storefront-brand-ai-theme-shared"

function mergeWithPreset(base: BrandAiThemePayload): BrandAiThemePayload {
  const preset = findStorefrontThemePreset(base.presetId)
  const theme = preset?.theme
  return {
    ...base,
    primary: normalizeHexColor(base.primary) ?? theme?.primary ?? "#5b21b6",
    accent: normalizeHexColor(base.accent) ?? theme?.accent ?? "#06b6d4",
    surface: base.surface ?? theme?.surface ?? "dark",
    layout: base.layout ?? theme?.layout ?? "immersive",
    heroStyle: base.heroStyle ?? theme?.heroStyle ?? "gradient",
    gridDensity: base.gridDensity ?? theme?.gridDensity ?? "spacious",
  }
}

async function loadCatalogHints(userId: string, role: "AFFILIATE" | "SUPPLIER"): Promise<CatalogThemeHint> {
  if (role === "AFFILIATE") {
    const rows = await prisma.affiliateProduct.findMany({
      where: { affiliateId: userId, ...buyerListedAffiliateProductWhere },
      select: {
        customTitle: true,
        product: { select: { name: true, categories: true, tags: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    })
    const keywords = rows.flatMap((row) => {
      const title = row.customTitle?.trim() || row.product?.name || ""
      const categories = row.product?.categories?.join(" ") ?? ""
      const tags = row.product?.tags?.join(" ") ?? ""
      return [title, categories, tags].filter(Boolean)
    })
    return { keywords, listingCount: rows.length }
  }

  const rows = await prisma.product.findMany({
    where: { supplierId: userId, active: true, isDraft: false },
    select: { name: true, categories: true, tags: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  })
  const keywords = rows.flatMap((row) => [
    row.name,
    ...(row.categories ?? []),
    ...(row.tags ?? []),
  ])
  return { keywords, listingCount: rows.length }
}

export async function generateStoreBrandTheme(args: {
  userId: string
  role: "AFFILIATE" | "SUPPLIER"
  storeName: string
  locale?: string
}): Promise<BrandAiThemePayload> {
  const hints = await loadCatalogHints(args.userId, args.role)
  const locale = args.locale === "fr" ? "fr" : "en"
  const fallback = mergeWithPreset(
    inferBrandThemeFromCatalog({
      storeName: args.storeName,
      hints,
      locale,
    })
  )

  if (!process.env.GROQ_API_KEY?.trim()) {
    console.log("[generate-brand-theme]", {
      userId: args.userId,
      result: "rules_fallback",
      presetId: fallback.presetId,
    })
    return fallback
  }

  const raw = await groqChatText({
    model: GROQ_TEXT_MODEL,
    temperature: 0.35,
    max_tokens: 640,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a futuristic ecommerce brand designer for Affisell reseller boutiques. Return JSON only. Pick the best presetId from the allowed list. Prefer dark immersive presets (nebula-aurora, violet-pulse) for maximum wow unless catalog clearly fits another niche. Colors must be hex #RRGGBB.",
      },
      {
        role: "user",
        content: JSON.stringify({
          storeName: args.storeName.slice(0, 80),
          role: args.role,
          locale,
          listingCount: hints.listingCount,
          catalogKeywords: hints.keywords.slice(0, 12),
          allowedPresetIds: BRAND_AI_THEME_PRESET_IDS,
          outputKeys: {
            presetId: "string from allowedPresetIds",
            primary: "#hex accent color",
            accent: "#hex second color",
            surface: "light|dark|glass",
            layout: "classic|immersive|minimal",
            heroStyle: "banner|gradient|video|none",
            gridDensity: "cozy|compact|spacious",
            description: "store tagline max 220 chars",
            boutiqueTagline: "short hero line for /boutique grid max 90 chars",
            storyBody: "brand story 2 sentences max 320 chars",
            rationale: "one sentence why this theme fits",
          },
        }),
      },
    ],
  })

  if (!raw) {
    console.log("[generate-brand-theme]", {
      userId: args.userId,
      result: "groq_empty",
      presetId: fallback.presetId,
    })
    return fallback
  }

  const parsed = parseGeneratedBrandTheme(raw)
  if (!parsed) {
    console.log("[generate-brand-theme]", {
      userId: args.userId,
      result: "parse_failed",
      presetId: fallback.presetId,
    })
    return fallback
  }

  const merged = mergeWithPreset({ ...parsed, source: "ai" })
  console.log("[generate-brand-theme]", {
    userId: args.userId,
    result: "ok",
    presetId: merged.presetId,
    source: "ai",
    listingCount: hints.listingCount,
  })
  return merged
}
