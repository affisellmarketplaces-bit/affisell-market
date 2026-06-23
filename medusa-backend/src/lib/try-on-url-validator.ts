/** Whitelisted HTTPS hosts for flat-lay garment images. */
const GARMENT_URL_HOSTS = [
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
  "res.cloudinary.com",
] as const

export function isAllowedTryOnGarmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return false
    const host = parsed.hostname.toLowerCase()
    return GARMENT_URL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export function isTryOnImageExtension(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? ""
  return path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".webp")
}

export function validateTryOnGarmentUrl(url: string | null | undefined): string | null {
  if (url == null || url === "") return null
  const trimmed = url.trim()
  if (!isAllowedTryOnGarmentUrl(trimmed)) {
    throw new Error("garment URL must be HTTPS on Vercel Blob or Cloudinary")
  }
  if (!isTryOnImageExtension(trimmed)) {
    throw new Error("garment URL must be PNG, JPG, or WebP")
  }
  return trimmed
}
