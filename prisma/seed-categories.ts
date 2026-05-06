/**
 * Seed 12 parent categories + nested subcategories (Category.parentId tree).
 *   npx tsx prisma/seed-categories.ts
 */

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const CATEGORIES_TREE = [
  {
    name: "Electronics",
    slug: "electronics",
    icon: "📱",
    order: 1,
    subcategories: [
      { name: "Cell Phones & Accessories", slug: "cell-phones" },
      { name: "Computers & Tablets", slug: "computers" },
      { name: "TV & Video", slug: "tv-video" },
      { name: "Audio & Headphones", slug: "audio" },
      { name: "Camera & Photo", slug: "camera" },
      { name: "Video Games", slug: "video-games" },
    ],
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    icon: "🏡",
    order: 2,
    subcategories: [
      { name: "Furniture", slug: "furniture" },
      { name: "Kitchen & Dining", slug: "kitchen" },
      { name: "Bedding & Bath", slug: "bedding" },
      { name: "Home Decor", slug: "decor" },
      { name: "Storage & Organization", slug: "storage" },
      { name: "Patio, Lawn & Garden", slug: "garden" },
    ],
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty",
    icon: "💄",
    order: 3,
    subcategories: [
      { name: "Makeup", slug: "makeup" },
      { name: "Skin Care", slug: "skincare" },
      { name: "Hair Care", slug: "haircare" },
      { name: "Fragrance", slug: "fragrance" },
      { name: "Personal Care", slug: "personal-care" },
    ],
  },
  {
    name: "Men's Fashion",
    slug: "mens-fashion",
    icon: "👔",
    order: 4,
    subcategories: [
      { name: "Clothing", slug: "mens-clothing" },
      { name: "Shoes", slug: "mens-shoes" },
      { name: "Watches", slug: "mens-watches" },
      { name: "Accessories", slug: "mens-accessories" },
    ],
  },
  {
    name: "Women's Fashion",
    slug: "womens-fashion",
    icon: "👗",
    order: 5,
    subcategories: [
      { name: "Clothing", slug: "womens-clothing" },
      { name: "Shoes", slug: "womens-shoes" },
      { name: "Handbags", slug: "handbags" },
      { name: "Jewelry", slug: "jewelry" },
    ],
  },
  {
    name: "Sports & Outdoors",
    slug: "sports",
    icon: "⚽",
    order: 6,
    subcategories: [
      { name: "Exercise & Fitness", slug: "fitness" },
      { name: "Outdoor Recreation", slug: "outdoor" },
      { name: "Team Sports", slug: "team-sports" },
      { name: "Cycling", slug: "cycling" },
    ],
  },
  {
    name: "Toys & Games",
    slug: "toys",
    icon: "🧸",
    order: 7,
    subcategories: [
      { name: "Action Figures", slug: "action-figures" },
      { name: "Board Games", slug: "board-games" },
      { name: "Dolls & Accessories", slug: "dolls" },
    ],
  },
  {
    name: "Books",
    slug: "books",
    icon: "📚",
    order: 8,
    subcategories: [
      { name: "Fiction", slug: "fiction" },
      { name: "Non-Fiction", slug: "non-fiction" },
      { name: "Children Books", slug: "children-books" },
    ],
  },
  {
    name: "Automotive",
    slug: "automotive",
    icon: "🚗",
    order: 9,
    subcategories: [
      { name: "Car Care", slug: "car-care" },
      { name: "Car Electronics", slug: "car-electronics" },
      { name: "Tools & Equipment", slug: "auto-tools" },
    ],
  },
  {
    name: "Pet Supplies",
    slug: "pet-supplies",
    icon: "🐕",
    order: 10,
    subcategories: [
      { name: "Dog Supplies", slug: "dog" },
      { name: "Cat Supplies", slug: "cat" },
      { name: "Fish & Aquatic Pets", slug: "fish" },
    ],
  },
  {
    name: "Office Products",
    slug: "office",
    icon: "📎",
    order: 11,
    subcategories: [
      { name: "Office Electronics", slug: "office-electronics" },
      { name: "School Supplies", slug: "school" },
      { name: "Office Furniture", slug: "office-furniture" },
    ],
  },
  {
    name: "Health & Household",
    slug: "health",
    icon: "💊",
    order: 12,
    subcategories: [
      { name: "Vitamins & Supplements", slug: "vitamins" },
      { name: "Household Supplies", slug: "household" },
      { name: "Medical Supplies", slug: "medical" },
    ],
  },
] as const

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  let subTotal = 0

  for (const cat of CATEGORIES_TREE) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { icon: cat.icon, order: cat.order, name: cat.name, parentId: null },
      create: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        order: cat.order,
        parentId: null,
      },
    })

    for (const sub of cat.subcategories) {
      const bySlug = await prisma.category.findUnique({ where: { slug: sub.slug } })
      if (bySlug) {
        await prisma.category.update({
          where: { id: bySlug.id },
          data: {
            name: sub.name,
            parentId: parent.id,
            order: 0,
          },
        })
      } else {
        await prisma.category.create({
          data: {
            name: sub.name,
            slug: sub.slug,
            parentId: parent.id,
            order: 0,
          },
        })
      }
      subTotal += 1
    }
  }

  console.log(`✅ Seeded ${CATEGORIES_TREE.length} categories + ${subTotal} subcategories (${CATEGORIES_TREE.length + subTotal} Category rows)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
