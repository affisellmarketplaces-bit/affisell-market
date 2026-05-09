/**
 * Peuple Neon / Postgres avec la boutique « Boutique Affisell » et 18 produits de test.
 * `npx prisma db seed`
 */

import { createHash } from "node:crypto"

import { config } from "dotenv"
import { Prisma, PrismaClient } from "@prisma/client"

import {
  flattenMarketplaceCategoryTaxonomy,
  leafSlugsFromRows,
  SEED_PRODUCT_LEAF_BY_ITEM_SLUG,
  sortRowsForInsert,
} from "./marketplace-taxonomy-en"

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

const STYLE_ROTATION = ["minimalist", "vintage", "modern", "boho"] as const

/**
 * Removes every `Category` row (self-FK safe: delete leaves first).
 * Clears legacy `Subcategory` rows first so FKs stay valid.
 */
async function wipeMarketplaceCategories(): Promise<void> {
  await prisma.subcategory.deleteMany({})
  let total = 0
  let guard = 0
  for (;;) {
    const leaves = await prisma.category.findMany({
      where: { subcategories: { none: {} } },
      select: { id: true },
      take: 400,
    })
    if (leaves.length === 0) break
    const del = await prisma.category.deleteMany({
      where: { id: { in: leaves.map((l) => l.id) } },
    })
    total += del.count
    guard += 1
    if (guard > 1000) {
      throw new Error("Category wipe did not converge — check for cycles or orphan FKs")
    }
  }
  console.log(`🗑 Cleared ${total} category rows (tabular subcategories wiped)`)
}

async function upsertMarketplaceCategories(): Promise<void> {
  await wipeMarketplaceCategories()

  const flat = sortRowsForInsert(flattenMarketplaceCategoryTaxonomy())
  const idBySlug = new Map<string, string>()
  for (const row of flat) {
    const parentId = row.parentSlug ? idBySlug.get(row.parentSlug) ?? null : null
    if (row.parentSlug && parentId == null) {
      throw new Error(`Missing parent for category slug ${row.slug} (parent ${row.parentSlug})`)
    }
    const created = await prisma.category.create({
      data: {
        name: row.name,
        slug: row.slug.slice(0, 64),
        icon: row.icon,
        order: row.order,
        parentId,
      },
    })
    idBySlug.set(row.slug, created.id)
  }

  const total = await prisma.category.count()
  console.log(`✅ Seeded EN marketplace taxonomy (${total} category rows)`)
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

  const taxonomyRows = flattenMarketplaceCategoryTaxonomy()
  const allowedLeafSlugs = leafSlugsFromRows(taxonomyRows)
  for (const item of ITEMS) {
    const leaf = SEED_PRODUCT_LEAF_BY_ITEM_SLUG[item.slug]
    if (!leaf || !allowedLeafSlugs.has(leaf)) {
      console.error(`Unknown or invalid taxonomy leaf for product ${item.slug}: ${leaf ?? "(missing)"}`)
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

    const leafSlug = SEED_PRODUCT_LEAF_BY_ITEM_SLUG[item.slug]
    const catRow = leafSlug
      ? ((await prisma.category.findUnique({ where: { slug: leafSlug } })) ?? null)
      : null

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
