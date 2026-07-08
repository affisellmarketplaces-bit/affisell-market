import { isUsableProductImageUrl } from "@/lib/product-image-url"

/** First product image URL safe to render publicly on cards and PDPs. */
export function primaryProductImage(images: string[] | null | undefined): string {
  const u = images?.find((s): s is string => typeof s === "string" && isUsableProductImageUrl(s))
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
