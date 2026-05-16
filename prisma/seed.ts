/**
 * Seed Affisell : taxonomie **Google Product Taxonomy (fr-FR)** complète (~5,5k nœuds),
 * 30 produits sur feuilles Google, 2 photos (Unsplash + Picsum), **listings** `AffiliateProduct` pour la vitrine.
 * `npx prisma db seed`
 *
 * Fichier source : `prisma/taxonomy-fr.txt` (télécharger avec curl si absent).
 * Charge `.env` / `.env.local` pour `DATABASE_URL`.
 */

import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { config } from "dotenv"
import { hash } from "bcryptjs"
import { PrismaClient } from "@prisma/client"

import { clearCategoryBrowseCache } from "@/lib/product-auto-categorize"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const PRODUCTS = [
  { name: "iPhone 15 Pro Max", priceEur: 1479, img: "iphone-15" },
  { name: "MacBook Air M3", priceEur: 1299, img: "macbook-air" },
  { name: "AirPods Pro 2", priceEur: 279, img: "airpods" },
  { name: "Sony WH-1000XM5", priceEur: 399, img: "headphones" },
  { name: "Dyson V15 Detect", priceEur: 749, img: "vacuum-cleaner" },
  { name: "PS5 Slim", priceEur: 549, img: "playstation-5" },
  { name: "Nike Air Max 270", priceEur: 160, img: "nike-sneakers" },
  { name: "Adidas Ultraboost 22", priceEur: 190, img: "running-shoes" },
  { name: "Levis 501 Jeans", priceEur: 110, img: "jeans" },
  { name: "North Face Nuptse", priceEur: 320, img: "winter-jacket" },
  { name: "Ray-Ban Aviator", priceEur: 180, img: "sunglasses" },
  { name: "Canapé IKEA Klippan", priceEur: 299, img: "sofa" },
  { name: "Lampe Philips Hue", priceEur: 89, img: "smart-lamp" },
  { name: "Aspirateur Roborock S8", priceEur: 599, img: "robot-vacuum" },
  { name: "Machine Nespresso Vertuo", priceEur: 149, img: "coffee-machine" },
  { name: "Tapis Beni Ouarain", priceEur: 450, img: "moroccan-rug" },
  { name: "Crème La Roche-Posay", priceEur: 25, img: "skincare" },
  { name: "Parfum Dior Sauvage", priceEur: 110, img: "perfume-bottle" },
  { name: "Brosse Dyson Airwrap", priceEur: 549, img: "hair-styler" },
  { name: "Vélo VanMoof S5", priceEur: 2498, img: "electric-bike" },
  { name: "Tapis Yoga Lululemon", priceEur: 88, img: "yoga-mat" },
  { name: "Chaussures Salomon XT-6", priceEur: 180, img: "hiking-shoes" },
  { name: "Logitech MX Master 3S", priceEur: 115, img: "computer-mouse" },
  { name: "Clavier Keychron K2", priceEur: 89, img: "mechanical-keyboard" },
  { name: "Ecran LG 27 4K", priceEur: 349, img: "4k-monitor" },
  { name: "Poussette Babyzen Yoyo", priceEur: 479, img: "baby-stroller" },
  { name: "Siège Auto Cybex", priceEur: 350, img: "car-seat" },
  { name: "Casque Moto Shoei", priceEur: 650, img: "motorcycle-helmet" },
  { name: "Gants Alpinestars", priceEur: 120, img: "motorcycle-gloves" },
  { name: "Chargeur Tesla Wall", priceEur: 500, img: "ev-charger" },
] as const

function eurosToCents(eur: number): number {
  return Math.round(eur * 100)
}

function imageUrls(img: string, i: number): [string, string] {
  return [
    `https://source.unsplash.com/800x800/?${encodeURIComponent(img)}`,
    `https://picsum.photos/seed/affisell${i}/800/800`,
  ]
}

function slugFromGoogleLeaf(name: string, googleId: number): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  const suffix = `-${googleId}`
  const max = 190
  const trimmed = base.length + suffix.length > max ? base.slice(0, Math.max(1, max - suffix.length)) : base
  return `${trimmed}${suffix}`
}

type TaxonomyRow = {
  id: string
  googleId: number
  name: string
  slug: string
  parentId: string | null
  level: number
  fullPath: string
}

