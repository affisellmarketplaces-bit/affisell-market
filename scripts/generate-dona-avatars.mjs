#!/usr/bin/env node
/**
 * Generates optimized Captain Dona avatar assets in public/.
 * Portrait crops keep the Affisell badge in frame — not face-only circles.
 * Idempotent — safe to re-run when the source portrait changes.
 */
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const publicDir = path.join(root, "public")

/** Top-weighted extract — includes headwrap, face, and CAPTAIN DONA badge. */
const PORTRAIT_HEIGHT_RATIO = 820 / 1024

const SOURCE_CANDIDATES = [
  path.join(root, "assets/dona-avatar-source.jpg"),
  path.join(
    root,
    "../.cursor/projects/Users-nelson-affisell-market/assets/Dona_Affisell-e1c45420-ca0e-4286-9b71-22aabeb92b3c.jpg"
  ),
]

function resolveSource() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function circleMask(size) {
  const r = size / 2
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`
  )
}

async function portraitExtract(input) {
  const meta = await sharp(input).rotate().metadata()
  const srcW = meta.width ?? 468
  const srcH = meta.height ?? 1024
  const cropH = Math.min(Math.round(srcH * PORTRAIT_HEIGHT_RATIO), srcH)
  return { srcW, cropH }
}

async function portraitBuffer(input) {
  const { srcW, cropH } = await portraitExtract(input)
  return sharp(input)
    .rotate()
    .extract({ left: 0, top: 0, width: srcW, height: cropH })
    .png()
    .toBuffer()
}

async function writePortraitWebp(input, outWidth, dest) {
  const { srcW, cropH } = await portraitExtract(input)
  const outHeight = Math.round(outWidth * (cropH / srcW))
  await sharp(await portraitBuffer(input))
    .resize(outWidth, outHeight, { fit: "fill" })
    .webp({ quality: 88, effort: 4 })
    .toFile(dest)
}

async function writeSquareWebp(input, size, dest) {
  const { srcW, cropH } = await portraitExtract(input)
  await sharp(await portraitBuffer(input))
    .resize(size, size, { fit: "cover", position: "top" })
    .webp({ quality: 86, effort: 4 })
    .toFile(dest)
}

async function writeCircleWebp(input, size, dest) {
  const { srcW, cropH } = await portraitExtract(input)
  const resized = await sharp(await portraitBuffer(input))
    .resize(size, size, { fit: "cover", position: "top" })
    .ensureAlpha()
    .png()
    .toBuffer()

  await sharp(resized)
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .webp({ quality: 88, effort: 4 })
    .toFile(dest)
}

async function writePlaceholder(dest, size, label) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C3AED"/><stop offset="100%" stop-color="#4C1D95"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    <text x="50%" y="54%" text-anchor="middle" font-size="${Math.round(size * 0.28)}" fill="white">${label}</text>
  </svg>`
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(dest)
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  const source = resolveSource()

  if (!source) {
    console.warn("[dona-avatar] source missing — writing purple placeholders")
    for (const [name, size] of [
      ["dona-avatar.webp", 256],
      ["dona-avatar@2x.webp", 512],
      ["dona-avatar-hd.webp", 1024],
      ["dona-avatar-portrait.webp", 240],
      ["dona-avatar-portrait@2x.webp", 480],
      ["dona-avatar-circle.webp", 256],
      ["dona-avatar-circle@2x.webp", 512],
    ]) {
      await writePlaceholder(path.join(publicDir, name), size, "D")
    }
    return
  }

  console.log("[dona-avatar]", { source, result: "generating", portraitHeightRatio: PORTRAIT_HEIGHT_RATIO })

  await Promise.all([
    writePortraitWebp(source, 240, path.join(publicDir, "dona-avatar-portrait.webp")),
    writePortraitWebp(source, 480, path.join(publicDir, "dona-avatar-portrait@2x.webp")),
    writeSquareWebp(source, 256, path.join(publicDir, "dona-avatar.webp")),
    writeSquareWebp(source, 512, path.join(publicDir, "dona-avatar@2x.webp")),
    writeSquareWebp(source, 1024, path.join(publicDir, "dona-avatar-hd.webp")),
    writeCircleWebp(source, 256, path.join(publicDir, "dona-avatar-circle.webp")),
    writeCircleWebp(source, 512, path.join(publicDir, "dona-avatar-circle@2x.webp")),
  ])

  console.log("[dona-avatar]", { result: "ok" })
}

main().catch((err) => {
  console.error("[dona-avatar]", err)
  process.exit(1)
})
