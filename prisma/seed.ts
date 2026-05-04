/**
 * Peuple Neon / Postgres avec la boutique « Boutique Affisell » et 18 produits de test.
 * `npx prisma db seed`
 */

import { createHash } from "node:crypto"

import { config } from "dotenv"
import { Prisma, PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const BOUTIQUE_SLUG = "boutique-affisell"
const BOUTIQUE_NAME = "Boutique Affisell"
const SEED_EMAIL = "seed-boutique-affisell@affisell.local"
const SEED_TAG = "seed-neon"

const CATS = ["Mode", "Maison", "Tech", "Beauté", "Sport"] as const

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

type SeedItem = {
  name: string
  slug: string
  description: string
  priceEur: number
  photoId: string
}

const ITEMS: SeedItem[] = [
  {
    name: "Sac bandoulière cuir",
    slug: "sac-bandouliere-cuir",
    description:
      "Sac en cuir pleine fleur avec bandoulière ajustable et poche zippée intérieure. Parfait pour le quotidien comme pour les sorties.",
    priceEur: 72.5,
    photoId: "photo-1590874103328-eac38a683ce7",
  },
  {
    name: "Montre connectée",
    slug: "montre-connectee",
    description:
      "Écran AMOLED, suivi du sommeil et du rythme cardiaque, étanche 5 ATM. Autonomie plusieurs jours selon l’usage.",
    priceEur: 84.99,
    photoId: "photo-1579586337278-3befd40fd17a",
  },
  {
    name: "Diffuseur huiles essentielles",
    slug: "diffuseur-huiles-essentielles",
    description:
      "Brumisation à froid, minuterie et arrêt automatique. Silencieux, idéal pour chambre ou bureau.",
    priceEur: 39.9,
    photoId: "photo-1608571423902-eed4a5ad8108",
  },
  {
    name: "Tapis yoga",
    slug: "tapis-yoga",
    description:
      "Surface antidérapante, épaisseur confortable pour les articulations. Facile à rouler et à transporter.",
    priceEur: 45.0,
    photoId: "photo-1601925260368-ae2f83cf8b7f",
  },
  {
    name: "Sérum anti-âge",
    slug: "serum-anti-age",
    description:
      "Formule concentrée en peptides et vitamine C pour lisser le grain de peau. Texture légère, absorption rapide.",
    priceEur: 52.0,
    photoId: "photo-1620916566398-39f1143ab7be",
  },
  {
    name: "Casque audio",
    slug: "casque-audio",
    description:
      "Son stéréo équilibré, arceau réglable et coussinets moelleux. Câble détachable pour usage nomade.",
    priceEur: 69.0,
    photoId: "photo-1505740420928-5e560c06d30e",
  },
  {
    name: "Gourde isotherme",
    slug: "gourde-isotherme",
    description:
      "Double paroi inox, conserve le froid ou le chaud pendant des heures. Bec verseur anti-fuite, 750 ml.",
    priceEur: 31.5,
    photoId: "photo-1602143407151-7111540de16e",
  },
  {
    name: "Lampe de chevet",
    slug: "lampe-chevet",
    description:
      "Lumière tamisée réglable, base stable en bois. Interrupteur tactile sur le pied, design minimaliste.",
    priceEur: 42.0,
    photoId: "photo-1507473885765-e6ed057f782c",
  },
  {
    name: "Crème mains",
    slug: "creme-mains",
    description:
      "Beurre de karité et glycérine pour réparer les peaux sèches. Tube pratique, parfum discret fleuri.",
    priceEur: 19.99,
    photoId: "photo-1556228578-0d85b1a4d571",
  },
  {
    name: "Basket running",
    slug: "basket-running",
    description:
      "Semelle amortissante et mesh respirant pour la route ou le tapis. Maintien du pied renforcé au talon.",
    priceEur: 89.99,
    photoId: "photo-1542291026-7eec264c27ff",
  },
  {
    name: "Lunettes de soleil polarisées",
    slug: "lunettes-soleil-polarisees",
    description:
      "Verres polarisés anti-reflets, monture légère en métal. Étui rigide et chiffon microfibre inclus.",
    priceEur: 48.0,
    photoId: "photo-1572635196237-14b3f281503f",
  },
  {
    name: "Parfum mixte 50 ml",
    slug: "parfum-mixte-50ml",
    description:
      "Notes boisées et agrumes pour une signature élégante. Flacon vaporisateur, tenue longue durée sur la peau.",
    priceEur: 59.0,
    photoId: "photo-1541643600914-78b084683601",
  },
  {
    name: "Housse de couette coton",
    slug: "housse-couette-coton",
    description:
      "Percale 100 % coton, fermeture par boutons ou zip selon modèle. Teintes naturelles, respirant toute saison.",
    priceEur: 64.0,
    photoId: "photo-1584100936591-c59d91143a14",
  },
  {
    name: "Enceinte Bluetooth waterproof",
    slug: "enceinte-bluetooth-waterproof",
    description:
      "Certification IPX7, accroche mousqueton pour outdoor. Basses renforcées, autonomie jusqu’à 12 h.",
    priceEur: 55.0,
    photoId: "photo-1608043152269-423dbba4e7e2",
  },
  {
    name: "Kit résistances fitness",
    slug: "kit-resistances-fitness",
    description:
      "Bandes élastiques graduées en résistance, poignées confortables. Guide d’exercices imprimé fourni.",
    priceEur: 28.9,
    photoId: "photo-1571019613454-1cb2f99b2d8b",
  },
  {
    name: "Huile à barbe",
    slug: "huile-barbe",
    description:
      "Mélange d’huiles végétales et vitamine E pour adoucir et discipliner la barbe. Flacon compte-gouttes.",
    priceEur: 24.5,
    photoId: "photo-1621607512214-703b1a6e432a",
  },
  {
    name: "Chaise de plage pliable",
    slug: "chaise-plage-pliable",
    description:
      "Structure aluminium, toile résistante UV. Pliage compact, sac de transport inclus pour les escapades.",
    priceEur: 49.99,
    photoId: "photo-1504280390367-361c6d9f38f4",
  },
  {
    name: "Stylo connecté",
    slug: "stylo-connecte",
    description:
      "Synchronise vos notes manuscrites vers l’application mobile. Recharge USB-C, autonomie plusieurs jours.",
    priceEur: 76.0,
    photoId: "photo-1517842645767-c96b00f050e7",
  },
]

async function ensureBoutique(): Promise<string> {
  const bySlug = await prisma.store.findUnique({ where: { slug: BOUTIQUE_SLUG } })
  if (bySlug) return bySlug.userId

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: {
      email: SEED_EMAIL,
      name: BOUTIQUE_NAME,
      role: "SUPPLIER",
    },
    update: { name: BOUTIQUE_NAME, role: "SUPPLIER" },
  })

  const byUser = await prisma.store.findUnique({ where: { userId: user.id } })
  if (byUser) {
    if (byUser.slug !== BOUTIQUE_SLUG) {
      try {
        await prisma.store.update({
          where: { id: byUser.id },
          data: { name: BOUTIQUE_NAME, slug: BOUTIQUE_SLUG },
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
      name: BOUTIQUE_NAME,
      slug: BOUTIQUE_SLUG,
    },
  })

  return user.id
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL manquant (.env.local ou .env).")
    process.exit(1)
  }

  const supplierId = await ensureBoutique()
  let count = 0

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i]!
    const cat = CATS[i % CATS.length]!
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

    await prisma.product.upsert({
      where: { id },
      create: {
        id,
        supplierId,
        name: item.name,
        description: item.description,
        images: [unsplash(item.photoId)],
        categories: [cat],
        tags,
        basePriceCents: eurosToCents(item.priceEur),
        commissionRate: 15,
        stock: 100,
        active: true,
        variants,
        ...marketplaceShipping,
      },
      update: {
        name: item.name,
        description: item.description,
        images: [unsplash(item.photoId)],
        categories: [cat],
        tags,
        basePriceCents: eurosToCents(item.priceEur),
        commissionRate: 15,
        stock: 100,
        active: true,
        variants,
        ...marketplaceShipping,
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
