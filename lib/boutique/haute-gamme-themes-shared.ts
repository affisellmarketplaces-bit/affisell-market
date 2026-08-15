/** Haute gamme boutique designs — client-safe (no Prisma). */

import type { StorefrontThemeCssVars } from "@/lib/boutique/storefront-theme-engine"
import type {
  BoutiqueTitleFontId,
  BoutiqueTitleOrnamentId,
  BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"

export type HauteGammeHeroFont = "serif" | "sans" | "display" | "mono"

export type HauteGammeTypography = {
  heroFont: HauteGammeHeroFont
  heroWeight: number
  heroTracking: string
  /** Decorative char around store name — ★ ✦ ◆ */
  ornament: string
  /** Optional italic hero (LUSH). */
  heroItalic?: boolean
}

export type HauteGammePalette = {
  bgFrom: string
  bgTo: string
  blob1: string
  blob2: string
  cardBg: string
  cardBorder: string
  textPrimary: string
  textSecondary: string
  accent: string
}

export type HauteGammeDesign = {
  id: string
  name: string
  vibeKeywords: string[]
  palette: HauteGammePalette
  typography: HauteGammeTypography
  taglineTemplate: string
}

export type BrandStudioSnapshot = {
  designId: string
  vibe: string
  /** Affiliate-facing copy — Brand Studio preview only. */
  merchantTagline: string
  /** Buyer-facing copy — live on public /boutique. */
  buyerTagline: string
  palette: HauteGammePalette
  typography: HauteGammeTypography
  heroTitle: string
  designIndex: number
  updatedAt: string
}

export const HAUTE_GAMME_DESIGN_IDS = [
  "eclipse",
  "atelier",
  "noir",
  "cyber",
  "lush",
  "minimal",
] as const

export type HauteGammeDesignId = (typeof HAUTE_GAMME_DESIGN_IDS)[number]

export const HAUTE_GAMME_DESIGNS: readonly HauteGammeDesign[] = [
  {
    id: "eclipse",
    name: "ECLIPSE",
    vibeKeywords: ["dark", "modern", "night", "midnight", "eclipse", "moody", "editorial"],
    palette: {
      bgFrom: "#050507",
      bgTo: "#0f0f0f",
      blob1: "rgba(139, 92, 246, 0.35)",
      blob2: "rgba(167, 139, 250, 0.22)",
      cardBg: "rgba(255, 255, 255, 0.08)",
      cardBorder: "rgba(255, 255, 255, 0.14)",
      textPrimary: "#f4f4f5",
      textSecondary: "rgba(244, 244, 245, 0.62)",
      accent: "#a78bfa",
    },
    typography: {
      heroFont: "display",
      heroWeight: 800,
      heroTracking: "-0.03em",
      ornament: "★",
    },
    taglineTemplate: "Curated essentials for the modern era",
  },
  {
    id: "atelier",
    name: "ATELIER",
    vibeKeywords: ["luxury", "luxe", "premium", "haute", "couture", "artisan", "atelier", "gold"],
    palette: {
      bgFrom: "#FAF9F6",
      bgTo: "#F5F1E8",
      blob1: "rgba(214, 196, 168, 0.45)",
      blob2: "rgba(180, 155, 120, 0.28)",
      cardBg: "rgba(255, 252, 247, 0.92)",
      cardBorder: "rgba(180, 155, 120, 0.22)",
      textPrimary: "#1c1917",
      textSecondary: "rgba(28, 25, 23, 0.58)",
      accent: "#92704a",
    },
    typography: {
      heroFont: "serif",
      heroWeight: 600,
      heroTracking: "0.01em",
      ornament: "✦",
    },
    taglineTemplate: "Objects of desire, thoughtfully sourced",
  },
  {
    id: "noir",
    name: "NOIR",
    vibeKeywords: ["noir", "black", "stealth", "precision", "craft", "detail", "monochrome"],
    palette: {
      bgFrom: "#000000",
      bgTo: "#0a0a0a",
      blob1: "rgba(212, 175, 55, 0.1)",
      blob2: "rgba(212, 175, 55, 0.06)",
      cardBg: "#18181b",
      cardBorder: "#27272a",
      textPrimary: "#fafafa",
      textSecondary: "rgba(250, 250, 250, 0.55)",
      accent: "#d4af37",
    },
    typography: {
      heroFont: "sans",
      heroWeight: 300,
      heroTracking: "0.12em",
      ornament: "◆",
    },
    taglineTemplate: "Precision. Craft. Detail.",
  },
  {
    id: "cyber",
    name: "CYBER",
    vibeKeywords: ["neon", "cyber", "gaming", "gamer", "rgb", "futur", "tech", "crypto", "web3"],
    palette: {
      bgFrom: "#020208",
      bgTo: "#0a0a14",
      blob1: "rgba(217, 70, 239, 0.32)",
      blob2: "rgba(34, 211, 238, 0.26)",
      cardBg: "rgba(8, 8, 20, 0.72)",
      cardBorder: "rgba(217, 70, 239, 0.45)",
      textPrimary: "#f0f9ff",
      textSecondary: "rgba(240, 249, 255, 0.58)",
      accent: "#22d3ee",
    },
    typography: {
      heroFont: "mono",
      heroWeight: 700,
      heroTracking: "-0.02em",
      ornament: "✦",
    },
    taglineTemplate: "Future archive 001",
  },
  {
    id: "lush",
    name: "LUSH",
    vibeKeywords: ["green", "nature", "eco", "organic", "emerald", "lush", "botanical", "forest"],
    palette: {
      bgFrom: "#052e16",
      bgTo: "#022c22",
      blob1: "rgba(52, 211, 153, 0.28)",
      blob2: "rgba(16, 185, 129, 0.18)",
      cardBg: "#fefce8",
      cardBorder: "rgba(254, 252, 232, 0.35)",
      textPrimary: "#14532d",
      textSecondary: "rgba(20, 83, 45, 0.62)",
      accent: "#34d399",
    },
    typography: {
      heroFont: "serif",
      heroWeight: 600,
      heroTracking: "0.02em",
      ornament: "✦",
      heroItalic: true,
    },
    taglineTemplate: "Rooted in nature, refined for you",
  },
  {
    id: "minimal",
    name: "MINIMAL",
    vibeKeywords: ["minimal", "clean", "simple", "white", "less", "scandinav", "quiet", "essential"],
    palette: {
      bgFrom: "#ffffff",
      bgTo: "#f9fafb",
      blob1: "rgba(0, 0, 0, 0.05)",
      blob2: "rgba(0, 0, 0, 0.03)",
      cardBg: "#ffffff",
      cardBorder: "#f3f4f6",
      textPrimary: "#111827",
      textSecondary: "rgba(17, 24, 39, 0.55)",
      accent: "#374151",
    },
    typography: {
      heroFont: "sans",
      heroWeight: 500,
      heroTracking: "-0.02em",
      ornament: "",
    },
    taglineTemplate: "Less, but better",
  },
] as const

const HEX_RE = /^#[0-9a-f]{6}$/i

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === "object" && !Array.isArray(raw)
}

