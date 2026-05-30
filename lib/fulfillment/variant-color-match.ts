/** Normalize color names for Affisell ↔ AliExpress matching. */
export function normalizeVariantColorKey(value: string | null | undefined): string {
  if (!value?.trim()) return ""
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
}

const COLOR_ALIASES: Record<string, string> = {
  vert: "green",
  verte: "green",
  noir: "black",
  noire: "black",
  bleu: "blue",
  bleue: "blue",
  rouge: "red",
  orange: "orange",
  jaune: "yellow",
  blanc: "white",
  blanche: "white",
  gris: "gray",
  grey: "gray",
  rose: "pink",
  violet: "purple",
  marron: "brown",
}

export function canonicalVariantColorKey(value: string | null | undefined): string {
  const n = normalizeVariantColorKey(value)
  if (!n) return ""
  return COLOR_ALIASES[n] ?? n
}

export function variantColorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = canonicalVariantColorKey(a)
  const cb = canonicalVariantColorKey(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  return ca.includes(cb) || cb.includes(ca)
}
