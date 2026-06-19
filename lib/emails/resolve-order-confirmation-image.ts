import { listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { appBaseUrl } from "@/lib/app-base-url"

function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    appBaseUrl()
  return raw.replace(/\/$/, "")
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
    return new URL(url).href
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