function parseHex(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback
  const t = raw.trim()
  const withHash = t.startsWith("#") ? t : `#${t}`
  return HEX_RE.test(withHash) ? withHash.toLowerCase() : fallback
}

function parseRgba(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback
  return raw.trim().slice(0, 80)
}

function parsePalette(raw: unknown, fallback: HauteGammePalette): HauteGammePalette {
  if (!isRecord(raw)) return fallback
  return {
    bgFrom: parseHex(raw.bgFrom, fallback.bgFrom),
    bgTo: parseHex(raw.bgTo, fallback.bgTo),
    blob1: parseRgba(raw.blob1, fallback.blob1),
    blob2: parseRgba(raw.blob2, fallback.blob2),
    cardBg: parseRgba(raw.cardBg, fallback.cardBg),
    cardBorder: parseRgba(raw.cardBorder, fallback.cardBorder),
    textPrimary: parseHex(raw.textPrimary, fallback.textPrimary),
    textSecondary: parseRgba(raw.textSecondary, fallback.textSecondary),
    accent: parseHex(raw.accent, fallback.accent),
  }
}

function parseTypography(raw: unknown, fallback: HauteGammeTypography): HauteGammeTypography {
  if (!isRecord(raw)) return fallback
  const heroFontRaw = typeof raw.heroFont === "string" ? raw.heroFont.trim().toLowerCase() : fallback.heroFont
  const heroFont: HauteGammeHeroFont =
    heroFontRaw === "serif" ||
    heroFontRaw === "sans" ||
    heroFontRaw === "display" ||
    heroFontRaw === "mono"
      ? heroFontRaw
      : fallback.heroFont
  return {
    heroFont,
    heroWeight:
      typeof raw.heroWeight === "number" && Number.isFinite(raw.heroWeight)
        ? raw.heroWeight
        : fallback.heroWeight,
    heroTracking:
      typeof raw.heroTracking === "string" && raw.heroTracking.trim()
        ? raw.heroTracking.trim().slice(0, 24)
        : fallback.heroTracking,
    ornament:
      typeof raw.ornament === "string" ? raw.ornament.slice(0, 4) : fallback.ornament,
    heroItalic: raw.heroItalic === true ? true : fallback.heroItalic,
  }
}

