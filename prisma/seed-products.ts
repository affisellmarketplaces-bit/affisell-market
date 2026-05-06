/**
 * Upserts 6 demo products on legal categories (uses real Product fields).
 * Run after: `npx prisma db seed`
 *
 *   npx tsx prisma/seed-products.ts
 */

import { createHash } from "node:crypto"

import { config } from "dotenv"
import { Prisma, PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const SUPPLIER_SLUG = "boutique-affisell"

function seedProductId(slug: string): string {
  return `aff_${createHash("sha256").update(`affisell:${slug}`).digest("hex").slice(0, 28)}`
}

function usdToCents(n: number): number {
  return Math.round(n * 100)
}

type Row = {
  slug: string
  name: string
  description: string
  priceUsd: number
  compareAt?: number
  image: string
  categoryId: string
  categories: string[]
  style: string
  shippingType: string
  isOnSale?: boolean
  isBestSeller?: boolean
  isNewArrival?: boolean
  stock: number
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing (.env.local or .env).")
    process.exit(1)
  }

  const store = await prisma.store.findUnique({ where: { slug: SUPPLIER_SLUG } })
  if (!store) {
    throw new Error("Run `npx prisma db seed` first to create the supplier store and categories.")
  }
  const supplierId = store.userId

  const electronics = await prisma.category.findUnique({ where: { slug: "electronics" } })
  const home = await prisma.category.findUnique({ where: { slug: "home-kitchen" } })
  const beauty = await prisma.category.findUnique({ where: { slug: "beauty" } })

  if (!electronics || !home || !beauty) {
    throw new Error("Run `npx prisma db seed` first — missing electronics, home-kitchen, or beauty categories.")
  }

  const rows: Row[] = [
    {
      slug: "mechanical-keyboard",
      name: "Mechanical Keyboard",
      description: "Hot-swappable sockets and quality switches for daily typing.",
      priceUsd: 119.0,
      compareAt: 145.18,
      image: "https://images.unsplash.com/photo-1589578228447-e1a4e481c6c8?w=800&q=80",
      categoryId: electronics.id,
      categories: ["Electronics"],
      style: "modern",
      shippingType: "prime",
      isOnSale: true,
      isBestSeller: true,
      stock: 45,
    },
    {
      slug: "garden-tool-set",
      name: "Garden Tool Set",
      description: "Ergonomic handles with rust-resistant heads for digging and weeding.",
      priceUsd: 46.0,
      image: "https://images.unsplash.com/photo-1416879595882-3373a9d0a42c?w=800&q=80",
      categoryId: home.id,
      categories: ["Patio, Lawn & Garden"],
      style: "rustic",
      shippingType: "free",
      stock: 120,
    },
    {
      slug: "gaming-mouse",
      name: "Gaming Mouse",
      description: "Precision sensor, programmable side buttons, durable switches.",
      priceUsd: 49.99,
      image: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80",
      categoryId: electronics.id,
      categories: ["Electronics"],
      style: "modern",
      shippingType: "standard",
      stock: 89,
    },
    {
      slug: "memory-foam-pillow",
      name: "Memory Foam Pillow",
      description: "Contoured memory foam supports neck alignment.",
      priceUsd: 59.0,
      image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
      categoryId: home.id,
      categories: ["Home & Kitchen"],
      style: "minimalist",
      shippingType: "free",
      stock: 200,
    },
    {
      slug: "beard-oil",
      name: "Beard Oil",
      description: "Plant oils plus vitamin E to soften coarse hair.",
      priceUsd: 24.5,
      image: "https://images.unsplash.com/photo-1503236823255-94609f598e71?w=800&q=80",
      categoryId: beauty.id,
      categories: ["Beauty & Personal Care"],
      style: "luxury",
      shippingType: "standard",
      isNewArrival: true,
      stock: 67,
    },
    {
      slug: "wireless-charger",
      name: "Wireless Charger",
      description: "Fast wireless charging pad with case-friendly surface.",
      priceUsd: 34.99,
      compareAt: 42.69,
      image: "https://images.unsplash.com/photo-1586953208447-b95a79798f07?w=800&q=80",
      categoryId: electronics.id,
      categories: ["Electronics"],
      style: "minimalist",
      shippingType: "prime",
      isOnSale: true,
      stock: 156,
    },
  ]

  for (const row of rows) {
    const id = seedProductId(row.slug)
    const compareAt =
      row.compareAt != null ? new Prisma.Decimal(row.compareAt.toFixed(2)) : null

    await prisma.product.upsert({
      where: { id },
      create: {
        id,
        supplierId,
        name: row.name,
        description: row.description,
        images: [row.image],
        categories: row.categories,
        tags: ["seed-products"],
        basePriceCents: usdToCents(row.priceUsd),
        compareAt,
        commissionRate: 15,
        stock: row.stock,
        active: true,
        variants: { slug: row.slug },
        categoryId: row.categoryId,
        style: row.style,
        shippingType: row.shippingType,
        handlingDays: 1,
        isOnSale: row.isOnSale ?? false,
        isNewArrival: row.isNewArrival ?? false,
        isBestSeller: row.isBestSeller ?? false,
        isRefurbished: false,
        hasCoupon: false,
        isEcoFriendly: false,
        freeShipping: row.shippingType === "free",
      },
      update: {
        name: row.name,
        description: row.description,
        images: [row.image],
        categories: row.categories,
        basePriceCents: usdToCents(row.priceUsd),
        compareAt,
        stock: row.stock,
        active: true,
        categoryId: row.categoryId,
        style: row.style,
        shippingType: row.shippingType,
        isOnSale: row.isOnSale ?? false,
        isNewArrival: row.isNewArrival ?? false,
        isBestSeller: row.isBestSeller ?? false,
        freeShipping: row.shippingType === "free",
      },
    })
  }

  console.log("✅ Seeded 6 products with categories, images, filters")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
