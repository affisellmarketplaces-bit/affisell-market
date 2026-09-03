import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import type { BoutiqueTitleTypography } from "@/lib/boutique/boutique-title-typography-shared"
import { DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY } from "@/lib/boutique/boutique-title-typography-shared"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import {
  brandAiThemeToStorefrontTheme,
  type BrandAiThemePayload,
} from "@/lib/storefront-brand-ai-theme-shared"
import { generateStoreBrandTheme } from "@/lib/storefront-brand-ai-theme.server"
import {
  buildGradientBannerSvg,
  buildStoreBrandBannerPrompt,
  generateStoreBrandBannerImage,
} from "@/lib/storefront-brand-banner.server"
import { generateStoreBrandCopy } from "@/lib/storefront-brand-copy.server"
import {
  generateStoreBrandFaqFromOrders,
  loadMerchantOrderFaqSignals,
} from "@/lib/storefront-brand-faq-orders.server"
import type {
  BrandFieldGenerateResponse,
  BrandStudioGenerateField,
} from "@/lib/storefront-brand-field-generate-shared"
import {
  inferNameBadgeStyle,
  inferNicheFromCatalogBlob,
  inferTrustRailTextColor,
} from "@/lib/storefront-brand-field-generate-shared"
import { buildInitialsLogoSvg } from "@/lib/storefront-brand-logo.server"
import { persistBrandStudioMedia } from "@/lib/storefront-brand-media-storage.server"
import {
  BRAND_LAUNCH_NICHES,
  buildBrandLaunchConfig,
  type BrandLaunchNiche,
} from "@/lib/storefront-brand-launch"
import { generateStoreBrandStaticPages } from "@/lib/storefront-brand-static-pages.server"
import { buildDefaultEmbedWidget } from "@/lib/storefront-embed-shared"
import {
  updateHomepageSectionContent,
  type HomepageSectionContent,
  type HomepageSectionType,
} from "@/lib/storefront-sections-shared"
import { updateStaticPage } from "@/lib/storefront-static-pages-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

type GenerateArgs = {
  userId: string
  role: "AFFILIATE" | "SUPPLIER"
  field: BrandStudioGenerateField
  locale?: string
  niche?: string
  sectionType?: HomepageSectionType
}

type StoreContext = {
  name: string
  slug: string
  description: string | null
  storefrontTheme: unknown
  keywords: string[]
  listingCount: number
}

async function loadStoreContext(userId: string, role: "AFFILIATE" | "SUPPLIER"): Promise<StoreContext | null> {
  const store = await prisma.store.findUnique({
    where: { userId },
    select: { name: true, slug: true, description: true, storefrontTheme: true },
  })
  if (!store) return null

  let keywords: string[] = []
  let listingCount = 0

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
    listingCount = rows.length
    keywords = rows.flatMap((row) => {
      const title = row.customTitle?.trim() || row.product?.name || ""
      const categories = row.product?.categories?.join(" ") ?? ""
      const tags = row.product?.tags?.join(" ") ?? ""
      return [title, categories, tags].filter(Boolean)
    })
  } else {
    const rows = await prisma.product.findMany({
      where: { supplierId: userId, active: true, isDraft: false },
      select: { name: true, categories: true, tags: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    })
    listingCount = rows.length
    keywords = rows.flatMap((row) => [row.name, ...(row.categories ?? []), ...(row.tags ?? [])])
  }

  return {
    name: store.name,
    slug: store.slug,
    description: store.description,
    storefrontTheme: store.storefrontTheme,
    keywords,
    listingCount,
  }
}

function resolveNiche(args: {
  niche?: string
  storeName: string
  keywords: string[]
}): BrandLaunchNiche {
  if (args.niche && (BRAND_LAUNCH_NICHES as readonly string[]).includes(args.niche)) {
    return args.niche as BrandLaunchNiche
  }
  return inferNicheFromCatalogBlob(`${args.storeName} ${args.keywords.join(" ")}`)
}

async function loadThemePayload(args: {
  userId: string
  role: "AFFILIATE" | "SUPPLIER"
  storeName: string
  locale?: string
}): Promise<BrandAiThemePayload> {
  return generateStoreBrandTheme(args)
}