export function getHauteGammeDesignById(id: string): HauteGammeDesign | null {
  const normalized = id.trim().toLowerCase()
  return HAUTE_GAMME_DESIGNS.find((d) => d.id === normalized) ?? null
}

const BUYER_TAGLINE_BY_DESIGN: Record<
  HauteGammeDesignId,
  { en: string; fr: string }
> = {
  eclipse: {
    en: "Curated essentials for the modern era.",
    fr: "Essentiels curatés pour l'ère moderne.",
  },
  atelier: {
    en: "Objects of desire, thoughtfully sourced.",
    fr: "Objets de désir, sélectionnés avec soin.",
  },
  noir: {
    en: "Precision. Craft. Detail.",
    fr: "Précision. Savoir-faire. Détail.",
  },
  cyber: {
    en: "Future archive 001 — tech & gaming curated for you.",
    fr: "Future archive 001 — tech & gaming sélectionnés pour vous.",
  },
  lush: {
    en: "Rooted in nature, refined for everyday.",
    fr: "Inspiré par la nature, pensé pour vous.",
  },
  minimal: {
    en: "Less, but better.",
    fr: "Moins, mais mieux.",
  },
}

export function isAffiliateFacingTagline(text: string): boolean {
  return /your audience|ton audience|votre audience|picks your audience|audience will love/i.test(
    text
  )
}

export function buildHauteGammeMerchantTagline(args: {
  vibe: string
  storeLabel: string
}): string {
  const vibe = args.vibe.trim()
  if (!vibe) {
    return `${args.storeLabel} — curated picks your audience will love.`.slice(0, 160)
  }
  return `${args.storeLabel} — ${vibe} picks your audience will love.`.slice(0, 160)
}

export function buildHauteGammeBuyerTagline(args: {
  design: HauteGammeDesign
  storeLabel: string
  locale?: string
}): string {
  const locale = args.locale === "fr" ? "fr" : "en"
  const template =
    BUYER_TAGLINE_BY_DESIGN[args.design.id as HauteGammeDesignId]?.[locale] ??
    args.design.taglineTemplate
  return `${args.storeLabel} — ${template}`.slice(0, 120)
}

/** @deprecated Use buildHauteGammeMerchantTagline — kept for legacy imports. */
export function buildHauteGammeTagline(args: {
  design: HauteGammeDesign
  vibe: string
  storeLabel: string
}): string {
  return buildHauteGammeMerchantTagline({ vibe: args.vibe, storeLabel: args.storeLabel })
}

export function resolvePublicBoutiqueTagline(args: {
  brandStudio: BrandStudioSnapshot | null
  boutiqueAiTagline: string | null
  storeDescription: string | null
  storeLabel: string
  locale?: string
}): string | null {
  if (args.brandStudio?.buyerTagline?.trim()) {
    return args.brandStudio.buyerTagline.trim()
  }

  if (args.brandStudio?.designId) {
    const design = getHauteGammeDesignById(args.brandStudio.designId)
    if (design) {
      return buildHauteGammeBuyerTagline({
        design,
        storeLabel: args.storeLabel,
        locale: args.locale,
      })
    }
  }

  const ai = args.boutiqueAiTagline?.trim()
  if (ai && !isAffiliateFacingTagline(ai)) {
    return ai
  }

  const description = args.storeDescription?.trim()
  if (description && !isAffiliateFacingTagline(description)) {
    return description
  }

  return null
}

