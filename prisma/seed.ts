import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

type Cat = { name: string; slug: string; children?: Cat[]; specs?: string[] }

const TAXONOMY: Cat[] = [
  {
    name: "Électronique",
    slug: "electronique",
    children: [
      {
        name: "Smartphones & Objets connectés",
        slug: "smartphones",
        children: [
          {
            name: "Smartphones",
            slug: "smartphones-apple-android",
            specs: ["Marque", "Stockage", "RAM", "Couleur", "5G"],
          },
          {
            name: "Montres connectées",
            slug: "montres-connectees",
            specs: ["Marque", "Taille boîtier", "Couleur", "GPS"],
          },
        ],
      },
      {
        name: "Audio",
        slug: "audio",
        children: [
          {
            name: "Casques",
            slug: "casques",
            specs: ["Type", "Bluetooth", "Réduction de bruit"],
          },
        ],
      },
    ],
  },
  {
    name: "Mode",
    slug: "mode",
    children: [
      {
        name: "Femme",
        slug: "femme",
        children: [
          { name: "Robes", slug: "robes-femme", specs: ["Taille", "Couleur", "Matière"] },
          { name: "Chaussures", slug: "chaussures-femme", specs: ["Pointure", "Couleur", "Matière"] },
        ],
      },
      {
        name: "Homme",
        slug: "homme",
        children: [
          { name: "T-shirts", slug: "tshirts-homme", specs: ["Taille", "Couleur", "Matière"] },
        ],
      },
    ],
  },
  {
    name: "Maison",
    slug: "maison",
    children: [
      {
        name: "Mobilier",
        slug: "mobilier",
        children: [{ name: "Canapés", slug: "canapes", specs: ["Places", "Matière", "Couleur"] }],
      },
    ],
  },
]

async function createCategories(cats: Cat[], parentId: string | null = null) {
  for (const cat of cats) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        parentId,
        isLeaf: !cat.children || cat.children.length === 0,
        specs: cat.specs || [],
      },
    })
    if (cat.children) await createCategories(cat.children, created.id)
  }
}

async function main() {
  console.log("🗑️ Wipe data...")
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()

  console.log("👤 Create users...")
  const password = await hash("password123", 10)
  await prisma.user.create({
    data: {
      email: "admin@affisell.io",
      name: "Admin",
      password,
      role: "ADMIN",
    },
  })
  await prisma.user.create({
    data: {
      email: "fournisseur@affisell.io",
      name: "Fournisseur",
      password,
      role: "SUPPLIER",
    },
  })

  console.log("🌳 Create taxonomy...")
  await createCategories(TAXONOMY)

  const count = await prisma.category.count()
  console.log(`✅ ${count} catégories créées avec specs`)
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
