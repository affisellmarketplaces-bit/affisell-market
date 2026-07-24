/** Affisell triptyque slogan system — enriched metadata on top of `system.ts`. Client-safe. */

import {
  SLOGAN_SYSTEM as CORE,
  type SloganPersona,
} from "@/lib/slogans/system"

export type { SloganPersona } from "@/lib/slogans/system"
export { SLOGAN_SYSTEM as SLOGAN_CORE } from "@/lib/slogans/system"

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
    colorOnDark: CORE.buyer.color,
    bg: "bg-violet-50",
    pageBg: "bg-[#faf5ff]",
    textTone: "dark",
    base: CORE.buyer.base,
    rotatifs: CORE.buyer.rotatifs,
    fixedSuffix: null,
    interval: CORE.buyer.interval,
    canonical: "Stores you trust. Products verified.",
  },
  reseller: {
    route: "/become-reseller",
    emotion: "PROFIT",
    color: CORE.reseller.color,
    colorOnDark: CORE.reseller.color,
    bg: "bg-violet-600",
    pageBg: "bg-[#6d28d9]",
    textTone: "light",
    base: CORE.reseller.base,
    rotatifs: CORE.reseller.rotatifs,
    fixedSuffix: CORE.reseller.suffix ?? "Instantly.",
    interval: CORE.reseller.interval,
    canonical: "Turn products into profits. Instantly.",
  },
  supplier: {
    route: "/become-supplier",
    emotion: "SCALE",
    color: CORE.supplier.color,
    colorOnDark: CORE.supplier.color,
    bg: "bg-emerald-600",
    pageBg: "bg-[#065f46]",
    textTone: "light",
    base: CORE.supplier.base,
    rotatifs: CORE.supplier.rotatifs,
    fixedSuffix: CORE.supplier.suffix ?? "Instantly.",
    interval: CORE.supplier.interval,
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
