/**
 * Link existing products to categories by name keywords (`Product.name`, not `title`).
 *   npx tsx prisma/link-products.ts
 */

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  const electronics = await prisma.category.findUnique({ where: { slug: "electronics" } })
  const home = await prisma.category.findUnique({ where: { slug: "home-kitchen" } })
  const beauty = await prisma.category.findUnique({ where: { slug: "beauty" } })

  if (!electronics || !home || !beauty) {
    throw new Error("Missing categories — run `npx tsx prisma/seed-categories.ts` first.")
  }

  const ins = { mode: "insensitive" as const }

  await prisma.product.updateMany({
    where: { name: { contains: "Keyboard", ...ins } },
    data: { categoryId: electronics.id },
  })

  await prisma.product.updateMany({
    where: { name: { contains: "Mouse", ...ins } },
    data: { categoryId: electronics.id },
  })

  await prisma.product.updateMany({
    where: { name: { contains: "Charger", ...ins } },
    data: { categoryId: electronics.id },
  })

  await prisma.product.updateMany({
    where: { name: { contains: "Garden", ...ins } },
    data: { categoryId: home.id },
  })

  await prisma.product.updateMany({
    where: { name: { contains: "Pillow", ...ins } },
    data: { categoryId: home.id },
  })

  await prisma.product.updateMany({
    where: { name: { contains: "Lamp", ...ins } },
    data: { categoryId: home.id },
  })

  await prisma.product.updateMany({
    where: { name: { contains: "Beard", ...ins } },
    data: { categoryId: beauty.id },
  })

  console.log("✅ Linked all products to categories")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
