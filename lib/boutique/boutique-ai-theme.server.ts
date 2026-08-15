import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import {
  getStorefrontThemeById,
  STOREFRONT_THEME_COUNT,
} from "@/lib/boutique/storefront-theme-engine"
import {
  inferBoutiquePersonalizeFromVibe,
  mergeBoutiqueTagline,
  parseBoutiqueAiPersonalizeJson,
  type BoutiqueAiPersonalizePayload,
} from "@/lib/boutique/boutique-ai-theme-shared"
import {
  boutiqueTitleTypographyToStoreFields,
  inferBoutiqueTitleTypographyFromVibe,
  type BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import { sanitizePublicBoutiqueTagline } from "@/lib/boutique/haute-gamme-themes-shared"
import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export type { BoutiqueAiPersonalizePayload } from "@/lib/boutique/boutique-ai-theme-shared"

async function loadCatalogKeywords(userId: string, role: "AFFILIATE" | "SUPPLIER"): Promise<string[]> {
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
    return rows.flatMap((row) => {
      const title = row.customTitle?.trim() || row.product?.name || ""
      return [title, ...(row.product?.categories ?? []), ...(row.product?.tags ?? [])].filter(Boolean)
    })
  }

  const rows = await prisma.product.findMany({
    where: { supplierId: userId, active: true, isDraft: false },
    select: { name: true, categories: true, tags: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  })
  return rows.flatMap((row) => [row.name, ...(row.categories ?? []), ...(row.tags ?? [])])
}

export async function generateBoutiqueVisualTheme(args: {
  userId: string
  role: "AFFILIATE" | "SUPPLIER"
  storeName: string
  vibe: string
  locale?: string
  manualThemeId?: string | null
}): Promise<Omit<BoutiqueAiPersonalizePayload, "persisted">> {
  const locale = args.locale === "fr" ? "fr" : "en"
  const vibe = args.vibe.trim().slice(0, 400)
  const keywords = await loadCatalogKeywords(args.userId, args.role)

  if (args.manualThemeId?.trim()) {
    const manual = getStorefrontThemeById(args.manualThemeId.trim())
    return {
      themeId: manual.id,
      label: manual.label,
      tagline: mergeBoutiqueTagline(args.storeName, vibe, locale, vibe),
      rationale:
        locale === "fr"
          ? `Palette ${manual.label} sélectionnée manuellement.`
          : `Manually selected ${manual.label} palette.`,
      source: "rules",
    }
  }

  const fallback = inferBoutiquePersonalizeFromVibe({
    vibe: vibe || (locale === "fr" ? "boutique futuriste premium" : "premium futuristic boutique"),
    storeName: args.storeName,
    catalogKeywords: keywords,
    locale,
  })

  if (!process.env.GROQ_API_KEY?.trim()) {
    console.log("[personalize-boutique-theme]", {
      userId: args.userId,
      result: "rules_fallback",
      themeId: fallback.themeId,
    })
    return {
      ...fallback,
      label: getStorefrontThemeById(fallback.themeId).label,
    }
  }

  const raw = await groqChatText({
    model: GROQ_TEXT_MODEL,
    temperature: 0.4,
    max_tokens: 480,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a senior ecommerce visual designer for Affisell reseller boutiques. Pick themeIndex 0-${STOREFRONT_THEME_COUNT - 1} for a harmonious futuristic storefront. Dark immersive palettes suit most niches unless vibe says minimal/light. Return JSON only.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          storeName: args.storeName.slice(0, 80),
          merchantVibe: vibe,
          role: args.role,
          locale,
          catalogKeywords: keywords.slice(0, 14),
          themeCatalogSize: STOREFRONT_THEME_COUNT,
          output: {
            themeIndex: "integer 0-1023",
            label: "short theme name",
            tagline: "buyer-facing hero tagline max 110 chars for shoppers (never say your audience)",
            rationale: "one sentence why this palette fits the vibe",
          },
        }),
      },
    ],
  })

  const parsed = raw ? parseBoutiqueAiPersonalizeJson(raw) : null
  if (!parsed) {
    console.log("[personalize-boutique-theme]", {
      userId: args.userId,
      result: "parse_fallback",
      themeId: fallback.themeId,
    })
    return {
      ...fallback,
      label: getStorefrontThemeById(fallback.themeId).label,
    }
  }

  const resolved = getStorefrontThemeById(parsed.themeId)
  console.log("[personalize-boutique-theme]", {
    userId: args.userId,
    result: "ai_ok",
    themeId: parsed.themeId,
    family: resolved.family,
  })

  return {
    ...parsed,
    label: resolved.label,
    tagline: mergeBoutiqueTagline(args.storeName, parsed.tagline, locale, vibe),
    source: "ai",
  }
}

