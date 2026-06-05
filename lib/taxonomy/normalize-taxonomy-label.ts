/** Normalize FR category labels for fuzzy lookup (eBay ↔ Google). */
export function normalizeTaxonomyLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}
