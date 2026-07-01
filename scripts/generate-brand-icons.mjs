#!/usr/bin/env node
/**
 * Generates favicon + PWA icons from public/brand/affisell-mark.svg
 * Run: npm run brand:icons
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const MARK_SVG = path.join(root, "public/brand/affisell-mark.svg")
const MASKABLE_SVG = path.join(root, "public/brand/affisell-mark-maskable.svg")
const ICONS_DIR = path.join(root, "public/icons")

const OUTPUTS = [
  { input: MARK_SVG, out: path.join(root, "app/icon.png"), size: 96 },
  { input: MARK_SVG, out: path.join(root, "app/apple-icon.png"), size: 180 },
  { input: MARK_SVG, out: path.join(ICONS_DIR, "icon-192.png"), size: 192 },
  { input: MARK_SVG, out: path.join(ICONS_DIR, "icon-512.png"), size: 512 },
  { input: MASKABLE_SVG, out: path.join(ICONS_DIR, "icon-maskable-512.png"), size: 512 },
  { input: MARK_SVG, out: path.join(ICONS_DIR, "favicon-32.png"), size: 32 },
]

async function writePng(input, out, size) {
  const svg = await fs.readFile(input)
  await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log(`[brand:icons] ${path.relative(root, out)} (${size}×${size})`)
}

const SPLASH_DIR = path.join(root, "public/splash")
const SPLASH_SIZES = [
  { w: 1170, h: 2532, name: "apple-splash-1170-2532.png" },
  { w: 1284, h: 2778, name: "apple-splash-1284-2778.png" },
  { w: 750, h: 1334, name: "apple-splash-750-1334.png" },
]

async function writeSplash(out, width, height) {
  const logoSize = Math.round(Math.min(width, height) * 0.26)
  const logo = await sharp(await fs.readFile(MARK_SVG)).resize(logoSize, logoSize).png().toBuffer()
  const bgSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#09090b"/><radialGradient id="g" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.35"/><stop offset="1" stop-color="#09090b" stop-opacity="0"/></radialGradient><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )
  await sharp(bgSvg).composite([{ input: logo, gravity: "center" }]).png({ compressionLevel: 9 }).toFile(out)
  console.log(`[brand:icons] ${path.relative(root, out)} (${width}×${height})`)
}

async function main() {
  await fs.mkdir(ICONS_DIR, { recursive: true })
  await fs.mkdir(SPLASH_DIR, { recursive: true })

  for (const { input, out, size } of OUTPUTS) {
    await writePng(input, out, size)
  }

  for (const { w, h, name } of SPLASH_SIZES) {
    await writeSplash(path.join(SPLASH_DIR, name), w, h)
  }

  await fs.copyFile(MARK_SVG, path.join(root, "app/icon.svg"))
  await fs.copyFile(path.join(ICONS_DIR, "favicon-32.png"), path.join(root, "public/favicon-32.png"))

  const legacyIco = path.join(root, "app/favicon.ico")
  try {
    await fs.unlink(legacyIco)
    console.log("[brand:icons] removed legacy app/favicon.ico (Next.js default)")
  } catch {
    /* already absent */
  }

  console.log("[brand:icons] done")
}

main().catch((err) => {
  console.error("[brand:icons] failed:", err)
  process.exit(1)
})
