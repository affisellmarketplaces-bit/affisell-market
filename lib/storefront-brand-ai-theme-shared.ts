import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import type {
  StorefrontGridDensity,
  StorefrontHeroStyle,
  StorefrontLayoutMode,
  StorefrontSurface,
  StorefrontTheme,
} from "@/lib/storefront-theme-shared"
import { normalizeHexColor } from "@/lib/storefront-theme-shared"

export const BRAND_AI_THEME_PRESET_IDS = [
  "nebula-aurora",
  "violet-pulse",
  "emerald-luxe",
  "midnight-orbit",
  "rose-editorial",
  "quantum-glow",
  "solar-flare",
  "ocean-depth",
  "crimson-nova",
  "clean-minimal",
] as const

export type BrandAiThemePresetId = (typeof BRAND_AI_THEME_PRESET_IDS)[number]

export type BrandAiThemePayload = {
  presetId: BrandAiThemePresetId
  primary: string
  accent: string
  surface: StorefrontSurface
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  description: string
  boutiqueTagline: string
  storyBody: string
  rationale: string
  source: "ai" | "rules"
}

const MAX_DESCRIPTION = 280
const MAX_TAGLINE = 120
const MAX_STORY = 400
const MAX_RATIONALE = 200

function clamp(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, max)
}

export function isBrandAiThemePresetId(raw: unknown): raw is BrandAiThemePresetId {
  return typeof raw === "string" && (BRAND_AI_THEME_PRESET_IDS as readonly string[]).includes(raw)
}

export function parseGeneratedBrandTheme(raw: string): Omit<BrandAiThemePayload, "source"> | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const presetId = isBrandAiThemePresetId(o.presetId) ? o.presetId : null
    const primary = normalizeHexColor(o.primary)
    const accent = normalizeHexColor(o.accent)
    const description = clamp(o.description, MAX_DESCRIPTION)
    const boutiqueTagline = clamp(o.boutiqueTagline, MAX_TAGLINE)
    const storyBody = clamp(o.storyBody, MAX_STORY)
    const rationale = clamp(o.rationale, MAX_RATIONALE)
    if (!presetId || !primary || !accent || !description) return null

    const surfaceRaw = typeof o.surface === "string" ? o.surface.toLowerCase() : "dark"
    const layoutRaw = typeof o.layout === "string" ? o.layout.toLowerCase() : "immersive"
    const heroRaw = typeof o.heroStyle === "string" ? o.heroStyle.toLowerCase() : "gradient"
    const gridRaw = typeof o.gridDensity === "string" ? o.gridDensity.toLowerCase() : "spacious"

    return {
      presetId,
      primary,
      accent,
      surface: (["light", "dark", "glass"].includes(surfaceRaw)
        ? surfaceRaw
        : "dark") as StorefrontSurface,
      layout: (["classic", "immersive", "minimal"].includes(layoutRaw)
        ? layoutRaw
        : "immersive") as StorefrontLayoutMode,
      heroStyle: (["banner", "gradient", "video", "none"].includes(heroRaw)
        ? heroRaw
        : "gradient") as StorefrontHeroStyle,
      gridDensity: (["cozy", "compact", "spacious"].includes(gridRaw)
        ? gridRaw
        : "spacious") as StorefrontGridDensity,
      description,
      boutiqueTagline: boutiqueTagline || description.slice(0, MAX_TAGLINE),
      storyBody: storyBody || description,
      rationale: rationale || "AI-matched palette for your catalog.",
    }
  } catch {
    return null
  }
}

export type CatalogThemeHint = {
  keywords: string[]
  listingCount: number
}

/** Rule-based wow preset when Groq is unavailable — idempotent from catalog text. */
export function inferBrandThemeFromCatalog(args: {
  storeName: string
  hints: CatalogThemeHint
  locale?: string
}): BrandAiThemePayload {
  const blob = `${args.storeName} ${args.hints.keywords.join(" ")}`.toLowerCase()
  const fr = args.locale === "fr"

  type Rule = { test: RegExp; preset: BrandAiThemePresetId; rationale: string }
  const rules: Rule[] = [
    {
      test: /bbq|grill|barbecue|outdoor|jardin|terrasse/,
      preset: "solar-flare",
      rationale: fr ? "Catalogue outdoor → flare solaire premium." : "Outdoor catalog → premium solar flare.",
    },
    {
      test: /shoe|sneaker|chaussure|mode|fashion|streetwear/,
      preset: "crimson-nova",
      rationale: fr ? "Mode détectée → éditorial rose magma." : "Fashion detected → crimson editorial.",
    },
    {
      test: /tech|gadget|phone|usb|smart|electron/,
      preset: "midnight-orbit",
      rationale: fr ? "Tech détecté → cyber cyan minuit." : "Tech catalog → midnight cyber cyan.",
    },
    {
      test: /beauty|skin|cosmet|makeup|skincare/,
      preset: "violet-pulse",
      rationale: fr ? "Beauté → néon violet immersif." : "Beauty niche → immersive violet neon.",
    },
    {
      test: /fit|sport|gym|wellness|yoga|protein/,
      preset: "emerald-luxe",
      rationale: fr ? "Fitness → verre émeraude performance." : "Fitness → emerald glass performance.",
    },
    {
      test: /home|maison|deco|kitchen|cuisine/,
      preset: "quantum-glow",
      rationale: fr ? "Maison → verre quantique chaleureux." : "Home & living → quantum glass warmth.",
    },
  ]

  const matched = rules.find((r) => r.test.test(blob))
  const presetId: BrandAiThemePresetId = matched?.preset ?? "nebula-aurora"
  const rationale =
    matched?.rationale ??
    (fr
      ? "Signature Nebula Aurora — dégradé violet→cyan, effet vitrine futuriste."
      : "Nebula Aurora signature — violet→cyan gradient, futuristic storefront wow.")

  const storeName = args.storeName.trim().slice(0, 40) || (fr ? "Ma boutique" : "My Store")
  const count = args.hints.listingCount

  return {
    presetId,
    primary: "",
    accent: "",
    surface: presetId === "clean-minimal" ? "light" : "dark",
    layout: presetId === "clean-minimal" ? "minimal" : "immersive",
    heroStyle: presetId === "clean-minimal" ? "none" : "gradient",
    gridDensity: "spacious",
    description: fr
      ? `${storeName} — sélection ${count > 0 ? `${count} produit${count > 1 ? "s" : ""}` : "curator"} pensée pour convertir votre audience.`
      : `${storeName} — a curated ${count > 0 ? `${count}-product` : ""} selection built to convert your audience.`,
    boutiqueTagline: fr
      ? "Checkout 1-clic · Paiement sécurisé Affisell"
      : "1-click checkout · Affisell secure payments",
    storyBody: fr
      ? `Découvrez ${storeName} : une vitrine premium propulsée par Affisell, optimisée pour la confiance et la conversion.`
      : `Discover ${storeName}: a premium Affisell-powered storefront optimized for trust and conversion.`,
    rationale,
    source: "rules",
  }
}

export function brandAiThemeToStorefrontTheme(payload: BrandAiThemePayload): StorefrontTheme {
  const preset = findStorefrontThemePreset(payload.presetId)
  const base = preset?.theme ?? findStorefrontThemePreset("nebula-aurora")!.theme
  return {
    ...base,
    presetId: payload.presetId,
    primary: payload.primary,
    accent: payload.accent,
    surface: payload.surface,
    layout: payload.layout,
    heroStyle: payload.heroStyle,
    gridDensity: payload.gridDensity,
  }
}
