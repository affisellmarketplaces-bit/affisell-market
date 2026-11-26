/**
 * « Cette taille est épuisée — disponible dans cette boutique : … » (buyer side of portfolio idea I, 2026-11-20).
 * Pure, client-safe types and the mode switch.
 *
 * On a reseller's shop page, when the ONE exact variant the buyer chose is sold out, the buyer may be shown up to three
 * products ALREADY live in that same shop that really offer that same variant in stock, found with the replacement
 * engine's own equivalence (same valid GTIN, or same category + close name + options — never the category alone).
 * Nothing is replaced, added or reserved; the buyer opens a product page or not. Only what the shop already shows
 * publicly is returned: name, photo, match kind and the listing to open — never a price split, net, supplier price,
 * commission or stock figure.
 */

export type ShopAlternativesMode = "off" | "on"

/** `SHOP_VARIANT_ALTERNATIVES_MODE` = `off` (DEFAULT: nothing shown, nothing read) | `on` (founder decision). */
export function readShopAlternativesMode(raw: string | undefined | null = process.env.SHOP_VARIANT_ALTERNATIVES_MODE): ShopAlternativesMode {
  return String(raw ?? "").trim().toLowerCase() === "on" ? "on" : "off"
}

export type ShopVariantAlternative = {
  listingId: string
  name: string
  imageUrl: string | null
  match: "identique" | "similaire"
}

export type ShopVariantAlternatives =
  | { mode: "off" }
  | { mode: "on"; status: "not_sold_out" | "variant_unresolved" | "none" }
  | { mode: "on"; status: "found"; variantLabel: string; items: ShopVariantAlternative[] }