export function parseBrandStudioSnapshot(
  raw: unknown,
  options?: { storeLabel?: string; locale?: string }
): BrandStudioSnapshot | null {
  if (!isRecord(raw)) return null
  const designId = typeof raw.designId === "string" ? raw.designId.trim().toLowerCase() : ""
  const design = getHauteGammeDesignById(designId)
  if (!design) return null

  const vibe = typeof raw.vibe === "string" ? raw.vibe.trim().slice(0, 400) : ""
  const legacyTagline =
    typeof raw.tagline === "string" ? raw.tagline.trim().slice(0, 160) : ""
  const storeLabel = options?.storeLabel?.trim() || "Store"

  const merchantTagline =
    typeof raw.merchantTagline === "string" && raw.merchantTagline.trim()
      ? raw.merchantTagline.trim().slice(0, 160)
      : isAffiliateFacingTagline(legacyTagline)
        ? legacyTagline
        : buildHauteGammeMerchantTagline({ vibe, storeLabel })

  const buyerTagline =
    typeof raw.buyerTagline === "string" && raw.buyerTagline.trim()
      ? raw.buyerTagline.trim().slice(0, 120)
      : legacyTagline && !isAffiliateFacingTagline(legacyTagline)
        ? legacyTagline.slice(0, 120)
        : buildHauteGammeBuyerTagline({ design, storeLabel, locale: options?.locale })

  if (!merchantTagline && !buyerTagline) return null

  const heroTitle =
    typeof raw.heroTitle === "string" ? raw.heroTitle.trim().slice(0, 80) : ""
  const designIndex =
    typeof raw.designIndex === "number" && raw.designIndex >= 1 && raw.designIndex <= 1024
      ? Math.round(raw.designIndex)
      : resolveStableDesignIndex("store", designId)
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt.trim()
      ? raw.updatedAt.trim()
      : new Date(0).toISOString()

  return {
    designId: design.id,
    vibe,
    merchantTagline,
    buyerTagline,
    palette: parsePalette(raw.palette, design.palette),
    typography: parseTypography(raw.typography, design.typography),
    heroTitle,
    designIndex,
    updatedAt,
  }
}

export function parseBrandStudioFromStorefrontTheme(
  raw: unknown,
  options?: { storeLabel?: string; locale?: string }
): BrandStudioSnapshot | null {
  if (!isRecord(raw)) return null
  return parseBrandStudioSnapshot(raw.brandStudio, options)
}

export function matchVibeToDesign(vibe: string): HauteGammeDesign {
  const blob = vibe.trim().toLowerCase()
  if (!blob) return HAUTE_GAMME_DESIGNS[0]!

  type Rule = { test: RegExp; id: HauteGammeDesign["id"] }
  const rules: Rule[] = [
    { test: /luxury|luxe|premium|haute|couture|artisan|gold|jewel/, id: "atelier" },
    { test: /neon|cyber|gaming|gamer|rgb|futur|tech|crypto|web3/, id: "cyber" },
    { test: /minimal|clean|simple|white|less|scandinav|quiet|essential/, id: "minimal" },
    { test: /noir|black|stealth|monochrome|precision|craft/, id: "noir" },
    { test: /green|nature|eco|organic|emerald|lush|botanical|forest/, id: "lush" },
    { test: /dark|modern|night|midnight|eclipse|moody/, id: "eclipse" },
  ]

  for (const rule of rules) {
    if (rule.test.test(blob)) {
      const design = getHauteGammeDesignById(rule.id)
      if (design) return design
    }
  }

  for (const design of HAUTE_GAMME_DESIGNS) {
    if (design.vibeKeywords.some((kw) => blob.includes(kw))) {
      return design
    }
  }

  return HAUTE_GAMME_DESIGNS[0]!
}

