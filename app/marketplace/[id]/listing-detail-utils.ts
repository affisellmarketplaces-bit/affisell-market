import { formatStoreCurrency } from "@/lib/market-config"
import { stripDescriptionImageMarkers } from "@/lib/description-rich-content"
import { shopperVisibleTags } from "@/lib/product-shopper-tags"

export const EMPTY_SIZE_OPTIONS: string[] = []

export function fmtMoney(value: number) {
  return formatStoreCurrency(value)
}

export function t(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  )
}

/** One short honest snippet from the listing—not generic placeholder copy. */
export function listingAtAGlance(description: string, name: string, tags: string[]): string | null {
  const d = stripDescriptionImageMarkers(description).replace(/\s+/g, " ").trim()
  if (d.length >= 28) {
    const max = 220
    if (d.length <= max) return d
    const slice = d.slice(0, max)
    const last = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "))
    const cut = last > 80 ? slice.slice(0, last + 1) : slice
    return `${cut.trim()}…`
  }
  const visibleTags = shopperVisibleTags(tags)
  if (visibleTags.length > 0) return visibleTags.slice(0, 5).join(" · ")
  return null
}

/** Split long marketplace titles into a scannable headline + supporting line. */
export { splitListingTitle } from "@/lib/listing-title"
