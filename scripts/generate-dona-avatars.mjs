#!/usr/bin/env node
/**
 * Generates optimized Captain Dona avatar assets in public/.
 * Portrait crops keep the Affisell badge in frame — studio grey keyed to brand gradient.
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

/** Affisell hero orbital gradient — matches BuyerHeroBlock / brandOrbitHeroShell. */
const AFFISELL_GRADIENT_STOPS = [
  { offset: "0%", color: "#7C3AED" },
  { offset: "42%", color: "#4338CA" },
  { offset: "72%", color: "#312E81" },
  { offset: "100%", color: "#1E3A8A" },
]

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

function affisellGradientSvg(width, height) {
  const stops = AFFISELL_GRADIENT_STOPS.map(
    (s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`
  ).join("")
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="aff" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>
      <radialGradient id="glow" cx="50%" cy="18%" r="75%">
        <stop offset="0%" stop-color="#C4B5FD" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#1E1B4B" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#aff)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
  </svg>`
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

function sampleBackgroundColor(data, width, height) {
  const samples = []
  const push = (x, y) => {
    const i = (y * width + x) * 4
    samples.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0])
  }
  const stepX = Math.max(1, Math.floor(width / 24))
  const stepY = Math.max(1, Math.floor(height / 24))
  for (let x = 0; x < width; x += stepX) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += stepY) {
    push(0, y)
    push(width - 1, y)
  }
  const n = samples.length
  return samples.reduce((acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]], [0, 0, 0]).map(
    (v) => v / n
  )
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Neutral grey studio backdrop — tolerant of mottled lighting. */
function isStudioBackdrop(r, g, b, bg) {
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max - min
  const spread = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
  const lumDist = Math.abs(luminance(r, g, b) - luminance(bg[0], bg[1], bg[2]))

  if (saturation > 78 || spread > 62) return false
  if (dist < 92) return true
  if (saturation < 42 && lumDist < 68) return true
  return saturation < 28 && lumDist < 82
}

/** Flood-fill backdrop from image edges, then feather hair/contact edges. */
function keyNeutralStudioBackground(data, width, height) {
  const out = Buffer.from(data)
  const bg = sampleBackgroundColor(out, width, height)
  const mask = new Uint8Array(width * height)
  const queue = []

  const trySeed = (x, y) => {
    const idx = y * width + x
    if (mask[idx]) return
    const i = idx * 4
    if (isStudioBackdrop(out[i] ?? 0, out[i + 1] ?? 0, out[i + 2] ?? 0, bg)) {
      mask[idx] = 1
      queue.push(idx)
    }
  }

  for (let x = 0; x < width; x++) {
    trySeed(x, 0)
    trySeed(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y)
    trySeed(width - 1, y)
  }

  while (queue.length > 0) {
    const idx = queue.pop()
    if (idx === undefined) break
    const x = idx % width
    const y = Math.floor(idx / width)
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nidx = ny * width + nx
      if (mask[nidx]) continue
      const i = nidx * 4
      if (isStudioBackdrop(out[i] ?? 0, out[i + 1] ?? 0, out[i + 2] ?? 0, bg)) {
        mask[nidx] = 1
        queue.push(nidx)
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const i = idx * 4
      if (mask[idx] === 1) {
        out[i + 3] = 0
        continue
      }

      const r = out[i] ?? 0
      const g = out[i + 1] ?? 0
      const b = out[i + 2] ?? 0
      let neighborBg = 0
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        if (mask[ny * width + nx] === 1) neighborBg++
      }
      if (neighborBg === 0) continue

      const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
      const saturation = Math.max(r, g, b) - Math.min(r, g, b)
      const feather = Math.min(1, Math.max(0, (dist - 18) / 36 + saturation / 110))
      out[i + 3] = Math.round(Math.min(255, feather * 255))
    }
  }

  return out
}

async function affisellGradientBuffer(width, height) {
  return sharp(Buffer.from(affisellGradientSvg(width, height))).png().toBuffer()
}

async function resizedPortraitRgba(input, width, height, fit = "fill") {
  const { data, info } = await sharp(await portraitBuffer(input))
    .resize(width, height, {
      fit,
      ...(fit === "cover" ? { position: "top" } : {}),
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const keyed = keyNeutralStudioBackground(data, info.width, info.height)
  return sharp(keyed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

async function compositeOnAffisellGradient(subjectPng, width, height) {
  const gradient = await affisellGradientBuffer(width, height)
  return sharp(gradient).composite([{ input: subjectPng, blend: "over" }])
}

async function writePortraitWebp(input, outWidth, dest) {
  const { srcW, cropH } = await portraitExtract(input)
  const outHeight = Math.round(outWidth * (cropH / srcW))
  const subject = await resizedPortraitRgba(input, outWidth, outHeight)
  await (await compositeOnAffisellGradient(subject, outWidth, outHeight))
    .webp({ quality: 88, effort: 4 })
    .toFile(dest)
}

async function writeSquareWebp(input, size, dest) {
  const subject = await resizedPortraitRgba(input, size, size, "cover")
  await (await compositeOnAffisellGradient(subject, size, size))
    .webp({ quality: 86, effort: 4 })
    .toFile(dest)
}

async function writeCircleWebp(input, size, dest) {
  const subject = await resizedPortraitRgba(input, size, size, "cover")
  const composited = await (await compositeOnAffisellGradient(subject, size, size))
    .ensureAlpha()
    .png()
    .toBuffer()

  await sharp(composited)
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .webp({ quality: 88, effort: 4 })
    .toFile(dest)
}

async function writePlaceholder(dest, size, label) {
  await (await compositeOnAffisellGradient(await affisellGradientBuffer(size, size), size, size))
    .composite([
      {
        input: Buffer.from(
          `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <text x="50%" y="54%" text-anchor="middle" font-size="${Math.round(size * 0.28)}" fill="white" font-family="system-ui,sans-serif" font-weight="700">${label}</text>
          </svg>`
        ),
        blend: "over",
      },
    ])
    .webp({ quality: 80 })
    .toFile(dest)
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

  console.log("[dona-avatar]", {
    source,
    result: "generating",
    portraitHeightRatio: PORTRAIT_HEIGHT_RATIO,
    brandBackdrop: "affisell-orbital-gradient",
  })

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