export async function persistBoutiqueVisualTheme(args: {
  userId: string
  payload: Omit<BoutiqueAiPersonalizePayload, "persisted">
  vibe?: string
  locale?: string
}): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { userId: args.userId },
    select: { id: true, slug: true, storefrontTheme: true },
  })
  if (!store) return

  const existing = parseStorefrontTheme(store.storefrontTheme)
  const titleFromVibe =
    args.vibe?.trim()
      ? inferBoutiqueTitleTypographyFromVibe({ vibe: args.vibe, locale: args.locale })
      : null
  const storeLabel = formatResellerStoreLabel(store.slug ?? "")
  const publicTagline = sanitizePublicBoutiqueTagline({
    raw: args.payload.tagline,
    storeLabel,
    locale: args.locale,
    vibe: args.vibe,
  })
  const { brandStudio: _dropBrandStudio, ...themeWithoutBrandStudio } = existing

  await prisma.store.update({
    where: { id: store.id },
    data: {
      storefrontTheme: {
        ...themeWithoutBrandStudio,
        boutiqueVisualTheme: args.payload.themeId,
        boutiqueAiTagline: publicTagline,
        ...(titleFromVibe
          ? boutiqueTitleTypographyToStoreFields({
              fontId: titleFromVibe.fontId,
              ornamentId: titleFromVibe.ornamentId,
              layoutId: titleFromVibe.layoutId,
              displayOverride: existing.boutiqueTitleDisplay
                ? sanitizeExistingDisplay(existing.boutiqueTitleDisplay)
                : null,
            })
          : {}),
      },
    },
  })
}

function sanitizeExistingDisplay(raw: string): string | null {
  const t = raw.trim().slice(0, 80)
  return t || null
}

export async function saveBoutiqueDesignSnapshot(args: {
  userId: string
  storeSlug: string
  themeId: string
  tagline?: string | null
  titleTypography?: BoutiqueTitleTypography
}): Promise<{ slug: string; themeId: string; label: string }> {
  const slug = args.storeSlug.trim()
  if (!slug) throw new Error("Invalid store slug")

  const store = await prisma.store.findUnique({
    where: { userId: args.userId },
    select: { id: true, slug: true, storefrontTheme: true },
  })
  if (!store || store.slug !== slug) {
    throw new Error("Store not found")
  }

  const themeMeta = getStorefrontThemeById(args.themeId)
  const existing = parseStorefrontTheme(store.storefrontTheme)
  const storeLabel = formatResellerStoreLabel(store.slug)
  const publicTagline =
    args.tagline !== undefined && args.tagline !== null
      ? sanitizePublicBoutiqueTagline({
          raw: args.tagline,
          storeLabel,
          brandStudio: existing.brandStudio ?? null,
        })
      : sanitizePublicBoutiqueTagline({
          raw: existing.boutiqueAiTagline ?? null,
          storeLabel,
          brandStudio: existing.brandStudio ?? null,
        })
  const { brandStudio: _dropBrandStudio, ...themeWithoutBrandStudio } = existing

  await prisma.store.update({
    where: { id: store.id },
    data: {
      storefrontTheme: {
        ...themeWithoutBrandStudio,
        boutiqueVisualTheme: themeMeta.id,
        boutiqueAiTagline: publicTagline,
        ...(args.titleTypography
          ? boutiqueTitleTypographyToStoreFields(args.titleTypography)
          : {}),
      },
    },
  })

  console.log("[save-boutique-design]", {
    userId: args.userId,
    storeId: store.id,
    themeId: themeMeta.id,
    result: "ok",
  })

  return { slug: store.slug, themeId: themeMeta.id, label: themeMeta.label }
}

export function readBoutiqueVisualThemeFromStore(raw: unknown): {
  boutiqueVisualTheme: string | null
  boutiqueAiTagline: string | null
} {
  const theme = parseStorefrontTheme(raw)
  const boutiqueVisualTheme =
    typeof theme.boutiqueVisualTheme === "string" && theme.boutiqueVisualTheme.trim()
      ? theme.boutiqueVisualTheme.trim()
      : null
  const boutiqueAiTagline =
    typeof theme.boutiqueAiTagline === "string" && theme.boutiqueAiTagline.trim()
      ? theme.boutiqueAiTagline.trim()
      : null
  return { boutiqueVisualTheme, boutiqueAiTagline }
}
