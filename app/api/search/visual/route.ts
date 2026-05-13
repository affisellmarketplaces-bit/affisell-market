import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { prisma } from "@/lib/prisma"
import { formatStoreCurrency } from "@/lib/market-config"
import { primaryProductImage } from "@/lib/product-images"
import type { VisualSearchResult } from "@/lib/visual-search-types"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

/** Deterministic-ish seed from file bytes for reproducible shuffle per upload. */
function seedFromBuffer(buf: Uint8Array) {
  let h = buf.length >>> 0
  const n = Math.min(buf.length, 2048)
  for (let i = 0; i < n; i++) {
    h = (h + buf[i]! * (i + 1)) >>> 0
  }
  return h || 1
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed >>> 0
  function rand() {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s / 0xffffffff
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req, null), {
    prefix: "visual-search",
    limit: 24,
    windowMs: 60_000,
  })
  if (limited) return limited

  let buf: Uint8Array
  try {
    const ct = req.headers.get("content-type") ?? ""
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }
    const fd = await req.formData()
    const file = fd.get("image")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image field" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 })
    }
    const mime = (file.type || "").toLowerCase()
    if (mime && mime !== "application/octet-stream" && !ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 })
    }
    const ab = await file.arrayBuffer()
    buf = new Uint8Array(ab)
    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 })
  }

  const seed = seedFromBuffer(buf)

  const rows = await prisma.affiliateProduct.findMany({
    where: { ...affiliateRoleMarketplaceWhere, isListed: true, product: { active: true } },
    take: 40,
    orderBy: { id: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: true,
        },
      },
    },
  })

  const withProduct = rows.filter((r): r is typeof r & { product: NonNullable<(typeof rows)[number]["product"]> } =>
    Boolean(r.product)
  )

  const shuffled = seededShuffle(withProduct, seed).slice(0, 12)

  const jitter0 = seed % 3
  const results: VisualSearchResult[] = shuffled.map((row, i) => {
    const img = primaryProductImage(row.product.images)
    /** Demo scores: strongest ~95–97%, then taper (no real embeddings yet). */
    const tier = Math.round(95 - i * 1.6 - jitter0 * 0.25)
    const matchScore = Math.min(97, Math.max(72, tier))
    return {
      listingId: row.id,
      productId: row.product.id,
      title: row.product.name,
      imageUrl: img || "/placeholder.png",
      priceDisplay: formatStoreCurrency(row.sellingPriceCents / 100),
      matchScore,
    }
  })

  results.sort((a, b) => b.matchScore - a.matchScore)

  return NextResponse.json({ results })
}
