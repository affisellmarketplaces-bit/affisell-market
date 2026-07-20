const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "sans",
  "avec",
  "pour",
  "une",
  "des",
  "les",
  "de",
  "du",
  "la",
  "le",
  "et",
  "en",
  "sur",
  "pro",
  "max",
  "mini",
  "new",
  "iphone",
])

/** Extract 1–2 searchable tokens from a winner title (client-safe). */
export function extractMatchTokens(title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
  const preferred = words.filter((w) =>
    /led|strip|shape|magsafe|airfry|gourde|blender|yoga|watch|montre|case|coque|cinta|fita|tumbler|bande/i.test(
      w
    )
  )
  const pool = preferred.length > 0 ? preferred : words
  return [...new Set(pool)].slice(0, 2)
}
