import { listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { resolvePublicAppUrl, rewriteLocalhostToPublic } from "@/lib/public-app-url"

function resolveAppUrl(): string {
  return resolvePublicAppUrl()
}

/** Hosted fallback — email clients often block via.placeholder.com. */
export function emailProductImageFallbackUrl(): string {
  return `${resolveAppUrl()}/placeholder-product.jpg`
}

/** Normalize product image URLs for transactional email `<img src>` (absolute HTTPS). */
export function toAbsoluteHttpsEmailImageUrl(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : ""
  if (!trimmed || trimmed.startsWith("data:")) return null

  let url = trimmed
  if (url.startsWith("//")) url = `https:${url}`
  else if (url.startsWith("/")) url = `${resolveAppUrl()}${url}`
  else if (!/^https?:\/\//i.test(url)) {
    url = `${resolveAppUrl()}/${url.replace(/^\.\//, "")}`
  }

  if (/^http:\/\//i.test(url)) url = url.replace(/^http:\/\//i, "https://")
  if (!/^https:\/\//i.test(url)) return null

  try {
    return rewriteLocalhostToPublic(new URL(url).href)
  } catch {
    return null
  }
}

/** Pick the best buyer-facing product thumbnail for order confirmation emails. */
export function resolveOrderConfirmationImageUrl(args: {
  productImages?: string[] | null
  customImages?: string[] | null
  variantImageUrl?: string | null
}): string {
  const candidates: Array<string | null | undefined> = [
    args.variantImageUrl,
    listingPrimaryImageUrl(args.customImages, args.productImages),
    ...(args.customImages ?? []),
    ...(args.productImages ?? []),
  ]

  for (const candidate of candidates) {
    const absolute = toAbsoluteHttpsEmailImageUrl(candidate)
    if (absolute) return absolute
  }

  return emailProductImageFallbackUrl()
}