function inferBoutiqueTitle(presetId: string | null): BoutiqueTitleTypography {
  const preset = presetId ?? "nebula-aurora"
  const map: Record<string, BoutiqueTitleTypography> = {
    "midnight-orbit": {
      ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
      fontId: "orbitron",
      ornamentId: "diamond",
      layoutId: "full-gradient",
    },
    "crimson-nova": {
      ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
      fontId: "bodoni",
      ornamentId: "sparkle",
      layoutId: "boutique-accent",
    },
    "emerald-luxe": {
      ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
      fontId: "cormorant",
      ornamentId: "wave",
      layoutId: "name-only",
    },
    "quantum-glow": {
      ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
      fontId: "unbounded",
      ornamentId: "chevrons",
      layoutId: "full-gradient",
    },
    "solar-flare": {
      ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
      fontId: "rajdhani",
      ornamentId: "star",
      layoutId: "boutique-accent",
    },
    "clean-minimal": {
      ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
      fontId: "geist",
      ornamentId: "none",
      layoutId: "name-only",
    },
  }
  return map[preset] ?? {
    ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
    fontId: "syne",
    ornamentId: "dot-ring",
    layoutId: "full-gradient",
  }
}

async function generateStoreName(args: {
  storeName: string
  keywords: string[]
  niche: BrandLaunchNiche
  locale: string
}): Promise<string> {
  const generic = /^(my store|ma boutique|ecom store|store|boutique)$/i.test(args.storeName.trim())
  if (!generic && args.storeName.trim().length >= 3) {
    return args.storeName.trim().slice(0, 40)
  }

  if (process.env.GROQ_API_KEY?.trim()) {
    const raw = await groqChatText({
      model: GROQ_TEXT_MODEL,
      temperature: 0.6,
      max_tokens: 64,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Return JSON only: { "name": "..." }. Short premium ecommerce store name, max 32 chars, no trademark brands.',
        },
        {
          role: "user",
          content: JSON.stringify({
            niche: args.niche,
            locale: args.locale,
            catalogKeywords: args.keywords.slice(0, 6),
          }),
        },
      ],
    })
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { name?: string }
        const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 40) : ""
        if (name.length >= 3) return name
      } catch {
        /* fall through */
      }
    }
  }

  const fr = args.locale === "fr"
  const nicheLabel: Record<BrandLaunchNiche, { en: string; fr: string }> = {
    fashion: { en: "Edit", fr: "Édit" },
    tech: { en: "Nova Tech", fr: "Nova Tech" },
    fitness: { en: "Peak", fr: "Peak" },
    beauty: { en: "Glow", fr: "Glow" },
  }
  const label = fr ? nicheLabel[args.niche].fr : nicheLabel[args.niche].en
  const suffix = fr ? "Sélection" : "Select"
  return `${label} ${suffix}`.slice(0, 40)
}

function buildSectionContentPatch(args: {
  sectionType: HomepageSectionType
  storeName: string
  description: string
  locale: string
}): Partial<HomepageSectionContent> {
  const fr = args.locale === "fr"
  const name = args.storeName.trim() || (fr ? "Ma boutique" : "My Store")
  const desc = args.description.trim()

  switch (args.sectionType) {
    case "story":
      return {
        eyebrow: fr ? "Notre histoire" : "Our story",
        body:
          desc ||
          (fr
            ? `${name} est une sélection premium pensée pour convertir votre audience avec confiance.`
            : `${name} is a premium curated selection built to convert your audience with trust.`),
      }
    case "cta":
      return {
        eyebrow: fr ? "Découvrir" : "Discover",
        title: fr ? "Parcourir la collection" : "Shop the collection",
        body: fr ? "Produits sélectionnés pour votre communauté." : "Products picked for your community.",
        buttonLabel: fr ? "Voir le catalogue" : "Browse catalog",
        buttonHref: "/discover",
      }
    case "newsletter":
      return {
        title: fr ? "Restez informé" : "Stay in the loop",
        body: fr ? "Nouveautés et offres exclusives." : "New drops and exclusive offers.",
        placeholder: fr ? "Votre email" : "Your email",
        buttonLabel: fr ? "S'inscrire" : "Subscribe",
      }
    case "trust":
      return {
        title: fr ? "Achat protégé" : "Protected purchase",
        body: fr
          ? "Paiement sécurisé · Retours UE 14 jours · Livraison suivie."
          : "Secure checkout · 14-day EU returns · Tracked shipping.",
      }
    case "social-proof":
      return {
        quote: fr ? "Qualité au top, livraison rapide." : "Great quality, fast delivery.",
        author: fr ? "Client vérifié" : "Verified buyer",
        stat: fr ? "4,9/5 satisfaction" : "4.9/5 satisfaction",
      }
    case "bestsellers":
      return {
        eyebrow: fr ? "Best-sellers" : "Bestsellers",
        title: fr ? "Les plus demandés" : "Most wanted",
        body: fr ? "Sélection des produits qui convertissent." : "Top picks that convert.",
        productLimit: 8,
      }
    default:
      return {}
  }
}

