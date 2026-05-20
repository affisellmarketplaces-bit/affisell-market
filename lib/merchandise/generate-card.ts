import fs from "fs/promises"
import path from "path"

import sharp from "sharp"

import type { MerchCategoryTemplate } from "@/lib/merchandise/templates"

export type MerchCardProduct = {
  id: string
  images: string[]
}

function absoluteImageUrl(url: string): string {
  const u = url.trim()
  if (u.startsWith("http://") || u.startsWith("https://")) return u
  const vercel = process.env.VERCEL_URL
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (vercel ? `https://${vercel}` : "http://localhost:3001")
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

async function subjectBufferFromImageUrl(firstUrl: string): Promise<Buffer> {
  const res = await fetch(firstUrl)
  if (!res.ok) {
    return sharp({
      create: { width: 160, height: 160, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer()
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return sharp(buf).png().toBuffer()
}

function cachePathForProduct(productId: string) {
  return path.join(process.cwd(), "public", "generated", "categories", `${productId}.png`)
}

/**
 * Builds a 400×400 merchandising tile: template background + decorative SVG + cut-out product + label.
 * Caches PNG under `public/generated/categories/{product.id}.png` when the filesystem is writable.
 */
export async function generateCategoryCard(
  product: MerchCardProduct,
  subcategory: string,
  template: MerchCategoryTemplate
): Promise<Buffer> {
  const outFile = cachePathForProduct(product.id)
  try {
    const existing = await fs.readFile(outFile)
    if (existing.length > 0) return existing
  } catch {
    /* generate */
  }

  const shapeFile = path.join(process.cwd(), "public", "shapes", `${template.shape}.svg`)
  const shapeLayer = await sharp(shapeFile).resize(400, 400).png().toBuffer()

  const rawUrl = product.images[0]?.trim()
  const firstUrl = rawUrl ? absoluteImageUrl(rawUrl) : ""
  let subject: Buffer

  if (!firstUrl) {
    subject = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.35 },
      },
    })
      .png()
      .toBuffer()
  } else {
    /** Sharp-only on serverless (imgly-node models exceed Vercel 250MB function limit). */
    subject = await subjectBufferFromImageUrl(firstUrl)
  }

  const maxW = 240
  const maxH = 260
  subject = await sharp(subject)
    .resize(maxW, maxH, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()

  const meta = await sharp(subject).metadata()
  const sw = meta.width ?? 200

  const shadow = await sharp(subject).blur(12).modulate({ brightness: 0.35, saturation: 0.3 }).png().toBuffer()

  const left = Math.max(0, Math.floor((400 - sw) / 2))
  const top = 52
  const shadowLeft = Math.max(0, left + 6)
  const shadowTop = top + 8

  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect x="0" y="328" width="400" height="72" fill="rgba(255,255,255,0.9)"/>
      <text x="200" y="372" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="600" fill="${escapeXml(template.textColor)}">${escapeXml(subcategory)}</text>
    </svg>`
  )

  const base = await sharp({
    create: { width: 400, height: 400, channels: 3, background: template.bg },
  })
    .composite([{ input: shapeLayer, left: 0, top: 0, blend: "over" }])
    .png()
    .toBuffer()

  const png = await sharp(base)
    .composite([
      { input: shadow, left: shadowLeft, top: shadowTop, blend: "over" },
      { input: subject, left: left, top: top, blend: "over" },
      { input: textSvg, left: 0, top: 0, blend: "over" },
    ])
    .png()
    .toBuffer()

  try {
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await fs.writeFile(outFile, png)
  } catch {
    /* e.g. read-only FS on serverless — still return buffer */
  }

  return png
}