async function seedGoogleTaxonomyFr(): Promise<void> {
  console.log("🌱 Import Google Product Taxonomy (fr-FR)…")

  const filePath = path.join(process.cwd(), "prisma", "taxonomy-fr.txt")
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Run: curl -fsSL -o prisma/taxonomy-fr.txt https://www.google.com/basepages/producttype/taxonomy-with-ids.fr-FR.txt`
    )
  }

  const raw = fs.readFileSync(filePath, "utf-8")
  const lines = raw.split(/\r?\n/)

  type Parsed = {
    googleId: number
    fullPath: string
    parts: string[]
    level: number
    parentPath: string | null
    name: string
  }

  const parsed: Parsed[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const sep = " - "
    const i = t.indexOf(sep)
    if (i === -1) continue
    const idStr = t.slice(0, i).trim()
    const fullPath = t.slice(i + sep.length).trim()
    const googleId = Number.parseInt(idStr, 10)
    if (!Number.isFinite(googleId) || !fullPath) continue
    const parts = fullPath.split(" > ").map((p) => p.trim())
    if (parts.length === 0 || parts.some((p) => !p)) continue
    const name = parts[parts.length - 1]!
    const level = parts.length
    const parentPath = level > 1 ? parts.slice(0, -1).join(" > ") : null
    parsed.push({ googleId, fullPath, parts, level, parentPath, name })
  }

  parsed.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    return a.fullPath.localeCompare(b.fullPath, "fr")
  })

  const idByPath = new Map<string, string>()
  const rows: TaxonomyRow[] = []

  for (const p of parsed) {
    const parentId = p.parentPath ? idByPath.get(p.parentPath) ?? null : null
    if (p.parentPath && parentId == null) {
      throw new Error(`Taxonomie invalide : parent introuvable pour « ${p.fullPath} » (attendu « ${p.parentPath} »).`)
    }
    const id = randomUUID()
    idByPath.set(p.fullPath, id)
    rows.push({
      id,
      googleId: p.googleId,
      name: p.name,
      slug: slugFromGoogleLeaf(p.name, p.googleId),
      parentId,
      level: p.level,
      fullPath: p.fullPath,
    })
  }

  const BATCH = 400
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await prisma.category.createMany({
      data: batch.map((r) => ({
        id: r.id,
        googleId: r.googleId,
        name: r.name,
        slug: r.slug,
        parentId: r.parentId,
        level: r.level,
        fullPath: r.fullPath,
        isLeaf: true,
        order: r.googleId,
      })),
    })
    inserted += batch.length
    if (inserted % 2000 === 0) console.log(`   … ${inserted} lignes insérées`)
  }

  const parentIds = new Set<string>()
  for (const r of rows) {
    if (r.parentId) parentIds.add(r.parentId)
  }
  if (parentIds.size > 0) {
    await prisma.category.updateMany({
      where: { id: { in: [...parentIds] } },
      data: { isLeaf: false },
    })
  }

  const maxLevel = await prisma.category.aggregate({ _max: { level: true } })
  const leafCount = await prisma.category.count({ where: { isLeaf: true } })
  console.log(`✅ ${inserted} catégories Google importées`)
  console.log(`📊 Niveau max: ${maxLevel._max.level ?? "—"}`)
  console.log(`📁 Feuilles: ${leafCount}`)
}

/** Vide les données métier (garde `_prisma_migrations`). Ordre respectant les FK Prisma. */
async function wipeMarketplaceData(): Promise<void> {
  await prisma.merchantPayoutLedger.deleteMany()
  await prisma.blindDropshipOrderItem.deleteMany()
  await prisma.blindDropshipOrder.deleteMany()
  await prisma.orderReturn.deleteMany()
  await prisma.buyerRewardLedger.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.affiliateProduct.deleteMany()
  await prisma.blindDropshipSupplier.deleteMany()
  await prisma.wishlist.deleteMany()
  await prisma.review.deleteMany()
  await prisma.productAttribute.deleteMany()
  await prisma.productReview.deleteMany()
  await prisma.product.deleteMany()
  await prisma.communityPost.deleteMany()
  await prisma.follow.deleteMany()
  await prisma.store.deleteMany()
  await prisma.categoryAttribute.deleteMany()
  await prisma.subcategory.deleteMany()

  let guard = 0
  for (;;) {
    const leaves = await prisma.category.findMany({
      where: { children: { none: {} } },
      select: { id: true },
      take: 500,
    })
    if (leaves.length === 0) break
    await prisma.category.deleteMany({ where: { id: { in: leaves.map((l) => l.id) } } })
    guard += 1
    if (guard > 500) throw new Error("Category wipe did not converge")
  }

  await prisma.supplierIntegration.deleteMany()
  await prisma.searchHistory.deleteMany()
  await prisma.affisellTrackEvent.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
}

