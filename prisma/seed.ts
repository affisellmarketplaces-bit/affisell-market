import fs from "fs"
import path from "path"

import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function seedGoogleTaxonomy() {
  console.log("🗑️ Wipe intelligent...")
  await prisma.merchantPayoutLedger.deleteMany()
  await prisma.blindDropshipOrderItem.deleteMany()
  await prisma.blindDropshipOrder.deleteMany()
  await prisma.order.deleteMany()
  await prisma.buyerRewardLedger.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.affiliateProduct.deleteMany()
  await prisma.wishlist.deleteMany()
  await prisma.review.deleteMany()
  await prisma.productReview.deleteMany()
  await prisma.productAttribute.deleteMany()
  await prisma.product.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.communityPost.deleteMany()
  await prisma.follow.deleteMany()
  await prisma.searchHistory.deleteMany()
  await prisma.affisellTrackEvent.deleteMany()
  await prisma.supplierIntegration.deleteMany()
  await prisma.subcategory.deleteMany()
  await prisma.categoryAttribute.deleteMany()
  await prisma.category.deleteMany()
  await prisma.blindDropshipSupplier.deleteMany()
  await prisma.store.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  console.log("👤 Create users...")
  const password = await hash("password123", 10)
  await prisma.user.create({
    data: { email: "admin@affisell.io", name: "Admin", password, role: "ADMIN" },
  })
  await prisma.user.create({
    data: { email: "supplier@affisell.io", name: "Supplier", password, role: "SUPPLIER" },
  })

  console.log("🌳 Import Google Taxonomy FR 5596 lignes...")
  const filePath = path.join(process.cwd(), "prisma", "taxonomy-fr.txt")
  const file = fs.readFileSync(filePath, "utf-8")
  const lines = file.split("\n").filter((line) => line.trim() && !line.startsWith("#"))

  type Row = {
    googleId: number
    fullPath: string
    name: string
    level: number
    parentPath: string | null
    slug: string
  }

  const rows: Row[] = []
  for (const line of lines) {
    const [idStr, fullPath] = line.split(" - ")
    if (!idStr || !fullPath) continue

    const googleId = Number.parseInt(idStr.trim(), 10)
    const fp = fullPath.trim()
    if (!Number.isFinite(googleId) || !fp) continue

    const parts = fp.split(" > ").map((p) => p.trim())
    if (parts.length === 0 || parts.some((p) => !p)) continue

    const name = parts[parts.length - 1]!
    const level = parts.length
    const parentPath = level > 1 ? parts.slice(0, -1).join(" > ") : null

    const slug =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + `-${googleId}`

    rows.push({ googleId, fullPath: fp, name, level, parentPath, slug })
  }

  rows.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    return a.fullPath.localeCompare(b.fullPath, "fr")
  })

  const categoryMap = new Map<string, string>()
  let created = 0

  for (const row of rows) {
    const parentId = row.parentPath ? categoryMap.get(row.parentPath) ?? null : null
    if (row.parentPath && parentId == null) {
      throw new Error(`Parent introuvable pour « ${row.fullPath} » (attendu « ${row.parentPath} »).`)
    }

    const category = await prisma.category.create({
      data: {
        googleId: row.googleId,
        name: row.name,
        slug: row.slug,
        parentId,
        level: row.level,
        fullPath: row.fullPath,
        isLeaf: true,
        order: row.googleId,
      },
    })

    categoryMap.set(row.fullPath, category.id)
    created++
    if (created % 500 === 0) console.log(`✅ ${created} catégories...`)
  }

  const allCats = await prisma.category.findMany()
  const parentIds = new Set(allCats.map((c) => c.parentId).filter(Boolean))
  await prisma.category.updateMany({
    where: { id: { in: [...parentIds] as string[] } },
    data: { isLeaf: false },
  })

  console.log(`✅ ${created} catégories Google importées`)
  console.log(`📊 Niveaux max: ${Math.max(...allCats.map((c) => c.level), 0)}`)
  console.log(`📁 Feuilles: ${await prisma.category.count({ where: { isLeaf: true } })}`)
}

seedGoogleTaxonomy()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
