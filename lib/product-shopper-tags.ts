/** Supplier/ops tags that must not appear on buyer-facing PDP or cards. */
const HIDDEN_SHOPPER_TAGS = new Set(["imported", "import", "seed"])

export function isShopperVisibleTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase()
  return normalized.length > 0 && !HIDDEN_SHOPPER_TAGS.has(normalized)
}

export function shopperVisibleTags(tags: string[]): string[] {
  return tags.filter((t) => isShopperVisibleTag(t))
}

/** Category label above the title — never show internal import markers. */
export function shopperCategoryEyebrow(categories: string[], tags: string[]): string | null {
  for (const c of categories) {
    const label = c.trim()
    if (label) return label
  }
  for (const tag of tags) {
    if (isShopperVisibleTag(tag)) return tag.trim()
  }
  return null
}
