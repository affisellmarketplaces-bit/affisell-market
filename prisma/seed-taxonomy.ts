/**
 * Full category tree only (no products). Clears `Category` tree and legacy `Subcategory` rows.
 * Sub slugs are `parentSlug + '-' + slugify(name)` to stay globally unique.
 *
 *   npx tsx prisma/seed-taxonomy.ts
 */

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

import { AFFISELL_CATEGORY_TAXONOMY } from "../lib/ai/categories"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  await prisma.product.updateMany({
    data: { categoryId: null, subcategoryId: null },
  })
  await prisma.subcategory.deleteMany()
  await prisma.category.deleteMany({ where: { parentId: { not: null } } })
  await prisma.category.deleteMany()

  let subCount = 0
  for (const cat of AFFISELL_CATEGORY_TAXONOMY) {
    const parent = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        order: cat.order,
        parentId: null,
      },
    })

    for (const subName of cat.subs) {
      const base = slugify(subName)
      let slug = `${cat.slug}-${base}`
      if (slug.length > 100) slug = slug.slice(0, 100)

      let attempt = 0
      while (await prisma.category.findUnique({ where: { slug } })) {
        attempt += 1
        slug = `${slug}-${attempt}`.slice(0, 128)
      }

      await prisma.category.create({
        data: {
          name: subName,
          slug,
          parentId: parent.id,
          order: 0,
        },
      })
      subCount += 1
    }
  }

  const total = await prisma.category.count()
  console.log(`✅ Seeded ${AFFISELL_CATEGORY_TAXONOMY.length} parent departments + ${subCount} subcategories (${total} Category rows total)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
