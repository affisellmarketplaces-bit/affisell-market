#!/usr/bin/env node
/**
 * Regenerate public/og-affiliate.png (1200×630) from public/og-affiliate.svg
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import sharp from "sharp"

const root = process.cwd()
const svgPath = resolve(root, "public/og-affiliate.svg")
const outPath = resolve(root, "public/og-affiliate.png")

const svg = readFileSync(svgPath)

await sharp(Buffer.from(svg))
  .resize(1200, 630, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile(outPath)

console.log("[og-affiliate]", { outPath, width: 1200, height: 630, result: "ok" })
