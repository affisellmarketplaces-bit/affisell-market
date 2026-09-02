#!/usr/bin/env tsx
/**
 * Idempotent fixture for SEO parasite smoke test (/s/marc-boutique/...).
 * Usage: npm run ensure:seo-parasite
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"

const root = resolve(import.meta.dirname, "..")
for (const name of [".env.local", ".env"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || ""
if (!databaseUrl) {
  throw new Error("[ensure-seo-parasite] Missing DATABASE_URL in .env.local")
}

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
})

const TARGET_PRODUCT_ID = "cmp7n3gpq0004l7049gyv772x"
const TARGET_STORE_SLUG = "marc-boutique"
const TARGET_STORE_NAME = "Marc Boutique"
const TARGET_MARGIN_CENTS = 6700

async function main() {
  const product = await prisma.product.findUnique({
    where: { id: TARGET_PRODUCT_ID },
    select: { id: true, name: true, basePriceCents: true },
  })

  if (!product) {
    throw new Error(`[ensure-seo-parasite] Product ${TARGET_PRODUCT_ID} not found`)
  }

  let affiliate = await prisma.user.findFirst({
    where: {
      role: "AFFILIATE",
      OR: [
        { name: { contains: "Marc", mode: "insensitive" } },
        { email: { contains: "marc", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, store: { select: { id: true, slug: true } } },
  })

  if (!affiliate) {
    affiliate = await prisma.user.findFirst({
      where: { role: "AFFILIATE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, store: { select: { id: true, slug: true } } },
    })
  }

  if (!affiliate?.store) {
    throw new Error("[ensure-seo-parasite] No affiliate store found")
  }

  await prisma.store.update({
    where: { id: affiliate.store.id },
    data: {
      slug: TARGET_STORE_SLUG,
      name: TARGET_STORE_NAME,
    },
  })

  const sellingPriceCents = product.basePriceCents + TARGET_MARGIN_CENTS

  const listing = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: {
        affiliateId: affiliate.id,
        productId: product.id,
      },
    },
    create: {
      affiliateId: affiliate.id,
      productId: product.id,
      sellingPriceCents,
      marginCents: TARGET_MARGIN_CENTS,
      isListed: true,
      customImages: [],
      collections: [],
    },
    update: {
      sellingPriceCents,
      marginCents: TARGET_MARGIN_CENTS,
      isListed: true,
    },
    select: { id: true, marginCents: true, sellingPriceCents: true },
  })

  console.log("[ensure-seo-parasite]", {
    productId: product.id,
    productName: product.name,
    affiliateId: affiliate.id,
    affiliateEmail: affiliate.email,
    storeSlug: TARGET_STORE_SLUG,
    listingId: listing.id,
    marginCents: listing.marginCents,
    sellingPriceCents: listing.sellingPriceCents,
    testUrl: `/s/${TARGET_STORE_SLUG}/leggings-demo-try-on-${product.id}`,
  })
}

main()
  .catch((err: unknown) => {
    console.error("[ensure-seo-parasite]", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
