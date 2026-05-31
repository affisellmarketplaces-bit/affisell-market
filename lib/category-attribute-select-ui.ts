import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"

export const GENERIC_BRAND_LABEL = "Générique"

const BRAND_KEY_RE = /^(brand|marque|brand_name)$/i

function normType(t: string | undefined): string {
  return (t ?? "TEXT").toUpperCase().replace(/\s+/g, "_")
}

export function isBrandCategoryAttribute(
  attr: Pick<CategoryAttrRow, "key" | "label">
): boolean {
  const k = attr.key.trim()
  const l = attr.label.toLowerCase()
  return BRAND_KEY_RE.test(k) || l.includes("marque") || l.includes("brand name")
}

/** SELECT taxonomy fields where suppliers may type any value (suggestions only). */
export function categorySelectAllowsFreeText(
  attr: Pick<CategoryAttrRow, "type" | "options">
): boolean {
  return normType(attr.type) === "SELECT" && attr.options.length > 0
}

export function datalistIdForAttribute(attrId: string): string {
  return `aff-attr-dl-${attrId.replace(/[^a-zA-Z0-9_-]/g, "")}`
}

/** Suggestion list for datalist (deduped, Générique first for brand). */
export function buildCategorySelectSuggestions(attr: CategoryAttrRow): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  const push = (value: string) => {
    const t = value.trim()
    if (!t) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }

  if (isBrandCategoryAttribute(attr)) {
    push(GENERIC_BRAND_LABEL)
    push("Generic")
  }

  for (const opt of attr.options) push(opt)
  return out
}

export function freeTextSelectPlaceholder(attr: CategoryAttrRow): string {
  if (isBrandCategoryAttribute(attr)) {
    return "Ex. Générique, marque maison, Dell…"
  }
  if (/ram|mémoire|memory/i.test(`${attr.key} ${attr.label}`)) {
    return "Ex. 8, 16, 32…"
  }
  if (/stockage|storage|capacity|capacité/i.test(`${attr.key} ${attr.label}`)) {
    return "Ex. 256, 512, 1 To…"
  }
  return "Saisie libre ou choisir une suggestion"
}
