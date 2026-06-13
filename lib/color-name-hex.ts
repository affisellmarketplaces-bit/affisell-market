import { COLORS, type CatalogColorSwatch, isMulticolorSwatch } from "@/lib/product-catalog-constants"

export type ResolvedColorSwatch = Pick<CatalogColorSwatch, "hex" | "multicolor">

/** Normalize for alias lookup (lowercase, no accents, collapsed spaces). */
export function normalizeColorKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

const COLOR_HEX_BY_KEY: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  noir: "#000000",
  blanc: "#FFFFFF",
  bleu: "#007AFF",
  blue: "#007AFF",
  rouge: "#FF3B30",
  red: "#FF3B30",
  vert: "#34C759",
  green: "#34C759",
  rose: "#FF2D92",
  pink: "#FF2D92",
  violet: "#AF52DE",
  purple: "#AF52DE",
  jaune: "#FFCC02",
  yellow: "#FFCC02",
  orange: "#FF9500",
  marron: "#A2845E",
  brown: "#A2845E",
  beige: "#F5E6D3",
  gris: "#8E8E93",
  gray: "#8E8E93",
  grey: "#8E8E93",
  argent: "#C0C0C0",
  silver: "#C0C0C0",
  or: "#FFD700",
  gold: "#FFD700",
  kaki: "#78866B",
  khaki: "#78866B",
  turquoise: "#5AC8FA",
  teal: "#008080",
  cyan: "#06B6D4",
  navy: "#1E3A5F",
  bordeaux: "#722F37",
  camel: "#C19A6B",
  ecru: "#F5F0E6",
  corail: "#FF7F50",
  coral: "#FF7F50",
  "space gray": "#8E8E93",
  "space grey": "#8E8E93",
  "gris sideral": "#8E8E93",
  midnight: "#1D1D3A",
  minuit: "#1D1D3A",
  titane: "#8E8E93",
  titanium: "#8E8E93",
  "gris fonce": "#374151",
  "gris foncé": "#374151",
  "dark gray": "#374151",
  "dark grey": "#374151",
  anthracite: "#383838",
  "rouge fonce": "#991B1B",
  "rouge foncé": "#991B1B",
  "dark red": "#991B1B",
  "violet de raisin": "#6B2D5C",
  raisin: "#6B2D5C",
  prune: "#6B2D5C",
  "z gris": "#71717A",
  "z-gris": "#71717A",
  multicolor: "multicolor",
  multicolore: "multicolor",
  multicolour: "multicolor",
}

function toSwatch(hex: string): ResolvedColorSwatch {
  if (hex === "multicolor") return { hex: "multicolor", multicolor: true }
  return { hex }
}

/** Stable distinct swatch for unknown supplier color names. */
export function stableHashColorHex(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 52%, 42%)`
}

function lookupAlias(key: string): ResolvedColorSwatch | null {
  const direct = COLOR_HEX_BY_KEY[key]
  if (direct) return toSwatch(direct)

  const catalog = COLORS.find((c) => normalizeColorKey(c.name) === key)
  if (catalog) {
    if (isMulticolorSwatch(catalog)) return { hex: "multicolor", multicolor: true }
    return { hex: catalog.hex }
  }

  const tokens = key.split(/[\s/]+/).filter(Boolean)
  for (const token of tokens) {
    const hit = COLOR_HEX_BY_KEY[token]
    if (hit) return toSwatch(hit)
  }

  const aliasKeys = Object.keys(COLOR_HEX_BY_KEY).sort((a, b) => b.length - a.length)
  for (const alias of aliasKeys) {
    if (alias.length < 3) continue
    if (key.includes(alias)) return toSwatch(COLOR_HEX_BY_KEY[alias]!)
  }

  return null
}

/** Resolve PDP swatch color from stored hex or color name (FR/EN). */
export function resolveColorSwatchMeta(
  colorName: string,
  storedHex?: string | null
): ResolvedColorSwatch {
  const stored = storedHex?.trim()
  if (stored) {
    if (stored === "multicolor" || stored.toLowerCase() === "multicolor") {
      return { hex: "multicolor", multicolor: true }
    }
    if (/^#[0-9a-f]{3,8}$/i.test(stored) || /^hsl\(/i.test(stored)) {
      return { hex: stored }
    }
  }

  const fromName = lookupAlias(normalizeColorKey(colorName))
  if (fromName) return fromName

  return { hex: stableHashColorHex(colorName) }
}

/** Legacy helper — hex string for DB defaults and imports. */
export function catalogHexForColorName(name: string): string {
  return resolveColorSwatchMeta(name).hex
}
