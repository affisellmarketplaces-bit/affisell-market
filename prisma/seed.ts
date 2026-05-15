/**
 * Seed Affisell : 8 catégories, 30 produits (2 images chacun : Unsplash + Picsum), 2 fournisseurs, 1 affilié, 1 admin.
 * `npx prisma db seed`
 *
 * Charge `.env` / `.env.local` pour `DATABASE_URL`.
 */

import { config } from "dotenv"
import { hash } from "bcryptjs"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const CATEGORIES = [
  { name: "Électronique", slug: "electronique", icon: "📱" },
  { name: "Mode", slug: "mode", icon: "👗" },
  { name: "Maison & Jardin", slug: "maison-jardin", icon: "🏠" },
  { name: "Beauté & Santé", slug: "beaute-sante", icon: "✨" },
  { name: "Sports & Loisirs", slug: "sports-loisirs", icon: "⚽" },
  { name: "Informatique", slug: "informatique", icon: "💻" },
  { name: "Bébé & Puériculture", slug: "bebe-puericulture", icon: "🍼" },
  { name: "Auto & Moto", slug: "auto-moto", icon: "🚗" },
] as const

const PRODUCTS = [
  { name: "iPhone 15 Pro Max", priceEur: 1479, cat: 0, img: "iphone-15" },
  { name: "MacBook Air M3", priceEur: 1299, cat: 5, img: "macbook-air" },
  { name: "AirPods Pro 2", priceEur: 279, cat: 0, img: "airpods" },
  { name: "Sony WH-1000XM5", priceEur: 399, cat: 0, img: "headphones" },
  { name: "Dyson V15 Detect", priceEur: 749, cat: 2, img: "vacuum-cleaner" },
  { name: "PS5 Slim", priceEur: 549, cat: 0, img: "playstation-5" },
  { name: "Nike Air Max 270", priceEur: 160, cat: 1, img: "nike-sneakers" },
  { name: "Adidas Ultraboost 22", priceEur: 190, cat: 1, img: "running-shoes" },
  { name: "Levis 501 Jeans", priceEur: 110, cat: 1, img: "jeans" },
  { name: "North Face Nuptse", priceEur: 320, cat: 1, img: "winter-jacket" },
  { name: "Ray-Ban Aviator", priceEur: 180, cat: 1, img: "sunglasses" },
  { name: "Canapé IKEA Klippan", priceEur: 299, cat: 2, img: "sofa" },
  { name: "Lampe Philips Hue", priceEur: 89, cat: 2, img: "smart-lamp" },
  { name: "Aspirateur Roborock S8", priceEur: 599, cat: 2, img: "robot-vacuum" },
  { name: "Machine Nespresso Vertuo", priceEur: 149, cat: 2, img: "coffee-machine" },
  { name: "Tapis Beni Ouarain", priceEur: 450, cat: 2, img: "moroccan-rug" },
  { name: "Crème La Roche-Posay", priceEur: 25, cat: 3, img: "skincare" },
  { name: "Parfum Dior Sauvage", priceEur: 110, cat: 3, img: "perfume-bottle" },
  { name: "Brosse Dyson Airwrap", priceEur: 549, cat: 3, img: "hair-styler" },
  { name: "Vélo VanMoof S5", priceEur: 2498, cat: 4, img: "electric-bike" },
  { name: "Tapis Yoga Lululemon", priceEur: 88, cat: 4, img: "yoga-mat" },
  { name: "Chaussures Salomon XT-6", priceEur: 180, cat: 4, img: "hiking-shoes" },
  { name: "Logitech MX Master 3S", priceEur: 115, cat: 5, img: "computer-mouse" },
  { name: "Clavier Keychron K2", priceEur: 89, cat: 5, img: "mechanical-keyboard" },
  { name: "Ecran LG 27 4K", priceEur: 349, cat: 5, img: "4k-monitor" },
  { name: "Poussette Babyzen Yoyo", priceEur: 479, cat: 6, img: "baby-stroller" },
  { name: "Siège Auto Cybex", priceEur: 350, cat: 6, img: "car-seat" },
  { name: "Casque Moto Shoei", priceEur: 650, cat: 7, img: "motorcycle-helmet" },
  { name: "Gants Alpinestars", priceEur: 120, cat: 7, img: "motorcycle-gloves" },
  { name: "Chargeur Tesla Wall", priceEur: 500, cat: 7, img: "ev-charger" },
] as const

function eurosToCents(eur: number): number {
  return Math.round(eur * 100)
}

function productSlug(name: string, index: number): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
  return `${base}-${index}`.slice(0, 64)
}

function imageUrls(img: string, i: number): [string, string] {
  return [
    `https://source.unsplash.com/800x800/?${encodeURIComponent(img)}`,
    `https://picsum.photos/seed/affisell${i}/800/800`,
  ]
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
      where: { subcategories: { none: {} } },
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
  console.log("🌱 Seeding Affisell (30 produits + photos, 8 catégories, users démo)…")
  await wipeMarketplaceData()

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
  await prisma.user.create({
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

  const cats = await Promise.all(
    CATEGORIES.map((c, order) =>
      prisma.category.create({
        data: { name: c.name, slug: c.slug, icon: c.icon, order },
      })
    )
  )

  await Promise.all(
    PRODUCTS.map((p, i) => {
      const basePriceCents = eurosToCents(p.priceEur)
      const commissionRate = Math.floor(Math.random() * 15) + 15
      const [a, b] = imageUrls(p.img, i)
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
          categoryId: cats[p.cat]!.id,
          supplierId: i % 2 === 0 ? f1.id : f2.id,
          supplierTag: "seed-affisell-30",
          shipsFrom: "EU",
          deliveryDays: 3,
          freeShipping: p.priceEur >= 50,
        },
      })
    })
  )

  console.log("✅ 30 produits + 8 catégories + users démo créés.")
  console.log("👤 Connexion admin : admin@affisell.io / password123")
  console.log("👤 Fournisseurs : fournisseur1@affisell.io | fournisseur2@affisell.io / password123")
  console.log("👤 Affilié : vendeur@affisell.io / password123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
