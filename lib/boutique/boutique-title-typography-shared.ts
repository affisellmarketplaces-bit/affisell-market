/** Boutique H1 typography — client-safe (no Prisma). */

export const BOUTIQUE_TITLE_FONT_IDS = [
  "geist",
  "syne",
  "orbitron",
  "playfair",
  "space-grotesk",
  "cormorant",
  "rajdhani",
  "unbounded",
  "jetbrains",
  "bodoni",
] as const

export type BoutiqueTitleFontId = (typeof BOUTIQUE_TITLE_FONT_IDS)[number]

export const BOUTIQUE_TITLE_ORNAMENT_IDS = [
  "none",
  "sparkle",
  "diamond",
  "star",
  "brackets",
  "chevrons",
  "wave",
  "slash",
  "dot-ring",
] as const

export type BoutiqueTitleOrnamentId = (typeof BOUTIQUE_TITLE_ORNAMENT_IDS)[number]

export const BOUTIQUE_TITLE_LAYOUT_IDS = [
  "boutique-accent",
  "full-gradient",
  "name-only",
  "custom-only",
] as const

export type BoutiqueTitleLayoutId = (typeof BOUTIQUE_TITLE_LAYOUT_IDS)[number]

export type BoutiqueTitleTypography = {
  fontId: BoutiqueTitleFontId
  ornamentId: BoutiqueTitleOrnamentId
  layoutId: BoutiqueTitleLayoutId
  /** Merchant override with special chars — max 80 chars. */
  displayOverride: string | null
}

export const DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY: BoutiqueTitleTypography = {
  fontId: "geist",
  ornamentId: "none",
  layoutId: "boutique-accent",
  displayOverride: null,
}

export type BoutiqueTitleFontPreset = {
  id: BoutiqueTitleFontId
  label: string
  family: string
  googleUrl: string | null
  weight: number
  letterSpacing?: string
}

export const BOUTIQUE_TITLE_FONTS: readonly BoutiqueTitleFontPreset[] = [
  {
    id: "geist",
    label: "Geist",
    family: 'var(--font-geist-sans, ui-sans-serif), system-ui, sans-serif',
    googleUrl: null,
    weight: 700,
  },
  {
    id: "syne",
    label: "Syne",
    family: '"Syne", ui-sans-serif, sans-serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&display=swap",
    weight: 800,
    letterSpacing: "-0.02em",
  },
  {
    id: "orbitron",
    label: "Orbitron",
    family: '"Orbitron", ui-sans-serif, sans-serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&display=swap",
    weight: 700,
    letterSpacing: "0.04em",
  },
  {
    id: "playfair",
    label: "Playfair",
    family: '"Playfair Display", Georgia, serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap",
    weight: 700,
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    family: '"Space Grotesk", ui-sans-serif, sans-serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap",
    weight: 700,
    letterSpacing: "-0.03em",
  },
  {
    id: "cormorant",
    label: "Cormorant",
    family: '"Cormorant Garamond", Georgia, serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&display=swap",
    weight: 700,
  },
  {
    id: "rajdhani",
    label: "Rajdhani",
    family: '"Rajdhani", ui-sans-serif, sans-serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&display=swap",
    weight: 700,
    letterSpacing: "0.06em",
  },
  {
    id: "unbounded",
    label: "Unbounded",
    family: '"Unbounded", ui-sans-serif, sans-serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700&display=swap",
    weight: 700,
    letterSpacing: "-0.01em",
  },
  {
    id: "jetbrains",
    label: "JetBrains",
    family: '"JetBrains Mono", ui-monospace, monospace',
    googleUrl: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;700&display=swap",
    weight: 700,
    letterSpacing: "-0.02em",
  },
  {
    id: "bodoni",
    label: "Bodoni Moda",
    family: '"Bodoni Moda", Georgia, serif',
    googleUrl: "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,600;6..96,700&display=swap",
    weight: 700,
  },
] as const

