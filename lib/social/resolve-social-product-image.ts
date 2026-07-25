import "server-only"

import { resolvePublicAppUrl } from "@/lib/public-app-url"
import { isLocalhostHost } from "@/lib/localhost-host"

/** Bump when PNG layout changes — invalidates on-disk social caches. */
export const SOCIAL_ASSET_TEMPLATE_VERSION = "v2-photo"

function appOrigin(): string {
  const origin = resolvePublicAppUrl().replace(/\/$/, "")
  try {
    const u = new URL(origin)
    if (isLocalhostHost(u.hostname)) {
      u.protocol = "http:"
      return u.origin
    }
    return u.origin
  } catch {
    return origin.startsWith("http") ? origin : `http://${origin}`
  }
}

function toAbsoluteImageUrl(raw: string): string {
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw
  }
  if (raw.startsWith("//")) return `https:${raw}`
  const path = raw.startsWith("/") ? raw : `/${raw}`
  return `${appOrigin()}${path}`
}

/**
 * Resolve product photo for Satori/ImageResponse.
 * Prefers embedded data URL (reliable remote hosts); falls back to absolute URL.
 */
export async function resolveSocialProductImageSrc(
  imageUrl: string | null | undefined,
  productId: string
): Promise<string | null> {
  const raw = imageUrl?.trim()
  if (!raw) {
    console.warn("[VIRAL_TEMPLATE_MISSING_IMAGE]", { productId })
    return null
  }

  if (raw.startsWith("data:")) return raw

  const absolute = toAbsoluteImageUrl(raw)

  try {
    const res = await fetch(absolute, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/*" },
    })
    if (!res.ok) {
      console.warn("[VIRAL_TEMPLATE_IMAGE_FETCH]", {
        productId,
        status: res.status,
        url: absolute.slice(0, 120),
      })
      return absolute
    }
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim()
    if (!contentType.startsWith("image/")) {
      console.warn("[VIRAL_TEMPLATE_IMAGE_FETCH]", {
        productId,
        contentType,
        url: absolute.slice(0, 120),
      })
      return absolute
    }
    const buf = Buffer.from(await res.arrayBuffer())
    // Cap ~4MB for ImageResponse memory — oversized still usable via URL.
    if (buf.byteLength > 4_000_000) {
      console.log("[social-product-image]", {
        productId,
        event: "large_image_use_url",
        bytes: buf.byteLength,
      })
      return absolute
    }
    const b64 = buf.toString("base64")
    console.log("[social-product-image]", {
      productId,
      event: "embedded",
      bytes: buf.byteLength,
      contentType,
    })
    return `data:${contentType};base64,${b64}`
  } catch (err) {
    console.warn("[VIRAL_TEMPLATE_IMAGE_FETCH]", {
      productId,
      error: err instanceof Error ? err.message : "fetch_failed",
      url: absolute.slice(0, 120),
    })
    return absolute
  }
}
