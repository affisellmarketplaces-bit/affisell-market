/**
 * Heuristic column mapping for future CSV / bridge imports (no network).
 * Innovation hook: same labels can feed an LLM later for smarter mapping.
 */
export function hintImportFieldMap(headers: string[]): Record<string, string | null> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()

  const scores: Record<string, string | null> = {
    title: null,
    description: null,
    price: null,
    sku: null,
    stock: null,
    images: null,
    category: null,
  }

  const rules: Array<{ field: keyof typeof scores; patterns: RegExp[] }> = [
    { field: "title", patterns: [/title|name|nom|titre|product/i] },
    { field: "description", patterns: [/desc|detail|body|texte/i] },
    { field: "price", patterns: [/price|prix|cost|eur|usd|amount/i] },
    { field: "sku", patterns: [/sku|ref|reference|article|code/i] },
    { field: "stock", patterns: [/stock|qty|quantity|inventory/i] },
    { field: "images", patterns: [/image|photo|url|img/i] },
    { field: "category", patterns: [/categor|type|collection/i] },
  ]

  for (const h of headers) {
    if (typeof h !== "string" || !h.trim()) continue
    const n = norm(h)
    if (!n) continue
    for (const { field, patterns } of rules) {
      if (scores[field]) continue
      if (patterns.some((re) => re.test(n))) scores[field] = h.trim()
    }
  }

  return scores
}