export type BoutiqueTitleOrnamentPreset = {
  id: BoutiqueTitleOrnamentId
  prefix: string
  suffix: string
  sample: string
}

export const BOUTIQUE_TITLE_ORNAMENTS: readonly BoutiqueTitleOrnamentPreset[] = [
  { id: "none", prefix: "", suffix: "", sample: "Ecom Store" },
  { id: "sparkle", prefix: "✦ ", suffix: " ✦", sample: "✦ Ecom Store ✦" },
  { id: "diamond", prefix: "◈ ", suffix: " ◈", sample: "◈ Ecom Store ◈" },
  { id: "star", prefix: "★ ", suffix: " ★", sample: "★ Ecom Store ★" },
  { id: "brackets", prefix: "「", suffix: "」", sample: "「Ecom Store」" },
  { id: "chevrons", prefix: "⟨ ", suffix: " ⟩", sample: "⟨ Ecom Store ⟩" },
  { id: "wave", prefix: "〜 ", suffix: " 〜", sample: "〜 Ecom Store 〜" },
  { id: "slash", prefix: "", suffix: "", sample: "Ecom · Store" },
  { id: "dot-ring", prefix: "◎ ", suffix: " ◎", sample: "◎ Ecom Store ◎" },
] as const

/** Quick-insert glyphs for the title editor. */
export const BOUTIQUE_TITLE_CHAR_PALETTE = [
  "✦",
  "◈",
  "★",
  "✨",
  "·",
  "—",
  "▲",
  "◆",
  "⚡",
  "∞",
  "◎",
  "✧",
  "⟨",
  "⟩",
  "「",
  "」",
  "•",
  "◇",
] as const

export type BoutiqueTitleSegment = {
  text: string
  variant: "prefix" | "name" | "accent" | "ornament"
}

const MAX_DISPLAY = 80
const DISPLAY_SAFE =
  /[^\p{L}\p{N}\s✦◈★✨·—▲◆⚡∞◎✧⟨⟩「」•◇\-_&'".!?]/gu

function parseEnumId<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof raw !== "string") return fallback
  const v = raw.trim().toLowerCase() as T
  return (allowed as readonly string[]).includes(v) ? v : fallback
}

export function sanitizeBoutiqueTitleDisplay(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const cleaned = raw.trim().replace(DISPLAY_SAFE, "").slice(0, MAX_DISPLAY)
  return cleaned || null
}

export function parseBoutiqueTitleTypography(raw: {
  boutiqueTitleFont?: unknown
  boutiqueTitleOrnament?: unknown
  boutiqueTitleLayout?: unknown
  boutiqueTitleDisplay?: unknown
}): BoutiqueTitleTypography {
  return {
    fontId: parseEnumId(raw.boutiqueTitleFont, BOUTIQUE_TITLE_FONT_IDS, DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY.fontId),
    ornamentId: parseEnumId(
      raw.boutiqueTitleOrnament,
      BOUTIQUE_TITLE_ORNAMENT_IDS,
      DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY.ornamentId
    ),
    layoutId: parseEnumId(
      raw.boutiqueTitleLayout,
      BOUTIQUE_TITLE_LAYOUT_IDS,
      DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY.layoutId
    ),
    displayOverride: sanitizeBoutiqueTitleDisplay(raw.boutiqueTitleDisplay),
  }
}

export function getBoutiqueTitleFontPreset(fontId: BoutiqueTitleFontId): BoutiqueTitleFontPreset {
  return BOUTIQUE_TITLE_FONTS.find((f) => f.id === fontId) ?? BOUTIQUE_TITLE_FONTS[0]!
}

export function getBoutiqueTitleOrnamentPreset(
  ornamentId: BoutiqueTitleOrnamentId
): BoutiqueTitleOrnamentPreset {
  return BOUTIQUE_TITLE_ORNAMENTS.find((o) => o.id === ornamentId) ?? BOUTIQUE_TITLE_ORNAMENTS[0]!
}

