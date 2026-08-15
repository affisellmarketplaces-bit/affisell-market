/** Client-safe types + fallbacks for /boutique AI personalization (no Prisma). */

import {
  sanitizePublicBoutiqueTagline,
} from "@/lib/boutique/haute-gamme-themes-shared"
import {
  STOREFRONT_THEME_COUNT,
  themeRefFromVibe,
  type StorefrontTheme,
} from "@/lib/boutique/storefront-theme-engine"

export type BoutiqueAiPersonalizePayload = {
  themeId: StorefrontTheme
  label: string
  tagline: string
  rationale: string
  source: "ai" | "rules"
  persisted: boolean
}

const MAX_VIBE = 400
const MAX_TAGLINE = 120
const MAX_RATIONALE = 220

function clamp(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, max)
}

function themeIndexFromId(themeId: string): number | null {
  const match = /^t-(\d{1,4})$/i.exec(themeId.trim())
  if (!match) return null
  const index = Number.parseInt(match[1] ?? "", 10)
  if (!Number.isFinite(index) || index < 0 || index >= STOREFRONT_THEME_COUNT) return null
  return index
}

export function themeIdFromIndex(index: number): StorefrontTheme {
  const safe = ((index % STOREFRONT_THEME_COUNT) + STOREFRONT_THEME_COUNT) % STOREFRONT_THEME_COUNT
  return `t-${String(safe).padStart(4, "0")}`
}

/** Rule-based theme index from merchant vibe + optional catalog keywords. */
export function inferBoutiqueThemeIndexFromVibe(args: {
  vibe: string
  catalogKeywords?: string[]
  locale?: string
}): number {
  const blob = `${args.vibe} ${(args.catalogKeywords ?? []).join(" ")}`.toLowerCase()
  const fr = args.locale === "fr"

  type Rule = { test: RegExp; index: number; rationale: string }
  const rules: Rule[] = [
    {
      test: /luxury|luxe|premium|gold|haute|maroquin|jewel|bijou/,
      index: 384,
      rationale: fr ? "Univers luxe → Obsidian doré." : "Luxury vibe → golden Obsidian.",
    },
    {
      test: /minimal|clean|simple|blanc|white|scandinav|épur/,
      index: 128,
      rationale: fr ? "Minimalisme → palette claire aérée." : "Minimal vibe → light airy palette.",
    },
    {
      test: /neon|cyber|gaming|gamer|rgb|futur|tech|crypto|web3/,
      index: 640,
      rationale: fr ? "Tech & gaming → néon cyber futuriste." : "Tech gaming → neon cyber skin.",
    },
    {
      test: /nature|green|vert|eco|bio|organic|plante/,
      index: 288,
      rationale: fr ? "Nature → harmonies vertes profondes." : "Nature → deep green harmonies.",
    },
    {
      test: /beauty|beauté|cosmet|makeup|skincare|skin/,
      index: 320,
      rationale: fr ? "Beauté → prism rose-violet." : "Beauty → rose-violet prism.",
    },
    {
      test: /sport|fit|gym|energy|performance|run/,
      index: 448,
      rationale: fr ? "Sport → pulse énergique." : "Sport → energetic pulse.",
    },
    {
      test: /sunset|warm|chaud|orange|terracotta|mediterr/,
      index: 192,
      rationale: fr ? "Chaleur solaire → dégradés sunset." : "Warm sunset gradients.",
    },
    {
      test: /ocean|mer|blue|bleu|marin|coastal/,
      index: 512,
      rationale: fr ? "Océan → cyan profond apaisant." : "Ocean → deep calming cyan.",
    },
  ]

  const matched = rules.find((r) => r.test.test(blob))
  if (matched) {
    return (matched.index + (blob.length % 48)) % STOREFRONT_THEME_COUNT
  }

  const hashId = themeRefFromVibe(args.vibe || "affisell boutique")
  return themeIndexFromId(hashId) ?? 0
}

export function inferBoutiquePersonalizeFromVibe(args: {
  vibe: string
  storeName: string
  catalogKeywords?: string[]
  locale?: string
}): Omit<BoutiqueAiPersonalizePayload, "persisted"> {
  const fr = args.locale === "fr"
  const vibe = clamp(args.vibe, MAX_VIBE) || (fr ? "boutique premium moderne" : "modern premium store")
  const index = inferBoutiqueThemeIndexFromVibe({
    vibe,
    catalogKeywords: args.catalogKeywords,
    locale: args.locale,
  })
  const themeId = themeIdFromIndex(index)
  const storeName = args.storeName.trim().slice(0, 40) || (fr ? "Ma boutique" : "My store")

  return {
    themeId,
    label: `Theme ${index + 1}`,
    tagline: fr
      ? `${storeName} — sélection premium · Paiement sécurisé Affisell.`
      : `${storeName} — premium curated selection · Secure Affisell checkout.`,
    rationale: fr
      ? `Palette harmonisée pour « ${vibe.slice(0, 60)} » (moteur ${index + 1}/${STOREFRONT_THEME_COUNT}).`
      : `Harmonized palette for “${vibe.slice(0, 60)}” (engine ${index + 1}/${STOREFRONT_THEME_COUNT}).`,
    source: "rules",
  }
}

export function parseBoutiqueAiPersonalizeJson(raw: string): Omit<BoutiqueAiPersonalizePayload, "persisted"> | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    let themeId = clamp(o.themeId, 12)
    const themeIndexRaw = o.themeIndex
    if (!themeId && typeof themeIndexRaw === "number" && Number.isFinite(themeIndexRaw)) {
      themeId = themeIdFromIndex(Math.round(themeIndexRaw))
    }
    if (!themeId) {
      const idx = themeIndexFromId(themeRefFromVibe(clamp(o.vibe, MAX_VIBE)))
      themeId = idx === null ? themeIdFromIndex(0) : themeIdFromIndex(idx)
    }
    if (themeIndexFromId(themeId) === null) return null

    const tagline = clamp(o.tagline, MAX_TAGLINE)
    const rationale = clamp(o.rationale, MAX_RATIONALE)
    const label = clamp(o.label, 80) || themeId

    if (!tagline) return null

    return {
      themeId,
      label,
      tagline,
      rationale: rationale || "AI-matched boutique visual theme.",
      source: "ai",
    }
  } catch {
    return null
  }
}

export function mergeBoutiqueTagline(
  storeName: string,
  tagline: string,
  locale?: string,
  vibe?: string
): string {
  return sanitizePublicBoutiqueTagline({
    raw: tagline,
    storeLabel: storeName.trim() || (locale === "fr" ? "Ma boutique" : "My store"),
    locale,
    vibe,
  })
}
