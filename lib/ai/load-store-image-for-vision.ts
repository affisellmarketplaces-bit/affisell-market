import { readFile } from "node:fs/promises"
import path from "node:path"

const MAX_BYTES = 4 * 1024 * 1024

/**
 * Load an image from our `/uploads/…` path or an HTTPS URL into a data URL for Groq vision.
 */
export async function loadImageAsDataUrlForVision(imageRef: string): Promise<{ dataUrl: string } | { error: string }> {
  const trimmed = imageRef.trim()
  if (!trimmed) return { error: "Empty image reference" }

  if (trimmed.startsWith("/uploads/")) {
    const base = path.basename(trimmed)
    if (!base || base !== trimmed.replace(/^\/uploads\//, "") || !/^[\w.-]+$/.test(base)) {
      return { error: "Invalid uploads path" }
    }
    const fp = path.join(process.cwd(), "public", "uploads", base)
    const buf = await readFile(fp)
    if (buf.length > MAX_BYTES) return { error: "Image is too large (max 4 MB)" }
    const mime = base.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}` }
  }

  if (trimmed.startsWith("https://")) {
    const r = await fetch(trimmed, { redirect: "follow" })
    if (!r.ok) return { error: "Could not download image" }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_BYTES) return { error: "Image is too large (max 4 MB)" }
    const ct = r.headers.get("content-type") || "image/jpeg"
    const mime = ct.startsWith("image/") ? ct.split(";")[0].trim() : "image/jpeg"
    if (!mime.startsWith("image/")) return { error: "URL did not return an image" }
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}` }
  }

  return { error: "Use an HTTPS image URL or an uploaded file under /uploads/" }
}

export function fileToDataUrl(buf: Buffer, mime: string): string {
  const m = mime.startsWith("image/") ? mime.split(";")[0].trim() : "image/jpeg"
  return `data:${m};base64,${buf.toString("base64")}`
}