async function main(): Promise<void> {
  console.log("🌱 Seeding Affisell (taxonomie Google FR + 30 produits, listings affiliés)…")
  await wipeMarketplaceData()
  await seedGoogleTaxonomyFr()

  const leafCategories = await prisma.category.findMany({
    where: { isLeaf: true },
    select: { id: true },
    orderBy: { googleId: "asc" },
  })
  if (leafCategories.length === 0) {
    throw new Error("No leaf categories after Google taxonomy import.")
  }

  const password = await hash("password123", 10)

  const f1 = await prisma.user.create({
    data: {
      email: "fournisseur1@affisell.io",
      name: "Fournisseur Tech",
      password,
      role: "SUPPLIER",
    },
  })
  const f2 = await prisma.user.create({
    data: {
      email: "fournisseur2@affisell.io",
      name: "Fournisseur Mode",
      password,
      role: "SUPPLIER",
    },
  })
  const vendeur = await prisma.user.create({
    data: {
      email: "vendeur@affisell.io",
      name: "Vendeur Pro",
      password,
      role: "AFFILIATE",
    },
  })
  await prisma.user.create({
    data: {
      email: "admin@affisell.io",
      name: "Admin",
      password,
      role: "ADMIN",
    },
  })

  await prisma.store.create({
    data: {
      userId: vendeur.id,
      name: "Boutique Affisell Live",
      slug: "boutique-affisell-live",
      description:
        "Vitrine démo : taxonomie Google FR, prix publics dynamiques, récompenses acheteurs compatibles Affisell.",
      isLive: true,
    },
  })

  const createdProducts = await Promise.all(
    PRODUCTS.map(async (p, i) => {
      const basePriceCents = eurosToCents(p.priceEur)
      const commissionRate = Math.floor(Math.random() * 15) + 15
      const [a, b] = imageUrls(p.img, i)
      const leaf = leafCategories[(i * 7919) % leafCategories.length]!

      return prisma.product.create({
        data: {
          name: p.name,
          description: `${p.name} — Produit premium Affisell (seed). Livraison indicative 48h.`,
          descriptionBullets: ["Garantie satisfaction", "Expédition soignée", "Support Affisell"],
          basePriceCents,
          commissionRate,
          stock: Math.floor(Math.random() * 80) + 20,
          images: [a, b],
          active: true,
          isDraft: false,
          listingKind: "PHYSICAL",
          categoryId: leaf.id,
          supplierId: i % 2 === 0 ? f1.id : f2.id,
          supplierTag: "seed-affisell-30",
          shipsFrom: "EU",
          deliveryDays: 3,
          freeShipping: p.priceEur >= 50,
          isNewArrival: i % 5 === 0,
          isBestSeller: i % 7 === 0,
          isOnSale: i % 9 === 0,
        },
      })
    })
  )

  for (let i = 0; i < createdProducts.length; i++) {
    const p = createdProducts[i]!
    const markupPct = 20 + (i % 15)
    const sellingPriceCents = Math.round(p.basePriceCents * (1 + markupPct / 100))
    await prisma.affiliateProduct.create({
      data: {
        affiliateId: vendeur.id,
        productId: p.id,
        sellingPriceCents,
        isListed: true,
        isFeatured: i % 6 === 0,
        position: i,
        buyerRewardKind: i % 8 === 0 ? "CASHBACK" : "NONE",
        buyerRewardPercent: i % 8 === 0 ? Math.min(8, p.commissionRate - 1) : 0,
      },
    })
  }

  clearCategoryBrowseCache()

  console.log("✅ Taxonomie Google FR + 30 produits (feuilles), listings affiliés « Boutique Affisell Live ».")
  console.log("👤 Admin : admin@affisell.io / password123")
  console.log("👤 Fournisseurs : fournisseur1@affisell.io | fournisseur2@affisell.io / password123")
  console.log("👤 Affilié + store : vendeur@affisell.io / password123 → /store/boutique-affisell-live")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
