/**
 * Peuple Neon / Postgres avec la boutique « Boutique Affisell » et 18 produits de test.
 * `npx prisma db seed`
 */

import { createHash } from "node:crypto"

import { config } from "dotenv"
import { Prisma, PrismaClient } from "@prisma/client"

import { AFFISELL_CATEGORIES } from "@/lib/affisell-categories"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const SUPPLIER_SLUG = "boutique-affisell"
const SUPPLIER_NAME = "Boutique Affisell"
const SUPPLIER_EMAIL = "seed-boutique-affisell@affisell.local"
const SEED_TAG = "seed-neon"
const AFFILIATE_SELLERS = [
  { name: "Inovgadgets Store", slug: "inovgadgets-store", email: "seed-inovgadgets@affisell.local" },
  { name: "Maison Luxe", slug: "maison-luxe", email: "seed-maison-luxe@affisell.local" },
  { name: "TechPro", slug: "techpro", email: "seed-techpro@affisell.local" },
  { name: "Aura Beauty", slug: "aura-beauty", email: "seed-aura-beauty@affisell.local" },
] as const

/** Same taxonomy as `@/lib/affisell-categories.ts` (single source of truth). */
const affisellCategories = AFFISELL_CATEGORIES

function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

function unsplash(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?w=800&q=80`
}

/** ID stable par slug pour upsert idempotent. */
function seedProductId(slug: string): string {
  return `aff_${createHash("sha256").update(`affisell:${slug}`).digest("hex").slice(0, 28)}`
}

/** Legal Amazon-style department nav (order = sidebar sort). */
const LEGAL_MARKET_NAV = [
  { name: "Electronics", slug: "electronics", icon: "📱", order: 1 },
  { name: "Computers & Accessories", slug: "computers", icon: "💻", order: 2 },
  { name: "Smart Home", slug: "smart-home", icon: "🏠", order: 3 },
  { name: "Cell Phones", slug: "cell-phones", icon: "📞", order: 4 },
  { name: "Video Games", slug: "video-games", icon: "🎮", order: 5 },
  { name: "Women's Fashion", slug: "womens-fashion", icon: "👗", order: 6 },
  { name: "Men's Fashion", slug: "mens-fashion", icon: "👔", order: 7 },
  { name: "Kids' Fashion", slug: "kids-fashion", icon: "👶", order: 8 },
  { name: "Shoes & Footwear", slug: "shoes", icon: "👟", order: 9 },
  { name: "Jewelry & Watches", slug: "jewelry", icon: "💎", order: 10 },
  { name: "Luggage & Bags", slug: "bags", icon: "👜", order: 11 },
  { name: "Home & Kitchen", slug: "home-kitchen", icon: "🏡", order: 12 },
  { name: "Furniture", slug: "furniture", icon: "🛋️", order: 13 },
  { name: "Home Decor", slug: "home-decor", icon: "🖼️", order: 14 },
  { name: "Tools & Home Improvement", slug: "tools", icon: "🔨", order: 15 },
  { name: "Patio, Lawn & Garden", slug: "garden", icon: "🌱", order: 16 },
  { name: "Beauty & Personal Care", slug: "beauty", icon: "💄", order: 17 },
  { name: "Health & Household", slug: "health", icon: "💊", order: 18 },
  { name: "Grocery & Gourmet Food", slug: "grocery", icon: "🛒", order: 19 },
  { name: "Pet Supplies", slug: "pet-supplies", icon: "🐕", order: 20 },
  { name: "Baby Products", slug: "baby", icon: "🍼", order: 21 },
  { name: "Sports & Outdoors", slug: "sports", icon: "⚽", order: 22 },
  { name: "Automotive", slug: "automotive", icon: "🚗", order: 23 },
  { name: "Industrial & Scientific", slug: "industrial", icon: "⚙️", order: 24 },
  { name: "Books", slug: "books", icon: "📚", order: 25 },
  { name: "Music, Movies & TV", slug: "music", icon: "🎵", order: 26 },
  { name: "Toys & Games", slug: "toys", icon: "🧸", order: 27 },
  { name: "Arts, Crafts & Sewing", slug: "arts-crafts", icon: "🎨", order: 28 },
  { name: "Collectibles & Fine Art", slug: "collectibles", icon: "🖼️", order: 29 },
  { name: "Office Products", slug: "office", icon: "📎", order: 30 },
  { name: "Handmade & Artisan", slug: "handmade", icon: "✋", order: 31 },
  { name: "Digital Services", slug: "digital-services", icon: "⚡", order: 32 },
] as const

const STYLE_ROTATION = ["minimalist", "vintage", "modern", "boho"] as const

function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, " ")
    .trim()
    .replace(/\s*&\s*/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

async function upsertMarketplaceCategories(): Promise<void> {
  for (const row of LEGAL_MARKET_NAV) {
    const bySlug = await prisma.category.findUnique({ where: { slug: row.slug } })
    if (bySlug) {
      await prisma.category.update({
        where: { id: bySlug.id },
        data: { name: row.name, icon: row.icon, order: row.order },
      })
      continue
    }

    const byName = await prisma.category.findFirst({ where: { name: row.name, parentId: null } })
    if (byName) {
      try {
        await prisma.category.update({
          where: { id: byName.id },
          data: { slug: row.slug, icon: row.icon, order: row.order },
        })
      } catch {
        await prisma.category.update({
          where: { id: byName.id },
          data: { icon: row.icon, order: row.order },
        })
      }
      continue
    }

    await prisma.category.create({
      data: {
        name: row.name,
        slug: row.slug,
        icon: row.icon,
        order: row.order,
      },
    })
  }

  async function ensureCategoryForSeedName(name: string): Promise<void> {
    const byName = await prisma.category.findFirst({ where: { name } })
    if (byName) return

    const base = categorySlug(name)
    let slug = base
    let i = 0
    // Avoid slug collisions with nav rows or other dept names ("Computers" vs "Computers & Accessories")
    while (await prisma.category.findUnique({ where: { slug } })) {
      i += 1
      slug = `${base}-${i}`
    }

    await prisma.category.create({
      data: { name, slug, icon: "📦", order: 999 },
    })
  }

  const unique = [...new Set(ITEMS.map((item) => item.category))]
  for (const name of unique) {
    await ensureCategoryForSeedName(name)
  }

  console.log(`✅ Seeded ${LEGAL_MARKET_NAV.length} legal categories`)
}

type SeedItem = {
  name: string
  slug: string
  category: string
  description: string
  priceEur: number
  photoId: string
}

const ITEMS: SeedItem[] = [
  {
    name: "Vegan Leather Handbag",
    slug: "vegan-leather-handbag",
    category: "Clothing, Shoes & Jewelry",
    description:
      "Structured tote in high-quality vegan leather with adjustable strap and zip interior pocket. Everyday polish without animal materials.",
    priceEur: 72.5,
    photoId: "photo-1590874103328-eac38a683ce7",
  },
  {
    name: "Minimalist Watch",
    slug: "minimalist-watch",
    category: "Clothing, Shoes & Jewelry",
    description:
      "Slim case, clean dial, and quick-release straps. Water-resistant build and reliable quartz movement for daily wear.",
    priceEur: 84.99,
    photoId: "photo-1579586337278-3befd40fd17a",
  },
  {
    name: "Lavender Candle",
    slug: "lavender-candle",
    category: "Home & Kitchen",
    description:
      "Soy wax blend with calming lavender notes. Cotton wick, long, even burn—ideal for unwinding after work.",
    priceEur: 24.9,
    photoId: "photo-1608571423902-eed4a5ad8108",
  },
  {
    name: "Bluetooth Headphones",
    slug: "bluetooth-headphones",
    category: "Electronics",
    description:
      "Balanced stereo sound, padded headband, and fold-flat ear cups. Detachable cable when you want a wired fallback.",
    priceEur: 69.0,
    photoId: "photo-1505740420928-5e560c06d30e",
  },
  {
    name: "Vitamin C Serum",
    slug: "vitamin-c-serum",
    category: "Beauty & Personal Care",
    description:
      "Brightening serum with stabilized vitamin C and hyaluronic acid. Lightweight, fast-absorbing, suitable for morning routines.",
    priceEur: 52.0,
    photoId: "photo-1620916566398-39f1143ab7be",
  },
  {
    name: "Yoga Mat",
    slug: "yoga-mat",
    category: "Sports & Outdoors",
    description:
      "Non-slip surface with cushioned support for joints. Rolls tight and includes a carry strap for studio or home practice.",
    priceEur: 45.0,
    photoId: "photo-1601925260368-ae2f83cf8b7f",
  },
  {
    name: "Polarized Sunglasses",
    slug: "polarized-sunglasses",
    category: "Clothing, Shoes & Jewelry",
    description:
      "Polarized lenses cut road and water glare. Lightweight metal frame with hard case and microfiber cloth included.",
    priceEur: 48.0,
    photoId: "photo-1572635196237-14b3f281503f",
  },
  {
    name: "Portable Speaker",
    slug: "portable-speaker",
    category: "Electronics",
    description:
      "IPX7 waterproofing, carabiner loop, and punchy bass tuning. Up to 12 hours playback for hikes and poolside sessions.",
    priceEur: 55.0,
    photoId: "photo-1608043152269-423dbba4e7e2",
  },
  {
    name: "Organic Tea",
    slug: "organic-tea",
    category: "Grocery & Gourmet Food",
    description:
      "Certified organic loose-leaf blend with floral and honey notes. Resealable pouch keeps aroma fresh between brews.",
    priceEur: 18.5,
    photoId: "photo-1564890369139-c6cdc9057111",
  },
  {
    name: "Hydrating Cream",
    slug: "hydrating-cream",
    category: "Beauty & Personal Care",
    description:
      "Rich day-and-night cream with ceramides and glycerin to lock in moisture. Fragrance-aware formula for sensitive skin types.",
    priceEur: 42.0,
    photoId: "photo-1556228578-0d85b1a4d571",
  },
  {
    name: "Urban Backpack",
    slug: "urban-backpack",
    category: "Luggage & Travel Gear",
    description:
      "Laptop sleeve, anti-theft pocket, and weather-resistant shell. Ergonomic straps for commutes and weekend trips.",
    priceEur: 79.0,
    photoId: "photo-1553062407-98eeb64c46a7",
  },
  {
    name: "LED Desk Lamp",
    slug: "led-desk-lamp",
    category: "Tools & Home Improvement",
    description:
      "Dimmable LED bar with color temperature control. Stable base and touch controls for focused desk or bedside lighting.",
    priceEur: 42.0,
    photoId: "photo-1507473885765-e6ed057f782c",
  },
  {
    name: "Wireless Charger",
    slug: "wireless-charger",
    category: "Cell Phones & Accessories",
    description:
      "Fast wireless charging pad with foreign-object detection and non-slip ring. USB-C power input, case-friendly surface.",
    priceEur: 34.99,
    photoId: "photo-1591290616108-4a6128a64704",
  },
  {
    name: "Beard Oil",
    slug: "beard-oil",
    category: "Health & Household",
    description:
      "Plant oils plus vitamin E to soften coarse hair and reduce itch. Dropper bottle for precise, low-waste application.",
    priceEur: 24.5,
    photoId: "photo-1621607512214-703b1a6e432a",
  },
  {
    name: "Memory Foam Pillow",
    slug: "memory-foam-pillow",
    category: "Home & Kitchen",
    description:
      "Contoured memory foam supports neck alignment. Breathable cover removes for washing; ideal for side and back sleepers.",
    priceEur: 59.0,
    photoId: "photo-1629946832027-a6d24c5636e3",
  },
  {
    name: "Gaming Mouse",
    slug: "gaming-mouse",
    category: "Video Games",
    description:
      "Precision sensor, programmable side buttons, and durable switches. Lightweight shell with PTFE feet for smooth glides.",
    priceEur: 49.99,
    photoId: "photo-1527814050087-89be033b2b5f",
  },
  {
    name: "Mechanical Keyboard",
    slug: "mechanical-keyboard",
    category: "Computers",
    description:
      "Hot-swappable sockets, pre-lubed stabilizers, and doubleshot keycaps. USB-C detachable cable for tidy setups.",
    priceEur: 119.0,
    photoId: "photo-158782514070380-d0ec2f14aaf8",
  },
  {
    name: "Garden Tool Set",
    slug: "garden-tool-set",
    category: "Garden & Outdoor",
    description:
      "Ergonomic handles with rust-resistant heads for digging, weeding, and transplanting. Canvas roll keeps tools organized.",
    priceEur: 46.0,
    photoId: "photo-1416879595882-3373a9d0a42c",
  },
]

const allowedCategory = new Set<string>(affisellCategories as readonly string[])

async function ensureStoreUser(input: {
  slug: string
  name: string
  email: string
  role: "SUPPLIER" | "AFFILIATE"
}): Promise<string> {
  const bySlug = await prisma.store.findUnique({ where: { slug: input.slug } })
  if (bySlug) return bySlug.userId

  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      role: input.role,
    },
    update: { name: input.name, role: input.role },
  })

  const byUser = await prisma.store.findUnique({ where: { userId: user.id } })
  if (byUser) {
    if (byUser.slug !== input.slug) {
      try {
        await prisma.store.update({
          where: { id: byUser.id },
          data: { name: input.name, slug: input.slug },
        })
      } catch {
        /* slug déjà pris ailleurs : on garde le store existant */
      }
    }
    return user.id
  }

  await prisma.store.create({
    data: {
      userId: user.id,
      name: input.name,
      slug: input.slug,
    },
  })

  return user.id
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL manquant (.env.local ou .env).")
    process.exit(1)
  }

  if (ITEMS.length !== 18) {
    console.error(`Expected 18 seed products, got ${ITEMS.length}`)
    process.exit(1)
  }

  for (const item of ITEMS) {
    if (!allowedCategory.has(item.category)) {
      console.error(`Unknown category for ${item.slug}: ${item.category}`)
      process.exit(1)
    }
  }

  await upsertMarketplaceCategories()

  const supplierId = await ensureStoreUser({
    slug: SUPPLIER_SLUG,
    name: SUPPLIER_NAME,
    email: SUPPLIER_EMAIL,
    role: "SUPPLIER",
  })
  const affiliateIds = await Promise.all(
    AFFILIATE_SELLERS.map((seller) =>
      ensureStoreUser({
        slug: seller.slug,
        name: seller.name,
        email: seller.email,
        role: "AFFILIATE",
      })
    )
  )
  let count = 0

  for (const [index, item] of ITEMS.entries()) {
    const id = seedProductId(item.slug)
    const variants: Prisma.InputJsonValue = { slug: item.slug }
    const tags = [SEED_TAG, item.slug]

    const marketplaceShipping = {
      shipsFrom: "EU",
      deliveryDays: 5,
      freeShipping: true,
      supplierTag: "seed",
      shippingCountry: "FR",
      warehouseType: "regional",
      deliveryMin: 3,
      deliveryMax: 5,
      freeShippingThreshold: new Prisma.Decimal("0.01"),
    } as const

    const slugGuess = categorySlug(item.category)
    const catRow =
      (await prisma.category.findFirst({
        where: {
          OR: [{ name: item.category }, { slug: slugGuess }],
        },
      })) ?? null

    const isPromoBucket = index % 4 === 0
    const compareAtUsd = isPromoBucket ? new Prisma.Decimal((item.priceEur * 1.22).toFixed(2)) : null

    await prisma.product.upsert({
      where: { id },
      create: {
        id,
        supplierId,
        name: item.name,
        description: item.description,
        images: [unsplash(item.photoId)],
        categories: [item.category],
        tags,
        basePriceCents: eurosToCents(item.priceEur),
        compareAt: compareAtUsd,
        commissionRate: 15,
        stock: 100,
        active: true,
        variants,
        categoryId: catRow?.id,
        style: STYLE_ROTATION[index % STYLE_ROTATION.length],
        shippingType: marketplaceShipping.freeShipping ? "free" : "standard",
        handlingDays: Math.max(1, Math.round(marketplaceShipping.deliveryMin / 3) || 1),
        isOnSale: isPromoBucket,
        isNewArrival: index >= ITEMS.length - 4,
        isBestSeller: index % 5 === 0,
        isRefurbished: index % 11 === 0,
        hasCoupon: index % 7 === 0,
        isEcoFriendly: index % 13 === 0,
        ...marketplaceShipping,
      },
      update: {
        name: item.name,
        description: item.description,
        images: [unsplash(item.photoId)],
        categories: [item.category],
        tags,
        basePriceCents: eurosToCents(item.priceEur),
        compareAt: compareAtUsd,
        commissionRate: 15,
        stock: 100,
        active: true,
        variants,
        categoryId: catRow?.id,
        style: STYLE_ROTATION[index % STYLE_ROTATION.length],
        shippingType: marketplaceShipping.freeShipping ? "free" : "standard",
        handlingDays: Math.max(1, Math.round(marketplaceShipping.deliveryMin / 3) || 1),
        isOnSale: isPromoBucket,
        isNewArrival: index >= ITEMS.length - 4,
        isBestSeller: index % 5 === 0,
        isRefurbished: index % 11 === 0,
        hasCoupon: index % 7 === 0,
        isEcoFriendly: index % 13 === 0,
        ...marketplaceShipping,
      },
    })

    const affiliateId =
      index < Math.floor(ITEMS.length / 2)
        ? affiliateIds[1 + (index % (affiliateIds.length - 1))]
        : affiliateIds[0]
    await prisma.affiliateProduct.upsert({
      where: {
        affiliateId_productId: {
          affiliateId,
          productId: id,
        },
      },
      create: {
        affiliateId,
        productId: id,
        sellingPriceCents: eurosToCents(item.priceEur),
        isListed: true,
        customTitle: null,
      },
      update: {
        sellingPriceCents: eurosToCents(item.priceEur),
        isListed: true,
      },
    })
    count++
  }

  console.log(`✅ ${count} produits ajoutés dans Neon`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