function applySlashOrnament(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return name
  return parts.join(" · ")
}

export function resolveBoutiqueTitleName(storeLabel: string, typography: BoutiqueTitleTypography): string {
  const base = typography.displayOverride?.trim() || storeLabel.trim()
  if (typography.ornamentId === "slash") return applySlashOrnament(base)
  return base
}

export function buildBoutiqueTitleSegments(args: {
  storeLabel: string
  typography: BoutiqueTitleTypography
  prefixWord?: string
}): { segments: BoutiqueTitleSegment[]; ariaLabel: string } {
  const prefixWord = args.prefixWord ?? "Boutique"
  const typography = args.typography
  const name = resolveBoutiqueTitleName(args.storeLabel, typography)
  const ornament = getBoutiqueTitleOrnamentPreset(typography.ornamentId)

  if (typography.layoutId === "custom-only" && typography.displayOverride) {
    return {
      ariaLabel: typography.displayOverride,
      segments: [{ text: typography.displayOverride, variant: "accent" }],
    }
  }

  if (typography.layoutId === "name-only") {
    const text =
      ornament.id === "slash"
        ? name
        : `${ornament.prefix}${name}${ornament.suffix}`.trim()
    return {
      ariaLabel: `${prefixWord} ${name}`,
      segments: [{ text, variant: "accent" }],
    }
  }

  if (typography.layoutId === "full-gradient") {
    const full = `${prefixWord} ${ornament.prefix}${name}${ornament.suffix}`.trim()
    return {
      ariaLabel: full,
      segments: [{ text: full, variant: "accent" }],
    }
  }

  const nameText =
    ornament.id === "slash" ? name : `${ornament.prefix}${name}${ornament.suffix}`.trim()

  return {
    ariaLabel: `${prefixWord} ${name}`,
    segments: [
      { text: `${prefixWord} `, variant: "prefix" },
      { text: nameText, variant: "accent" },
    ],
  }
}

export function inferBoutiqueTitleTypographyFromVibe(args: {
  vibe: string
  locale?: string
}): Pick<BoutiqueTitleTypography, "fontId" | "ornamentId" | "layoutId"> {
  const blob = args.vibe.toLowerCase()

  if (/luxury|luxe|premium|gold|haute|jewel|bijou|elegant/.test(blob)) {
    return { fontId: "playfair", ornamentId: "diamond", layoutId: "boutique-accent" }
  }
  if (/neon|cyber|gaming|gamer|rgb|futur|tech|crypto|web3|sci/.test(blob)) {
    return { fontId: "orbitron", ornamentId: "sparkle", layoutId: "boutique-accent" }
  }
  if (/minimal|clean|simple|scandinav|épur|swiss/.test(blob)) {
    return { fontId: "space-grotesk", ornamentId: "none", layoutId: "name-only" }
  }
  if (/mono|code|dev|hacker|terminal/.test(blob)) {
    return { fontId: "jetbrains", ornamentId: "chevrons", layoutId: "boutique-accent" }
  }
  if (/retro|vintage|80s|y2k/.test(blob)) {
    return { fontId: "unbounded", ornamentId: "wave", layoutId: "full-gradient" }
  }
  if (/editorial|magazine|fashion|mode/.test(blob)) {
    return { fontId: "bodoni", ornamentId: "brackets", layoutId: "boutique-accent" }
  }
  if (/sport|fit|energy|bold/.test(blob)) {
    return { fontId: "syne", ornamentId: "star", layoutId: "boutique-accent" }
  }

  return { fontId: "syne", ornamentId: "sparkle", layoutId: "boutique-accent" }
}

export function boutiqueTitleTypographyToStoreFields(
  typography: BoutiqueTitleTypography
): Record<string, string | undefined> {
  return {
    boutiqueTitleFont: typography.fontId,
    boutiqueTitleOrnament: typography.ornamentId,
    boutiqueTitleLayout: typography.layoutId,
    boutiqueTitleDisplay: typography.displayOverride ?? undefined,
  }
}
