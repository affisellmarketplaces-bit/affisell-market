export type IdmVtonCategory = "upper_body" | "lower_body" | "dresses"

/** Maps apparel taxonomy → IDM-VTON `category` input. */
export function inferIdmVtonCategory(input: {
  productName?: string | null
  legacyCategories?: string[]
  categoryFullPath?: string | null
}): IdmVtonCategory {
  const parts: string[] = []
  if (input.productName?.trim()) parts.push(input.productName.trim())
  if (input.categoryFullPath?.trim()) parts.push(input.categoryFullPath.trim())
  for (const c of input.legacyCategories ?? []) {
    if (typeof c === "string" && c.trim()) parts.push(c.trim())
  }
  const text = parts.join(" ").toLowerCase()
  if (/\b(dress|robe|gown)\b/i.test(text)) return "dresses"
  if (
    /\b(pant|jean|legging|short|skirt|bottom|jogger|collant|cyclisme|yoga|trouser)\b/i.test(text)
  ) {
    return "lower_body"
  }
  return "upper_body"
}
