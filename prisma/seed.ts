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

/** Example `CategoryAttribute` rows for a few leaf slugs (supplier “Characteristics” demo). */
async function seedSampleCategoryAttributes(): Promise<void> {
  const samples: {
    slug: string
    rows: Array<{
      key: string
      label: string
      type: string
      required: boolean
      order: number
      unit?: string | null
      options?: string[]
    }>
  }[] = [
    {
      slug: "electronics-audio-over-ear-headphones",
      rows: [
        { key: "brand", label: "Brand", type: "TEXT", required: true, order: 1 },
        { key: "model", label: "Model", type: "TEXT", required: true, order: 2 },
        {
          key: "connectivity",
          label: "Connectivity",
          type: "SELECT",
          required: true,
          order: 3,
          options: ["Bluetooth", "Wired", "Bluetooth + wired"],
        },
        {
          key: "noise_cancelling",
          label: "Noise cancelling",
          type: "SELECT",
          required: false,
          order: 4,
          options: ["Yes", "No"],
        },
        { key: "battery_hours", label: "Battery life", type: "NUMBER", unit: "h", required: false, order: 5 },
      ],
    },
    {
      slug: "home-kitchen-lighting-desk-lamps",
      rows: [
        { key: "brand", label: "Brand", type: "TEXT", required: true, order: 1 },
        { key: "wattage_max", label: "Max power", type: "NUMBER", unit: "W", required: false, order: 2 },
        {
          key: "bulb_type",
          label: "Bulb type",
          type: "SELECT",
          required: true,
          order: 3,
          options: ["LED", "Halogen", "CFL", "Smart"],
        },
        {
          key: "color_temperature",
          label: "Color temperature",
          type: "SELECT",
          required: false,
          order: 4,
          options: ["2700K", "4000K", "6500K", "Adjustable"],
        },
        {
          key: "warranty",
          label: "Warranty type",
          type: "SELECT",
          required: false,
          order: 5,
          options: ["1 year", "2 years", "5 years", "None"],
        },
      ],
    },
    {
      slug: "womens-wear-and-underwear-bags-and-handbags-tote-bags",
      rows: [
        { key: "brand", label: "Brand", type: "TEXT", required: true, order: 1 },
        { key: "material", label: "Material", type: "TEXT", required: false, order: 2 },
        { key: "dimensions_cm", label: "Dimensions (cm)", type: "TEXT", required: false, order: 3 },
      ],
    },
    {
      slug: "home-supplies-cleaning-supplies-descalers-appliance-care",
      rows: [
        { key: "brand", label: "Brand name", type: "TEXT", required: true, order: 1 },
        {
          key: "item_form",
          label: "Item form",
          type: "SELECT",
          required: true,
          order: 2,
          options: ["Liquid", "Powder", "Tablets", "Pods", "Spray", "Paste", "Wipes"],
        },
        { key: "scent", label: "Scent", type: "TEXT", required: false, order: 3 },
        {
          key: "specific_uses",
          label: "Specific uses for product",
          type: "MULTI_SELECT",
          required: false,
          order: 4,
          options: [
            "Coffee maker",
            "Kettle",
            "Washing machine",
            "Dishwasher",
            "Steam iron",
            "Humidifier",
            "Multipurpose",
          ],
        },
        {
          key: "material_features",
          label: "Material / composition highlights",
          type: "MULTI_SELECT",
          required: false,
          order: 5,
          options: ["Plant-based", "Biodegradable", "Concentrated", "Phosphate-free", "Chlorine-free"],
        },
        {
          key: "item_volume_ml",
          label: "Item volume",
          type: "NUMBER",
          unit: "ml",
          required: false,
          order: 6,
        },
        {
          key: "unit_count",
          label: "Unit count",
          type: "TEXT",
          required: false,
          order: 7,
          options: ["e.g. 500 ml × 1", "Lot de 8 × 96 ml"],
        },
        {
          key: "surface_recommendation",
          label: "Surface recommendation",
          type: "MULTI_SELECT",
          required: false,
          order: 8,
          options: ["Plastic", "Metal", "Stone", "Glass", "Rubber seals", "Internal machine parts"],
        },
        {
          key: "material_type_free",
          label: "Free of",
          type: "MULTI_SELECT",
          required: false,
          order: 9,
          options: ["BPA free", "Phthalate-free", "Fragrance-free", "Dye-free", "Eco-cert"],
        },
        {
          key: "special_features",
          label: "Special features",
          type: "TEXTAREA",
          required: false,
          order: 10,
          options: [],
        },
        {
          key: "recommended_retail_hint",
          label: "RRP / compare-at hint (display)",
          type: "TEXT",
          required: false,
          order: 11,
        },
      ],
    },
    {
      slug: "beauty-and-personal-care-skincare-face-serums",
      rows: [
        { key: "brand", label: "Brand name", type: "TEXT", required: true, order: 1 },
        {
          key: "item_form",
          label: "Item form",
          type: "SELECT",
          required: true,
          order: 2,
          options: ["Serum", "Ampoule", "Oil", "Essence", "Gel-serum"],
        },
        { key: "scent", label: "Scent / fragrance profile", type: "TEXT", required: false, order: 3 },
        {
          key: "specific_uses",
          label: "Primary concerns",
          type: "MULTI_SELECT",
          required: false,
          order: 4,
          options: [
            "Brightening",
            "Hydration",
            "Anti-aging",
            "Acne / blemishes",
            "Hyperpigmentation",
            "Barrier repair",
            "Pore care",
          ],
        },
        {
          key: "skin_type",
          label: "Skin type",
          type: "MULTI_SELECT",
          required: false,
          order: 5,
          options: ["Normal", "Dry", "Oily", "Combination", "Sensitive", "Mature"],
        },
        { key: "item_volume_ml", label: "Volume", type: "NUMBER", unit: "ml", required: false, order: 6 },
        {
          key: "active_highlights",
          label: "Key ingredients / actives",
          type: "TEXTAREA",
          required: false,
          order: 7,
        },
        {
          key: "sun_protection_level",
          label: "Bundled SPF (if any)",
          type: "SELECT",
          required: false,
          order: 8,
          options: ["None", "SPF 15", "SPF 30", "SPF 50+"],
        },
        {
          key: "clinical_claims",
          label: "Dermatologist-tested / hypoallergenic",
          type: "BOOLEAN",
          required: false,
          order: 9,
        },
      ],
    },
    {
      slug: "beauty-and-personal-care-skincare-face-creams",
      rows: [
        { key: "brand", label: "Brand name", type: "TEXT", required: true, order: 1 },
        {
          key: "item_form",
          label: "Item form",
          type: "SELECT",
          required: true,
          order: 2,
          options: ["Day cream", "Night cream", "Gel cream", "Balm", "Oil cream"],
        },
        { key: "scent", label: "Scent", type: "TEXT", required: false, order: 3 },
        {
          key: "skin_type",
          label: "Skin type",
          type: "MULTI_SELECT",
          required: false,
          order: 4,
          options: ["Normal", "Dry", "Oily", "Combination", "Sensitive"],
        },
        { key: "item_volume_ml", label: "Volume", type: "NUMBER", unit: "ml", required: false, order: 5 },
        {
          key: "specific_uses",
          label: "Concerns addressed",
          type: "MULTI_SELECT",
          required: false,
          order: 6,
          options: ["Hydration", "Anti-aging", "SPF daytime", "Rich night repair"],
        },
        {
          key: "material_type_free",
          label: "Free of",
          type: "MULTI_SELECT",
          required: false,
          order: 7,
          options: ["Fragrance-free", "Paraben-free", "Oil-free"],
        },
        { key: "special_features", label: "Formula notes", type: "TEXTAREA", required: false, order: 8 },
      ],
    },
  ]

  let count = 0
  for (const sample of samples) {
    const cat = await prisma.category.findUnique({ where: { slug: sample.slug } })
    if (!cat) continue
    await prisma.categoryAttribute.deleteMany({ where: { categoryId: cat.id } })
    await prisma.categoryAttribute.createMany({
      data: sample.rows.map((r) => ({
        categoryId: cat.id,
        key: r.key,
        label: r.label,
        type: r.type,
        required: r.required,
        order: r.order,
        unit: r.unit ?? null,
        options: r.options ?? [],
      })),
    })
    count += sample.rows.length
  }
  if (count > 0) {
    console.log(`✅ Seeded ${count} sample category attributes (demo leaf categories)`)
  }
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
  await seedSampleCategoryAttributes()

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
