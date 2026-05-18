import { randomBytes } from "crypto"

import { isR2Configured, uploadBufferToR2 } from "@/lib/r2"

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
  Accept: "video/*,*/*;q=0.8",
}

const MAX_BYTES = 80 * 1024 * 1024

function contentTypeFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes(".webm")) return "video/webm"
  if (lower.includes(".m3u8")) return "application/vnd.apple.mpegurl"
  return "video/mp4"
}

function contentTypeFromResponse(res: Response, fallbackUrl: string): string {
  const raw = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  if (raw && raw.startsWith("video/")) return raw
  if (raw === "application/octet-stream") return contentTypeFromUrl(fallbackUrl)
  return contentTypeFromUrl(fallbackUrl)
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("webm")) return "webm"
  if (contentType.includes("mpegurl") || contentType.includes("m3u8")) return "m3u8"
  return "mp4"
}

async function fetchVideoBuffer(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(sourceUrl, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(90_000),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`Video fetch failed (${res.status})`)
  }

  const contentType = contentTypeFromResponse(res, sourceUrl)
  if (contentType.includes("mpegurl")) {
    throw new Error("HLS streams (.m3u8) cannot be mirrored to R2")
  }

  const length = res.headers.get("content-length")
  if (length && Number(length) > MAX_BYTES) {
    throw new Error("Video file too large for import mirror")
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error("Empty video response")
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("Video file too large for import mirror")
  }

  return { buffer, contentType }
}

/**
 * Mirror scraped product video URLs to R2. Returns R2 public URLs when upload succeeds,
 * otherwise keeps the original external URL (fallback).
 */
export async function mirrorImportedVideosToR2(
  sourceUrls: string[],
  max = 2
): Promise<string[]> {
  if (!sourceUrls.length) return []

  const out: string[] = []
  const slice = sourceUrls.filter((u) => /^https?:\/\//i.test(u.trim())).slice(0, max)

  if (!isR2Configured()) {
    return slice
  }

  for (const sourceUrl of slice) {
    const trimmed = sourceUrl.trim()
    try {
      const { buffer, contentType } = await fetchVideoBuffer(trimmed)
      const ext = extensionForContentType(contentType)
      const key = `imported/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`
      const publicUrl = await uploadBufferToR2(buffer, key, contentType)
      out.push(publicUrl)
    } catch (e) {
      console.warn("[import-video-r2] keep external URL", trimmed, e)
      out.push(trimmed)
    }
  }

  return out
}
