/** First non-empty product image URL (ordered list from supplier). */
export function primaryProductImage(images: string[] | null | undefined): string {
  const u = images?.find((s) => typeof s === "string" && s.trim())
  return u?.trim() ?? ""
}

/** HTTPS image URLs for Stripe (max 8 per Stripe line item). */
export function stripeProductImages(images: string[] | null | undefined): string[] | undefined {
  const urls =
    images
      ?.map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
      .slice(0, 8) ?? []
  return urls.length ? urls : undefined
}