/** Stable 1–1024 skin index for badge display. */
export function resolveStableDesignIndex(storeSlug: string, designId: string): number {
  const seed = `${storeSlug.trim().toLowerCase()}:${designId.trim().toLowerCase()}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return (hash % 1024) + 1
}

export function buildHauteGammeHeroTitle(args: {
  storeLabel: string
  typography: HauteGammeTypography
}): string {
  const name = args.storeLabel.trim()
  const o = args.typography.ornament.trim()
  if (!o) return name
  return `${o} ${name} ${o}`.slice(0, 80)
}

function ornamentCharToId(ornament: string): BoutiqueTitleOrnamentId {
  switch (ornament.trim()) {
    case "★":
      return "star"
    case "✦":
      return "sparkle"
    case "◆":
    case "◈":
      return "diamond"
    default:
      return "none"
  }
}

function heroFontToFontId(args: HauteGammeTypography): BoutiqueTitleFontId {
  if (args.heroFont === "mono") return "jetbrains"
  if (args.heroFont === "display") return "unbounded"
  if (args.heroFont === "serif") return args.heroItalic ? "cormorant" : "playfair"
  if (args.heroWeight <= 400) return "space-grotesk"
  return "geist"
}

export function hauteGammeToBoutiqueTitleTypography(
  typography: HauteGammeTypography
): BoutiqueTitleTypography {
  return {
    fontId: heroFontToFontId(typography),
    ornamentId: ornamentCharToId(typography.ornament),
    layoutId: "name-only",
    displayOverride: null,
  }
}

function mixAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  if (h.length !== 6) return hex
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function isDarkPalette(palette: HauteGammePalette): boolean {
  const probe = palette.bgFrom.replace("#", "")
  if (probe.length !== 6) return true
  const r = Number.parseInt(probe.slice(0, 2), 16)
  const g = Number.parseInt(probe.slice(2, 4), 16)
  const b = Number.parseInt(probe.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.45
}

/** Maps haute gamme palette → procedural boutique CSS vars. */
export function hauteGammePaletteToCssVars(palette: HauteGammePalette): StorefrontThemeCssVars {
  const dark = isDarkPalette(palette)
  const accentSoft = mixAlpha(palette.accent, dark ? 0.35 : 0.22)
  const mid = palette.bgTo

  return {
    shellBg: palette.bgFrom,
    shellGradientFrom: palette.bgFrom,
    shellGradientVia: mid,
    shellGradientTo: palette.bgTo,
    blob1: palette.blob1,
    blob2: palette.blob2,
    blob3: palette.blob2,
    accent: palette.accent,
    accentSoft,
    cardBg: palette.cardBg,
    cardBorder: palette.cardBorder,
    cardShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    cardTitle: palette.textPrimary,
    cardMuted: palette.textSecondary,
    price: palette.textPrimary,
    headerWord: palette.textSecondary,
    headerAccentFrom: palette.accent,
    headerAccentTo: palette.textPrimary,
    headerMuted: palette.textSecondary,
    badgeBg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    badgeBorder: palette.cardBorder,
    badgeText: palette.textPrimary,
    buttonFrom: palette.accent,
    buttonTo: palette.textPrimary,
    buttonShadow: `0 16px 40px ${mixAlpha(palette.accent, 0.35)}`,
    footerBorder: palette.cardBorder,
    footerText: palette.textSecondary,
    aiButtonBg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
    aiButtonBorder: palette.cardBorder,
    aiButtonText: palette.textPrimary,
    regenerateBg: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    regenerateBorder: palette.cardBorder,
    regenerateText: palette.textSecondary,
    merchantHeaderFrom: palette.bgFrom,
    merchantHeaderVia: mid,
    merchantHeaderTo: palette.bgTo,
    merchantHeaderBorder: palette.cardBorder,
    merchantHeaderGlow: accentSoft,
    merchantHeaderBadgeBorder: palette.cardBorder,
    merchantHeaderBadgeIcon: palette.accent,
    merchantHeaderActive: palette.accent,
    merchantHeaderActiveGlow: accentSoft,
    merchantHeaderCartBadge: palette.accent,
    merchantHeaderCartBadgeText: dark ? "#0a0a0a" : "#ffffff",
    merchantHeaderLogoFrom: palette.accent,
    merchantHeaderLogoTo: palette.textPrimary,
    merchantHeaderLogoTop: mixAlpha(palette.accent, 0.35),
    merchantHeaderLogoBottom: mixAlpha(palette.textPrimary, 0.2),
    merchantHeaderFade: mixAlpha(palette.bgTo, 0.92),
    merchantHeaderShadow: "0 12px 40px rgba(0,0,0,0.18)",
    merchantHeaderText: palette.textPrimary,
    merchantHeaderTextMuted: palette.textSecondary,
    merchantHeaderIcon: palette.textPrimary,
    merchantHeaderHoverBg: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
    merchantHeaderDivider: palette.cardBorder,
    merchantHeaderFocusRing: mixAlpha(palette.accent, 0.45),
    merchantHeaderScrim: dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.72)",
  }
}

export function brandStudioToThemeDefinition(snapshot: BrandStudioSnapshot): {
  id: string
  index: number
  label: string
  family: string
  isDark: boolean
  previewBg: string
  previewAccent: string
  cssVars: StorefrontThemeCssVars
} {
  const design = getHauteGammeDesignById(snapshot.designId)
  const palette = snapshot.palette
  return {
    id: snapshot.designId,
    index: snapshot.designIndex - 1,
    label: design?.name ?? snapshot.designId.toUpperCase(),
    family: design?.name ?? snapshot.designId.toUpperCase(),
    isDark: isDarkPalette(palette),
    previewBg: palette.bgFrom,
    previewAccent: palette.accent,
    cssVars: hauteGammePaletteToCssVars(palette),
  }
}
