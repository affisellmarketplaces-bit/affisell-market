/** Affisell triptyque slogan system — buyer TRUST / reseller PROFIT / supplier SCALE. Client-safe. */

export type SloganPersona = "buyer" | "reseller" | "supplier"

export type SloganPersonaConfig = {
  route: string
  emotion: "TRUST" | "PROFIT" | "SCALE"
  /** Tailwind gradient classes for the rotating phrase (light surfaces). */
  color: string
  /** Gradient on dark hero surfaces (buyer home). */
  colorOnDark: string
  bg: string
  pageBg: string
  textTone: "dark" | "light"
  base: string
  rotatifs: readonly string[]
  fixedSuffix: string | null
  interval: number
  /** Full canonical H1 for SEO / noscript / sr-only. */
  canonical: string
}

export const SLOGAN_SYSTEM: Record<SloganPersona, SloganPersonaConfig> = {
  buyer: {
    route: "/",
    emotion: "TRUST",
    color: "from-violet-600 via-indigo-600 to-blue-600",
    colorOnDark: "from-violet-200 via-fuchsia-200 to-indigo-200",
    bg: "bg-violet-50",
    pageBg: "bg-[#faf5ff]",
    textTone: "dark",
    base: "Stores you trust.",
    rotatifs: [
      "Products verified.",
      "Makers verified.",
      "Payments protected.",
      "Returns guaranteed.",
      "Shops curated.",
      "Quality assured.",
    ],
    fixedSuffix: null,
    interval: 3500,
    canonical: "Stores you trust. Products verified.",
  },
  reseller: {
    route: "/become-reseller",
    emotion: "PROFIT",
    color: "from-violet-300 via-fuchsia-200 to-sky-200",
    colorOnDark: "from-violet-300 via-fuchsia-200 to-sky-200",
    bg: "bg-violet-600",
    pageBg: "bg-[#6d28d9]",
    textTone: "light",
    base: "Turn",
    rotatifs: [
      "products into profits",
      "ideas into income",
      "listings into cash",
      "clicks into profit",
      "trends into money",
      "catalog into revenue",
      "views into sales",
      "stock into income",
    ],
    fixedSuffix: "Instantly.",
    interval: 2500,
    canonical: "Turn products into profits. Instantly.",
  },
  supplier: {
    route: "/become-supplier",
    emotion: "SCALE",
    color: "from-emerald-300 via-teal-200 to-cyan-200",
    colorOnDark: "from-emerald-300 via-teal-200 to-cyan-200",
    bg: "bg-emerald-600",
    pageBg: "bg-[#065f46]",
    textTone: "light",
    base: "Turn",
    rotatifs: [
      "inventory into income",
      "stock into sales",
      "products into stores",
      "catalog into cashflow",
      "warehouse into revenue",
      "listings into orders",
      "inventory into scale",
      "products into 33 countries",
    ],
    fixedSuffix: "Instantly.",
    interval: 2700,
    canonical: "Turn inventory into income. Instantly.",
  },
}

export function longestSloganPhrase(phrases: readonly string[]): string {
  return phrases.reduce((a, s) => (s.length > a.length ? s : a), phrases[0] ?? "")
}

export function resolveSloganCopy(
  persona: SloganPersona,
  overrides?: {
    base?: string
    rotatifs?: readonly string[]
    fixedSuffix?: string | null
    canonical?: string
  }
): Pick<SloganPersonaConfig, "base" | "rotatifs" | "fixedSuffix" | "canonical" | "interval"> {
  const cfg = SLOGAN_SYSTEM[persona]
  const rotatifs = overrides?.rotatifs?.length ? overrides.rotatifs : cfg.rotatifs
  return {
    base: overrides?.base ?? cfg.base,
    rotatifs,
    fixedSuffix:
      overrides?.fixedSuffix !== undefined ? overrides.fixedSuffix : cfg.fixedSuffix,
    canonical: overrides?.canonical ?? cfg.canonical,
    interval: cfg.interval,
  }
}
