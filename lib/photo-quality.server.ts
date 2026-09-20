import "server-only"

import sharp from "sharp"

import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url"
import type { PhotoMetrics } from "@/lib/photo-quality"

const MAX_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3

export type MeasureResult = { ok: true; metrics: PhotoMetrics } | { ok: false; reason: "blocked" | "fetch" | "too_large" | "not_image" }

/** SSRF-safe download: HTTPS only, no private hosts, every redirect hop re-validated, size and time capped. */
async function download(rawUrl: string): Promise<Buffer | { error: "blocked" | "fetch" | "too_large" }> {
  let current = rawUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const safe = assertSafeOutboundUrl(current)
    if (!safe.ok) return { error: "blocked" }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(safe.url, { redirect: "manual", signal: controller.signal, headers: { accept: "image/*", "user-agent": "AffisellPhotoCheck/1.0 (+https://affisell.com)" } })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc) return { error: "fetch" }
        current = new URL(loc, safe.url).toString()
        continue
      }
      if (!res.ok) return { error: "fetch" }
      const declared = Number(res.headers.get("content-length") ?? 0)
      if (declared > MAX_BYTES) return { error: "too_large" }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > MAX_BYTES) return { error: "too_large" }
      return buf
    } catch {
      return { error: "fetch" }
    } finally {
      clearTimeout(timer)
    }
  }
  return { error: "fetch" }
}

function fromDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim())
  if (!m) return null
  const buf = Buffer.from(m[1]!.replace(/\s+/g, ""), "base64")
  return buf.length > 0 && buf.length <= MAX_BYTES ? buf : null
}

/** 64-bit difference hash: 9×8 greyscale, each bit = pixel brighter than its right neighbour. */
async function dHashOf(img: sharp.Sharp): Promise<string> {
  const px = await img.clone().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer()
  let bits = ""
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x]! > px[y * 9 + x + 1]! ? "1" : "0"
  let hex = ""
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

async function cornerLumaOf(img: sharp.Sharp): Promise<PhotoMetrics["cornerLuma"]> {
  // 16×16 greyscale on white (transparent PNGs are judged as they will appear on the storefront).
  const N = 16
  const px = await img.clone().flatten({ background: "#ffffff" }).greyscale().resize(N, N, { fit: "fill" }).raw().toBuffer()
  const block = (x0: number, y0: number) => {
    let s = 0
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) s += px[y * N + x]!
    return Math.round(s / 9)
  }
  return [block(0, 0), block(N - 3, 0), block(0, N - 3), block(N - 3, N - 3)]
}

export async function measureImageBuffer(buf: Buffer): Promise<MeasureResult> {
  try {
    const img = sharp(buf, { failOn: "none", limitInputPixels: 80_000_000 })
    const meta = await img.metadata()
    if (!meta.width || !meta.height) return { ok: false, reason: "not_image" }
    const [dHash, cornerLuma] = await Promise.all([dHashOf(img), cornerLumaOf(img)])
    return {
      ok: true,
      metrics: { width: meta.width, height: meta.height, bytes: buf.length, format: meta.format ?? "unknown", cornerLuma, dHash },
    }
  } catch {
    return { ok: false, reason: "not_image" }
  }
}

/** Measure one product photo given as an https URL or a base64 data URL. Never throws. */
export async function measurePhoto(ref: string): Promise<MeasureResult> {
  const trimmed = ref.trim()
  if (trimmed.startsWith("data:")) {
    const buf = fromDataUrl(trimmed)
    return buf ? measureImageBuffer(buf) : { ok: false, reason: "not_image" }
  }
  const got = await download(trimmed)
  if (!Buffer.isBuffer(got)) return { ok: false, reason: got.error }
  return measureImageBuffer(got)
}