export async function generateBrandStudioField(args: GenerateArgs): Promise<BrandFieldGenerateResponse> {
  const ctx = await loadStoreContext(args.userId, args.role)
  if (!ctx) {
    throw new Error("Store not found")
  }

  const locale = args.locale === "fr" ? "fr" : "en"
  const themeParsed = parseStorefrontTheme(ctx.storefrontTheme)
  const niche = resolveNiche({ niche: args.niche, storeName: ctx.name, keywords: ctx.keywords })
  const primary = themeParsed.primary ?? "#18181b"
  const accent = themeParsed.accent ?? "#8b5cf6"

  switch (args.field) {
    case "preset":
    case "colors":
    case "layout": {
      const payload = await loadThemePayload({
        userId: args.userId,
        role: args.role,
        storeName: ctx.name,
        locale,
      })
      const storefront = brandAiThemeToStorefrontTheme(payload)
      const trustRailText = inferTrustRailTextColor(payload.primary)
      const nameBadge = inferNameBadgeStyle({ surface: payload.surface, presetId: payload.presetId })

      if (args.field === "colors") {
        return {
          field: "colors",
          source: payload.source,
          primary: payload.primary,
          accent: payload.accent,
          trustRailText,
        }
      }
      if (args.field === "layout") {
        return {
          field: "layout",
          source: payload.source,
          layout: payload.layout,
          heroStyle: payload.heroStyle,
          gridDensity: payload.gridDensity,
          surface: payload.surface,
          headerBrandAlign: storefront.headerBrandAlign ?? "left",
        }
      }
      return {
        field: "preset",
        source: payload.source,
        presetId: payload.presetId,
        primary: payload.primary,
        accent: payload.accent,
        trustRailText,
        nameBadge,
        layout: payload.layout,
        heroStyle: payload.heroStyle,
        gridDensity: payload.gridDensity,
        surface: payload.surface,
        headerBrandAlign: storefront.headerBrandAlign ?? "left",
        description: payload.description,
      }
    }

    case "name": {
      const name = await generateStoreName({
        storeName: ctx.name,
        keywords: ctx.keywords,
        niche,
        locale,
      })
      return { field: "name", source: process.env.GROQ_API_KEY?.trim() ? "ai" : "rules", name }
    }

    case "logo": {
      const buf = buildInitialsLogoSvg({ storeName: ctx.name, primary, accent })
      const uploaded = await persistBrandStudioMedia({
        userId: args.userId,
        kind: "logo",
        ext: "svg",
        bytes: buf,
      })
      console.log("[generate-brand-field]", {
        field: "logo",
        userId: args.userId,
        result: "ok",
        logoUrl: uploaded.url,
        storage: uploaded.storage,
      })
      return { field: "logo", source: "rules", logoUrl: uploaded.url }
    }

    case "banner": {
      const prompt = buildStoreBrandBannerPrompt({
        storeName: ctx.name,
        description: ctx.description ?? undefined,
        primary,
        accent,
        niche,
      })
      let imageBuf = await generateStoreBrandBannerImage(prompt)
      let source: "hf" | "gradient" = "hf"
      if (!imageBuf) {
        imageBuf = buildGradientBannerSvg({ storeName: ctx.name, primary, accent })
        source = "gradient"
      }
      const ext = source === "hf" ? "png" : "svg"
      const uploaded = await persistBrandStudioMedia({
        userId: args.userId,
        kind: "banner",
        ext,
        bytes: imageBuf,
      })
      return { field: "banner", source, bannerUrl: uploaded.url }
    }

    case "copy": {
      const storyPatch = buildSectionContentPatch({
        sectionType: "story",
        storeName: ctx.name,
        description: ctx.description ?? "",
        locale,
      })
      const ctaPatch = buildSectionContentPatch({
        sectionType: "cta",
        storeName: ctx.name,
        description: ctx.description ?? "",
        locale,
      })
      const generated =
        (await generateStoreBrandCopy({ storeName: ctx.name, niche, locale })) ??
        ({
          description: buildBrandLaunchConfig({ niche, description: "", storeName: ctx.name }).description,
          storyBody: storyPatch.body ?? "",
          ctaTitle: ctaPatch.title ?? "Shop the collection",
          ctaBody: ctaPatch.body ?? "Curated picks your audience will love.",
        } as const)

      let sections = themeParsed.homepageSections ?? []
      sections = updateHomepageSectionContent(sections, "story", { body: generated.storyBody })
      sections = updateHomepageSectionContent(sections, "cta", {
        title: generated.ctaTitle,
        body: generated.ctaBody,
      })

      return {
        field: "copy",
        source: process.env.GROQ_API_KEY?.trim() ? "ai" : "rules",
        description: generated.description,
        homepageSections: sections,
      }
    }

    case "sections": {
      const launch = buildBrandLaunchConfig({
        niche,
        description: ctx.description ?? "",
        storeName: ctx.name,
      })
      const copy =
        (await generateStoreBrandCopy({ storeName: ctx.name, niche, locale })) ??
        ({
          description: launch.description,
          storyBody: launch.description,
          ctaTitle: "Shop the collection",
          ctaBody: "Curated picks your audience will love.",
        } as const)

      let sections = launch.homepageSections
      sections = updateHomepageSectionContent(sections, "story", { body: copy.storyBody })
      sections = updateHomepageSectionContent(sections, "cta", {
        title: copy.ctaTitle,
        body: copy.ctaBody,
      })

      return {
        field: "sections",
        source: process.env.GROQ_API_KEY?.trim() ? "ai" : "rules",
        homepageSections: sections,
        description: copy.description,
      }
    }

    case "sectionContent": {
      if (!args.sectionType) {
        throw new Error("sectionType required")
      }
      const patch = buildSectionContentPatch({
        sectionType: args.sectionType,
        storeName: ctx.name,
        description: ctx.description ?? "",
        locale,
      })
      let sections = themeParsed.homepageSections ?? []
      sections = updateHomepageSectionContent(sections, args.sectionType, patch)
      return {
        field: "sectionContent",
        source: "rules",
        sectionType: args.sectionType,
        homepageSections: sections,
      }
    }

    case "nameBadge": {
      const badge = inferNameBadgeStyle({
        surface: themeParsed.surface ?? "dark",
        presetId: themeParsed.presetId ?? null,
      })
      return { field: "nameBadge", source: "rules", nameBadge: badge }
    }

    case "embed": {
      return {
        field: "embed",
        source: "rules",
        embedWidget: buildDefaultEmbedWidget({ storeName: ctx.name }),
      }
    }

    case "boutiqueTitle": {
      return {
        field: "boutiqueTitle",
        source: "rules",
        boutiqueTitle: inferBoutiqueTitle(themeParsed.presetId ?? null),
      }
    }

    case "staticPages": {
      const pages =
        (await generateStoreBrandStaticPages({
          storeName: ctx.name,
          niche,
          locale,
          role: args.role,
          description: ctx.description ?? undefined,
        })) ??
        buildBrandLaunchConfig({
          niche,
          description: ctx.description ?? "",
          storeName: ctx.name,
        }).staticPages
      return {
        field: "staticPages",
        source: process.env.GROQ_API_KEY?.trim() ? "ai" : "rules",
        staticPages: pages,
      }
    }

    case "faqOrders": {
      const signals = await loadMerchantOrderFaqSignals({
        userId: args.userId,
        role: args.role,
      })
      if (signals.orderCount30d < 1) {
        throw new Error("No order signals for FAQ")
      }
      const faqItems = await generateStoreBrandFaqFromOrders({
        storeName: ctx.name,
        role: args.role,
        locale,
        signals,
      })
      if (!faqItems?.length) {
        throw new Error("No order signals for FAQ")
      }
      const basePages =
        themeParsed.staticPages ??
        buildBrandLaunchConfig({
          niche,
          description: ctx.description ?? "",
          storeName: ctx.name,
        }).staticPages
      const staticPages = updateStaticPage(basePages, "faq", {
        enabled: true,
        faqItems,
      })
      return {
        field: "faqOrders",
        source: process.env.GROQ_API_KEY?.trim() ? "ai" : "rules",
        staticPages,
      }
    }

    default:
      throw new Error("Unknown field")
  }
}

/** Suggest next preset in catalog rotation (for preset picker generate). */
export function suggestNextPresetId(current: string | null): string {
  const ids = [
    "nebula-aurora",
    "violet-pulse",
    "midnight-orbit",
    "quantum-glow",
    "emerald-luxe",
    "crimson-nova",
    "solar-flare",
    "ocean-depth",
    "rose-editorial",
    "clean-minimal",
  ]
  if (!current) return ids[0]!
  const idx = ids.indexOf(current)
  const next = idx >= 0 ? ids[(idx + 1) % ids.length]! : ids[0]!
  const preset = findStorefrontThemePreset(next)
  return preset ? next : "nebula-aurora"
}
