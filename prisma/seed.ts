/**
 * Seed 15 marketplace-style products (French copy).
 * Run: npx prisma db seed
 */

import { PrismaClient, type Prisma } from "@prisma/client"

const prisma = new PrismaClient()

const SEED_SUPPLIER_EMAIL = "seed-boutique-test@affisell.local"

const CATS = ["Fashion", "Home", "Tech", "Beauty"] as const

function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

function unsplash(path: string): string {
  return `https://images.unsplash.com/${path}?w=800&q=80`
}

type SeedItem = {
  name: string
  slug: string
  description: string
  priceEur: number
  imagePath: string
}

const ITEMS: SeedItem[] = [
  {
    name: "Sac à main cuir",
    slug: "sac-a-main-cuir",
    description: "Sac structuré en cuir véritable, bandoulière ajustable. Idéal jour & soirée.",
    priceEur: 64.99,
    imagePath: "photo-1590874103328-eac38a683ce7",
  },
  {
    name: "Montre minimaliste",
    slug: "montre-minimaliste",
    description: "Boîtier fin, bracelet mesh : look épuré pour le quotidien.",
    priceEur: 49.5,
    imagePath: "photo-1524592094714-0f0654e20314",
  },
  {
    name: "Bougie parfumée",
    slug: "bougie-parfumee",
    description: "Cire végétale, senteur vanille & figue. Brûle jusqu’à 45 h.",
    priceEur: 24.9,
    imagePath: "photo-1602600839334-199fe60f8f25",
  },
  {
    name: "Casque Bluetooth",
    slug: "casque-bluetooth",
    description: "Réduction de bruit, autonomie 30 h. Pliable pour le transport.",
    priceEur: 79.99,
    imagePath: "photo-1505740420928-5e560c06d30e",
  },
  {
    name: "Lampe de bureau LED",
    slug: "lampe-bureau-led",
    description: "Lumière réglable, port USB intégré. Design scandinave.",
    priceEur: 36.0,
    imagePath: "photo-1507473885765-e6ed057f782c",
  },
  {
    name: "T-shirt coton bio",
    slug: "t-shirt-coton-bio",
    description: "Coupe regular, tissu doux certifié. Plusieurs coloris.",
    priceEur: 29.99,
    imagePath: "photo-1521572163474-6864f9cf17ab",
  },
  {
    name: "Bouteille isotherme",
    slug: "bouteille-isotherme",
    description: "Garde 12 h chaud / 24 h froid. Inox 500 ml, anti-fuite.",
    priceEur: 32.5,
    imagePath: "photo-1602143407151-7111540de16e",
  },
  {
    name: "Chargeur sans fil",
    slug: "chargeur-sans-fil",
    description: "15 W compatible Qi. Surface antidérapante, compact.",
    priceEur: 27.9,
    imagePath: "photo-1586953208448-b95a79798f07",
  },
  {
    name: "Trousse maquillage",
    slug: "trousse-maquillage",
    description: "Compartiments multiples, fermeture zip métal. Format voyage.",
    priceEur: 19.99,
    imagePath: "photo-1596462502278-27bfdc403348",
  },
  {
    name: "Oreiller mémoire de forme",
    slug: "oreiller-memoire-forme",
    description: "Soutien cervical, housse hypoallergénique lavable.",
    priceEur: 54.0,
    imagePath: "photo-1584100936591-c59d91143a14",
  },
  {
    name: "Enceinte portable",
    slug: "enceinte-portable",
    description: "Bluetooth 5.3, basses renforcées. Étanche IPX6.",
    priceEur: 45.0,
    imagePath: "photo-1608043152269-423dbba4e7e2",
  },
  {
    name: "Set de couteaux cuisine",
    slug: "set-couteaux-cuisine",
    description: "5 pièces acier inox, bloc bois. Affûtage précis.",
    priceEur: 69.0,
    imagePath: "photo-1593618998160-e34014e67546",
  },
  {
    name: "Masque visage hydratant",
    slug: "masque-visage-hydratant",
    description: "Texture gel-crème, acide hyaluronique. Lot de 6 sachets.",
    priceEur: 22.5,
    imagePath: "photo-1556228578-0d85b1a4d571",
  },
  {
    name: "Sac à dos urbain",
    slug: "sac-a-dos-urbain",
    description: "Compartiment laptop 15\", dos matelassé, toile résistante.",
    priceEur: 59.99,
    imagePath: "photo-1622560480605-d83c853bc5c3",
  },
  {
    name: "Montre connectée",
    slug: "montre-connectee",
    description: "Suivi activité, SpO2, notifications. Bracelet silicone.",
    priceEur: 89.99,
    imagePath: "photo-1579586337278-3befd40fd17a",
  },
]

async function resolveSupplierId(): Promise<string> {
  let store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } })

  if (!store) {
    let user = await prisma.user.findUnique({ where: { email: SEED_SUPPLIER_EMAIL } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: SEED_SUPPLIER_EMAIL,
          name: "Boutique Test",
          role: "SUPPLIER",
        },
      })
    }

    store = await prisma.store.findUnique({ where: { userId: user.id } })
    if (!store) {
      store = await prisma.store.create({
        data: {
          userId: user.id,
          name: "Boutique Test",
          slug: `boutique-test-seed-${Date.now()}`,
        },
      })
    }
  }

  return store.userId
}

async function main() {
  const supplierId = await resolveSupplierId()

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i]!
    const category = CATS[i % CATS.length]!
    const variants: Prisma.InputJsonValue = { slug: item.slug }

    await prisma.product.create({
      data: {
        supplierId,
        name: item.name,
        description: item.description,
        images: [unsplash(item.imagePath)],
        categories: [category],
        basePriceCents: eurosToCents(item.priceEur),
        commissionRate: 15,
        stock: 50,
        active: true,
        variants,
      },
    })
  }

  console.log("✅ 15 produits ajoutés")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
