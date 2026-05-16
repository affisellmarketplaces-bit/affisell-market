/**
 * Quick check: smartphone category without brand → "Marque est requis"
 * Run: npx tsx scripts/test-category-attribute-validation.ts
 */
import { PrismaClient } from "@prisma/client"

import {
  CategoryAttributeValidationError,
  validateVisibleCategoryAttributes,
} from "../lib/category-attribute-rules"

const prisma = new PrismaClient()

async function main() {
  const cat = await prisma.category.findFirst({
    where: { slug: "telephones-portables-deverrouilles-543514", isLeaf: true },
    select: { id: true, name: true },
  })
  if (!cat) {
    console.error("Smartphone category not found — run seed-amazon-attributes.ts first")
    process.exit(1)
  }

  try {
    await validateVisibleCategoryAttributes(cat.id, {})
    console.error("FAIL: expected validation error")
    process.exit(1)
  } catch (e) {
    if (!(e instanceof CategoryAttributeValidationError)) throw e
    const hasBrand = e.errors.some((msg) => /marque est requis/i.test(msg))
    if (!hasBrand) {
      console.error("FAIL: errors =", e.errors)
      process.exit(1)
    }
    console.log("OK:", e.errors.join(", "))
  }

  await validateVisibleCategoryAttributes(cat.id, {
    brand: "Apple",
    storage_gb: "128",
    operating_system: "iOS",
  })
  console.log("OK: valid smartphone payload accepted")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
