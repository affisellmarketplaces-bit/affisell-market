type ApparelInput = {
  categoryFullPath?: string | null
  legacyCategories?: string[]
}

const APPAREL_PATTERN =
  /\b(apparel|clothing|clothes|fashion|vêtements?|vetements?|wear|textile|garment|dress|shirt|t-?shirt|jacket|coat|pants|jeans|skirt|hoodie|sweater|blouse|underwear|lingerie|socks?|hosiery|collants?|leggings?|tenues?|pantalon|yoga|fitness|cyclisme)\b/i

/** Rejects non-apparel products at API layer (Zod + business guard). */
export function isApparelProduct(input: ApparelInput): boolean {
  const parts: string[] = []
  if (input.categoryFullPath?.trim()) parts.push(input.categoryFullPath.trim())
  for (const c of input.legacyCategories ?? []) {
    if (typeof c === "string" && c.trim()) parts.push(c.trim())
  }
  if (parts.length === 0) return false
  return APPAREL_PATTERN.test(parts.join(" "))
}
