import "server-only"

const MAX_VISION_BYTES = 5 * 1024 * 1024

export type ResolvedVisionImage = {
  visionUrl: string
  source: "inline_data" | "cdn_url" | "cdn_fetched"
}

function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes(".png")) return "image/png"
  if (lower.includes(".webp")) return "image/webp"
  if (lower.includes(".avif")) return "image/avif"
  if (lower.includes(".gif")) return "image/gif"
  return "image/jpeg"
}

/**
 * OpenAI vision is more reliable with inline base64 than hotlinked CDN URLs
 * (R2 custom domains, bot blocking, AVIF edge cases).
 */
export async function resolveVisionImageForOpenAI(input: {
  imageUrl?: string
  imageDataUrl?: string
}): Promise<ResolvedVisionImage> {
  const inline = input.imageDataUrl?.trim() || ""
  if (inline.startsWith("data:image/")) {
    return { visionUrl: inline, source: "inline_data" }
  }

  const url = input.imageUrl?.trim() || ""
  if (url.startsWith("data:image/")) {
    return { visionUrl: url, source: "inline_data" }
  }

  if (!url) {
    throw new Error("image_required")
  }

  if (!/^https:\/\//i.test(url)) {
    throw new Error("image_not_https")
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "image/*" },
      cache: "no-store",
    })
    if (!res.ok) {
      console.log("[vision-image-url]", {
        result: "fetch_failed",
        status: res.status,
        url: url.slice(0, 100),
      })
      return { visionUrl: url, source: "cdn_url" }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_VISION_BYTES) {
      console.log("[vision-image-url]", {
        result: "fetch_size_invalid",
        bytes: buf.length,
        url: url.slice(0, 100),
      })
      return { visionUrl: url, source: "cdn_url" }
    }

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim()
    const mime =
      contentType && contentType.startsWith("image/") ? contentType : mimeFromUrl(url)

    return {
      visionUrl: `data:${mime};base64,${buf.toString("base64")}`,
      source: "cdn_fetched",
    }
  } catch (err) {
    console.log("[vision-image-url]", {
      result: "fetch_error",
      error: err instanceof Error ? err.message : String(err),
      url: url.slice(0, 100),
    })
    return { visionUrl: url, source: "cdn_url" }
  }
}
