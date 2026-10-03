/** Platform brand word swapped for a reseller's store name in buyer-facing copy (pure, client-safe). */
const PLATFORM_WORD_RE = /\bAffisell\b/g

/** Replaces every whole-word "Affisell" with `brandName`; returns the text untouched without a brand. */
export function replaceAffisellBrand(text: string, brandName: string | null | undefined): string {
  const name = brandName?.trim()
  if (!name) return text
  // Function replacer: a store name containing `$&` or `$1` must be inserted literally.
  return text.replace(PLATFORM_WORD_RE, () => name)
}
