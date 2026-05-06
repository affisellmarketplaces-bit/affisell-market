/**
 * Seed 12 base navigation categories (idempotent).
 *   npx tsx prisma/seed-categories.ts
 */

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const categories = [
  { name: "Electronics", slug: "electronics", icon: "📱", order: 1 },
  { name: "Computers", slug: "computers", icon: "💻", order: 2 },
  { name: "Home & Kitchen", slug: "home-kitchen", icon: "🏡", order: 3 },
  { name: "Beauty & Personal Care", slug: "beauty", icon: "💄", order: 4 },
  { name: "Sports & Outdoors", slug: "sports", icon: "⚽", order: 5 },
  { name: "Men's Fashion", slug: "mens-fashion", icon: "👔", order: 6 },
  { name: "Women's Fashion", slug: "womens-fashion", icon: "👗", order: 7 },
  { name: "Toys & Games", slug: "toys", icon: "🧸", order: 8 },
  { name: "Books", slug: "books", icon: "📚", order: 9 },
  { name: "Automotive", slug: "automotive", icon: "🚗", order: 10 },
  { name: "Pet Supplies", slug: "pet-supplies", icon: "🐕", order: 11 },
  { name: "Office Products", slug: "office", icon: "📎", order: 12 },
]

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  for (const cat of categories) {
    const bySlug = await prisma.category.findUnique({ where: { slug: cat.slug } })
    if (bySlug) {
      // Avoid @unique(name) collisions when taxonomy already has the same slug with another label.
      await prisma.category.update({
        where: { id: bySlug.id },
        data: { icon: cat.icon, order: cat.order },
      })
      continue
    }

    const byName = await prisma.category.findUnique({ where: { name: cat.name } })
    if (byName) {
      try {
        await prisma.category.update({
          where: { id: byName.id },
          data: { slug: cat.slug, icon: cat.icon, order: cat.order },
        })
      } catch {
        await prisma.category.update({
          where: { id: byName.id },
          data: { icon: cat.icon, order: cat.order },
        })
      }
      continue
    }

    await prisma.category.create({ data: cat })
  }
  console.log("✅ Seeded 12 categories")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
