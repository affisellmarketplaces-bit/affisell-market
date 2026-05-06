/**
 * 8 demo products linked to taxonomy **leaf** categories (slug = parentSlug + slugify(name)).
 * Requires: `npx tsx prisma/seed-taxonomy.ts` (or compatible tree) + supplier from `npx prisma db seed`.
 *
 *   npx tsx prisma/seed-products.ts
 */

import { createHash } from "node:crypto"

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const SUPPLIER_SLUG = "boutique-affisell"

/** Must match `prisma/seed-taxonomy.ts`. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function leafSlug(parentSlug: string, subName: string): string {
  return `${parentSlug}-${slugify(subName)}`
}

function seedProductId(slug: string): string {
  return `aff_${createHash("sha256").update(`affisell:${slug}`).digest("hex").slice(0, 28)}`
}

function usdToCents(n: number): number {
  return Math.round(n * 100)
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  const store = await prisma.store.findUnique({ where: { slug: SUPPLIER_SLUG } })
  if (!store) {
    throw new Error("Run `npx prisma db seed` first (supplier store missing).")
  }
  const supplierId = store.userId

  const resolve = async (parentSlug: string, subName: string) => {
    const slug = leafSlug(parentSlug, subName)
    const row = await prisma.category.findUnique({ where: { slug } })
    if (!row) {
      throw new Error(`Missing category slug "${slug}" — run prisma/seed-taxonomy.ts first.`)
    }
    return row
  }

  const cellPhones = await resolve("electronics", "Cell Phones & Accessories")
  const computers = await resolve("electronics", "Computers & Tablets")
  const audio = await resolve("electronics", "Audio & Headphones")
  const furniture = await resolve("home-kitchen", "Furniture")
  const kitchen = await resolve("home-kitchen", "Kitchen & Dining")
  const makeup = await resolve("beauty", "Makeup")
  const skincare = await resolve("beauty", "Skin Care")
  const mensClothing = await resolve("mens-fashion", "Clothing")

  const rows = [
    {
      slug: "seed-iphone-15-pro",
      name: "iPhone 15 Pro",
      description: "Latest iPhone with titanium design.",
      priceUsd: 999.0,
      stock: 50,
      image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
      categoryId: cellPhones.id,
      categories: ["Electronics", "Cell Phones & Accessories"] as string[],
    },
    {
      slug: "seed-macbook-air-m3",
      name: "MacBook Air M3",
      description: "Thin, light, powerful laptop.",
      priceUsd: 1299.0,
      stock: 30,
      image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
      categoryId: computers.id,
      categories: ["Electronics", "Computers & Tablets"],
    },
    {
      slug: "seed-sony-wh1000xm5",
      name: "Sony WH-1000XM5",
      description: "Industry-leading noise canceling headphones.",
      priceUsd: 399.0,
      stock: 75,
      image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800",
      categoryId: audio.id,
      categories: ["Electronics", "Audio & Headphones"],
    },
    {
      slug: "seed-ergonomic-chair",
      name: "Ergonomic Office Chair",
      description: "Support for long work sessions.",
      priceUsd: 249.0,
      stock: 40,
      image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
      categoryId: furniture.id,
      categories: ["Home & Kitchen", "Furniture"],
    },
    {
      slug: "seed-cookware-set",
      name: "Stainless Steel Cookware Set",
      description: "Complete set for everyday cooking.",
      priceUsd: 189.0,
      stock: 60,
      image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
      categoryId: kitchen.id,
      categories: ["Home & Kitchen", "Kitchen & Dining"],
    },
    {
      slug: "seed-fenty-lipstick",
      name: "Fenty Beauty Lipstick",
      description: "Bold color, lasting wear.",
      priceUsd: 29.0,
      stock: 200,
      image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800",
      categoryId: makeup.id,
      categories: ["Beauty & Personal Care", "Makeup"],
    },
    {
      slug: "seed-ordinary-serum",
      name: "The Ordinary Serum",
      description: "Targeted skin treatment.",
      priceUsd: 19.0,
      stock: 150,
      image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800",
      categoryId: skincare.id,
      categories: ["Beauty & Personal Care", "Skin Care"],
    },
    {
      slug: "seed-nike-dri-fit",
      name: "Nike Dri-FIT T-Shirt",
      description: "Moisture-wicking training tee.",
      priceUsd: 35.0,
      stock: 300,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
      categoryId: mensClothing.id,
      categories: ["Men's Fashion", "Clothing"],
    },
  ]

  for (const row of rows) {
    const id = seedProductId(row.slug)
    await prisma.product.upsert({
      where: { id },
      create: {
        id,
        supplierId,
        name: row.name,
        description: row.description,
        images: [row.image],
        categories: row.categories,
        tags: ["seed-products-taxonomy"],
        basePriceCents: usdToCents(row.priceUsd),
        commissionRate: 15,
        stock: row.stock,
        active: true,
        variants: { slug: row.slug },
        categoryId: row.categoryId,
        style: "modern",
        shippingType: "standard",
        handlingDays: 1,
      },
      update: {
        name: row.name,
        description: row.description,
        images: [row.image],
        categories: row.categories,
        basePriceCents: usdToCents(row.priceUsd),
        stock: row.stock,
        active: true,
        categoryId: row.categoryId,
      },
    })
  }

  console.log("✅ Seeded 8 products linked to leaf categories")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
