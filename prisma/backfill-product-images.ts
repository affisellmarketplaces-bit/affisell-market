/**
 * Assigns Unsplash gallery URLs to products with no usable images (empty array or only blank strings).
 *
 *   npx tsx prisma/backfill-product-images.ts
 *   npm run db:backfill-images
 *
 * Idempotent: re-run picks the same URLs per product id (stable hash).
 */

import { createHash } from "node:crypto"

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

/** Unsplash photo paths (same host pattern as prisma/seed.ts). */
const UNSPLASH_POOL = [
  "photo-1695048133142-1a20484d2569",
  "photo-1517336714731-489689fd1ca8",
  "photo-1618366712010-f4ae9c647dcb",
  "photo-1586023492125-27b2c045efd7",
  "photo-1556909114-f6e7ad7d3136",
  "photo-1586495777744-4413f21062fa",
  "photo-1620916566398-39f1143ab7be",
  "photo-1521572163474-6864f9cf17ab",
  "photo-1505740420928-5e560c06d30e",
  "photo-1523275335684-37898b6baf30",
  "photo-1542291026-7eec264c27ff",
  "photo-1560472354-b33ff0c44a43",
  "photo-1498049794561-7780e7231661",
  "photo-1526170375885-4d8ecf77b99f",
  "photo-1607082348824-0a96f2a4b9da",
  "photo-1572635196237-14b3f281503f",
] as const

function unsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?w=800&q=80`
}

function stableIndex(seed: string, modulo: number): number {
  const n = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16)
  return Math.abs(n) % modulo
}

function galleryForProduct(productId: string): string[] {
  const start = stableIndex(productId, UNSPLASH_POOL.length)
  const urls: string[] = []
  for (let k = 0; k < 3; k++) {
    const id = UNSPLASH_POOL[(start + k) % UNSPLASH_POOL.length]!
    urls.push(unsplashUrl(id))
  }
  return [...new Set(urls)]
}

function hasUsableImages(images: string[]): boolean {
  return images.some((u) => typeof u === "string" && u.trim().length > 0)
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is missing (.env / .env.local).")
    process.exit(1)
  }

  const rows = await prisma.product.findMany({
    select: { id: true, name: true, images: true },
  })

  const targets = rows.filter((r) => !hasUsableImages(r.images))
  if (targets.length === 0) {
    console.log("No products need image backfill.")
    return
  }

  let updated = 0
  for (const p of targets) {
    const images = galleryForProduct(p.id)
    await prisma.product.update({
      where: { id: p.id },
      data: { images },
    })
    updated += 1
    console.log(`  + ${p.name.slice(0, 72)}${p.name.length > 72 ? "…" : ""} (${p.id}) → ${images.length} images`)
  }

  console.log(`\nDone: updated ${updated} product(s) with default gallery URLs.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
