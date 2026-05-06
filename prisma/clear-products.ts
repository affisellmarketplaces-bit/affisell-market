/**
 * Remove all products (and dependent order / affiliate rows). Run before real supplier data.
 *   npx tsx prisma/clear-products.ts
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

  await prisma.$transaction(async (tx) => {
    await tx.order.deleteMany()
    await tx.affiliateProduct.deleteMany()
    await tx.product.deleteMany()
  })

  console.log("✅ All products deleted. Database ready for real supplier uploads.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
