/**
 * Full category tree only (no products). Clears `Category` tree and legacy `Subcategory` rows.
 * Sub slugs are `parentSlug + '-' + slugify(name)` to stay globally unique.
 *
 *   npx tsx prisma/seed-taxonomy.ts
 */

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const TAXONOMY = [
  {
    name: "Electronics",
    slug: "electronics",
    icon: "📱",
    order: 1,
    subs: [
      "Cell Phones & Accessories",
      "Computers & Tablets",
      "TV & Video",
      "Audio & Headphones",
      "Camera & Photo",
      "Video Games",
      "Wearable Technology",
      "GPS & Navigation",
      "Office Electronics",
      "Electronic Components",
    ],
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    icon: "🏡",
    order: 2,
    subs: [
      "Furniture",
      "Kitchen & Dining",
      "Bedding & Bath",
      "Home Decor",
      "Storage & Organization",
      "Patio, Lawn & Garden",
      "Lighting & Ceiling Fans",
      "Appliances",
      "Vacuums & Floor Care",
      "Event & Party Supplies",
    ],
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty",
    icon: "💄",
    order: 3,
    subs: [
      "Makeup",
      "Skin Care",
      "Hair Care",
      "Fragrance",
      "Personal Care",
      "Tools & Accessories",
      "Oral Care",
      "Shaving & Hair Removal",
    ],
  },
  {
    name: "Men's Fashion",
    slug: "mens-fashion",
    icon: "👔",
    order: 4,
    subs: ["Clothing", "Shoes", "Watches", "Accessories", "Activewear", "Underwear & Sleepwear"],
  },
  {
    name: "Women's Fashion",
    slug: "womens-fashion",
    icon: "👗",
    order: 5,
    subs: [
      "Clothing",
      "Shoes",
      "Handbags & Wallets",
      "Jewelry",
      "Watches",
      "Activewear",
      "Lingerie & Sleepwear",
      "Accessories",
    ],
  },
  {
    name: "Sports & Outdoors",
    slug: "sports",
    icon: "⚽",
    order: 6,
    subs: [
      "Exercise & Fitness",
      "Outdoor Recreation",
      "Team Sports",
      "Cycling",
      "Fishing",
      "Hunting",
      "Camping & Hiking",
      "Water Sports",
      "Golf",
    ],
  },
  {
    name: "Toys & Games",
    slug: "toys",
    icon: "🧸",
    order: 7,
    subs: [
      "Action Figures & Statues",
      "Board Games",
      "Dolls & Accessories",
      "Building Toys",
      "Educational Toys",
      "Puzzles",
      "Outdoor Play",
      "Stuffed Animals",
    ],
  },
  {
    name: "Books",
    slug: "books",
    icon: "📚",
    order: 8,
    subs: [
      "Fiction",
      "Non-Fiction",
      "Children Books",
      "Textbooks",
      "Comics & Graphic Novels",
      "Cookbooks",
      "E-Books",
    ],
  },
  {
    name: "Automotive",
    slug: "automotive",
    icon: "🚗",
    order: 9,
    subs: [
      "Car Care",
      "Car Electronics",
      "Tools & Equipment",
      "Replacement Parts",
      "Interior Accessories",
      "Exterior Accessories",
      "Motorcycle & Powersports",
    ],
  },
  {
    name: "Pet Supplies",
    slug: "pet-supplies",
    icon: "🐕",
    order: 10,
    subs: ["Dog Supplies", "Cat Supplies", "Fish & Aquatic Pets", "Bird Supplies", "Small Animals", "Reptiles"],
  },
  {
    name: "Office Products",
    slug: "office",
    icon: "📎",
    order: 11,
    subs: [
      "Office Electronics",
      "School Supplies",
      "Office Furniture",
      "Paper & Notebooks",
      "Writing Supplies",
      "Printer Ink & Toner",
    ],
  },
  {
    name: "Health & Household",
    slug: "health",
    icon: "💊",
    order: 12,
    subs: [
      "Vitamins & Supplements",
      "Household Supplies",
      "Medical Supplies",
      "Baby Care",
      "Health Monitors",
      "Sports Nutrition",
    ],
  },
  {
    name: "Baby Products",
    slug: "baby",
    icon: "🍼",
    order: 13,
    subs: [
      "Strollers & Car Seats",
      "Nursery",
      "Diapering",
      "Feeding",
      "Baby & Toddler Toys",
      "Baby Clothing",
    ],
  },
  {
    name: "Tools & Home Improvement",
    slug: "tools",
    icon: "🔨",
    order: 14,
    subs: [
      "Power Tools",
      "Hand Tools",
      "Hardware",
      "Paint & Wall Treatment",
      "Electrical",
      "Plumbing",
      "Safety & Security",
    ],
  },
  {
    name: "Industrial & Scientific",
    slug: "industrial",
    icon: "⚙️",
    order: 15,
    subs: [
      "Lab & Scientific Products",
      "Janitorial Supplies",
      "Food Service",
      "Material Handling",
      "Test, Measure & Inspect",
    ],
  },
  {
    name: "Arts, Crafts & Sewing",
    slug: "arts-crafts",
    icon: "🎨",
    order: 16,
    subs: ["Painting & Drawing", "Fabric & Sewing", "Scrapbooking", "Knitting & Crochet", "Beading & Jewelry Making"],
  },
  {
    name: "Music, Movies & TV",
    slug: "music",
    icon: "🎵",
    order: 17,
    subs: ["Musical Instruments", "CDs & Vinyl", "Movies & TV Shows", "Sheet Music"],
  },
  {
    name: "Collectibles & Fine Art",
    slug: "collectibles",
    icon: "🖼️",
    order: 18,
    subs: ["Collectible Cards", "Coins & Currency", "Sports Memorabilia", "Antiques", "Fine Art"],
  },
  {
    name: "Grocery & Gourmet Food",
    slug: "grocery",
    icon: "🛒",
    order: 19,
    subs: ["Beverages", "Snacks", "Pantry Staples", "Fresh Food", "International Foods", "Gourmet Gifts"],
  },
  {
    name: "Handmade Products",
    slug: "handmade",
    icon: "✋",
    order: 20,
    subs: ["Handmade Jewelry", "Handmade Home Decor", "Handmade Clothing", "Handmade Art"],
  },
  {
    name: "Digital Content & Services",
    slug: "digital",
    icon: "⚡",
    order: 21,
    subs: ["Software", "Video Games Digital", "E-Books", "Online Courses"],
  },
] as const

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  await prisma.product.updateMany({
    data: { categoryId: null, subcategoryId: null },
  })
  await prisma.subcategory.deleteMany()
  await prisma.category.deleteMany({ where: { parentId: { not: null } } })
  await prisma.category.deleteMany()

  let subCount = 0
  for (const cat of TAXONOMY) {
    const parent = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        order: cat.order,
        parentId: null,
      },
    })

    for (const subName of cat.subs) {
      const base = slugify(subName)
      let slug = `${cat.slug}-${base}`
      if (slug.length > 100) slug = slug.slice(0, 100)

      let attempt = 0
      while (await prisma.category.findUnique({ where: { slug } })) {
        attempt += 1
        slug = `${slug}-${attempt}`.slice(0, 128)
      }

      await prisma.category.create({
        data: {
          name: subName,
          slug,
          parentId: parent.id,
          order: 0,
        },
      })
      subCount += 1
    }
  }

  const total = await prisma.category.count()
  console.log(`✅ Seeded ${TAXONOMY.length} parent departments + ${subCount} subcategories (${total} Category rows total)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
