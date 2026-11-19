/**
 * Card « buy » / « add to cart » buttons carry no size / colour. Before they create anything, ask the server whether
 * the listing needs a choice (`GET /api/marketplace/listings/<id>/variant-choice`, shared rule `requiresVariantChoice`)
 * and, when it does, send the shopper to the product page to choose — never pick for them (founder brief 2026-11-19
 * §2). Client-safe, no catalogue import. A failed answer keeps the card's existing behaviour: the checkout's own check
 * (`CHECKOUT_STOCK_MODE`) still applies there.
 */

export function hasVariantChoice(input: { selectedColor?: string | null; selectedSize?: string | null; selectedStorage?: string | null }): boolean {
  return Boolean(input.selectedColor?.trim() || input.selectedSize?.trim() || input.selectedStorage?.trim())
}

export async function listingRequiresVariantChoice(listingId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const id = listingId.trim()
  if (!id) return false
  try {
    const res = await fetchImpl(`/api/marketplace/listings/${encodeURIComponent(id)}/variant-choice`, { credentials: "omit" })
    if (!res.ok) return false
    const data = (await res.json().catch(() => null)) as { requiresChoice?: unknown } | null
    return data?.requiresChoice === true
  } catch {
    return false
  }
}

/** Where the shopper chooses: the product page, flagged so it tells them why they landed there. */
export function variantChoicePageHref(listingId: string, detailHref?: string | null): string {
  const base = detailHref?.trim() || `/marketplace/${encodeURIComponent(listingId.trim())}`
  return `${base}${base.includes("?") ? "&" : "?"}choose=1`
}

/** Query flag the product page reads once to show « choose your size / colour ». */
export const VARIANT_CHOICE_QUERY = "choose"
