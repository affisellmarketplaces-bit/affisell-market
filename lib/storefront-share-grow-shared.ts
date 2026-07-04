/** Share & grow helpers — client-safe (no Prisma). */

export function buildStorefrontWhatsAppShareUrl(shopUrl: string, message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message}\n${shopUrl}`)}`
}

export function buildStorefrontTwitterShareUrl(shopUrl: string, message: string): string {
  const params = new URLSearchParams({
    text: message,
    url: shopUrl,
  })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function buildStorefrontFacebookShareUrl(shopUrl: string): string {
  const params = new URLSearchParams({ u: shopUrl })
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`
}

export function canUseNativeWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function"
}
