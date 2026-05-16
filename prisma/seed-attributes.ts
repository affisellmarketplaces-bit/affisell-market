/**
 * Seed Amazon-style category attributes (SELECT / BOOLEAN) for mobile taxonomy leaves.
 * Run: npx tsx prisma/seed-attributes.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SMARTPHONE_ATTRS = [
  {
    key: "brand",
    label: "Marque",
    type: "SELECT",
    required: true,
    options: ["Apple", "Samsung", "Xiaomi", "Google", "OnePlus", "Huawei"],
    order: 1,
    aiSuggest: false,
  },
  {
    key: "storage_gb",
    label: "Stockage",
    type: "SELECT",
    required: true,
    options: ["64", "128", "256", "512", "1024"],
    order: 2,
    aiSuggest: false,
  },
  {
    key: "color",
    label: "Couleur",
    type: "SELECT",
    required: false,
    options: ["Noir", "Blanc", "Bleu", "Titane", "Rose", "Vert"],
    order: 3,
    aiSuggest: true,
  },
  {
    key: "dual_sim",
    label: "Double SIM",
    type: "BOOLEAN",
    required: false,
    order: 4,
    aiSuggest: true,
  },
  {
    key: "operating_system",
    label: "Système",
    type: "SELECT",
    required: true,
    options: ["iOS", "Android"],
    order: 5,
    aiSuggest: false,
  },
  {
    key: "network",
    label: "Réseau",
    type: "SELECT",
    required: false,
    options: ["4G", "5G"],
    order: 6,
    aiSuggest: true,
  },
] as const

async function findSmartphoneCategory() {
  return prisma.category.findFirst({
    where: {
      isLeaf: true,
      OR: [
        { slug: "electronics-cell-phones-accessories" },
        { slug: "cell-phones" },
        { slug: "smartphones" },
        { name: { contains: "Smartphone", mode: "insensitive" } },
        { name: { contains: "téléphones mobiles", mode: "insensitive" } },
        { name: { equals: "Cell Phones & Accessories", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  })
}

async function main() {
  const cat = await findSmartphoneCategory()
  if (!cat) {
    console.log("No smartphone / cell-phone leaf category found — import taxonomy first.")
    return
  }

  console.log(`Seeding attributes for: ${cat.name} (${cat.slug})`)

  for (const attr of SMARTPHONE_ATTRS) {
    await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: cat.id, key: attr.key } },
      create: {
        categoryId: cat.id,
        key: attr.key,
        label: attr.label,
        type: attr.type,
        required: attr.required,
        options: [...attr.options],
        order: attr.order,
        aiSuggest: attr.aiSuggest,
        showInFilter: true,
      },
      update: {
        label: attr.label,
        type: attr.type,
        required: attr.required,
        options: [...attr.options],
        order: attr.order,
        aiSuggest: attr.aiSuggest,
      },
    })
  }

  console.log(`✅ Upserted ${SMARTPHONE_ATTRS.length} attributes on category ${cat.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
