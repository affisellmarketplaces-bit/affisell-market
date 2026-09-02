#!/usr/bin/env tsx
/**
 * Idempotent local seed for /api/product-social-proof smoke tests.
 * Usage: npm run seed:social-proof
 */
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"

import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"

const root = resolve(import.meta.dirname, "..")
for (const name of [".env.local", ".env"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || ""
if (!databaseUrl) {
  throw new Error("[seed-social-proof] Missing DATABASE_URL in .env.local")
}

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
})

const SEED_PREFIX = "seed_social_proof_"
const MARGINS = [2500, 4000, 5500, 6700, 3200] as const
const OFFSETS_MS = [
  5 * 60_000,
  15 * 60_000,
  45 * 60_000,
  2 * 60 * 60_000,
  24 * 60 * 60_000,
] as const

const DEMO_AFFILIATE_NAMES = ["Marc Dupont", "Sophie Leroy", "Alex Martin", "Julie Bernard", "Paul Renard"]

async function countPaidOrders30d(productId: string): Promise<number> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  return prisma.order.count({
    where: {
      productId,
      paidAt: { gte: since, not: null },
      status: { in: ["paid", "preparing", "shipped"] },
      affiliateId: { not: "" },
    },
  })
}

async function main() {
  const product = await prisma.product.findFirst({
    where: { active: true, isDraft: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      supplierId: true,
      basePriceCents: true,
      commissionRate: true,
      supplierCommissionRateBps: true,
    },
  })

  if (!product) {
    throw new Error("[seed-social-proof] No active product found")
  }

  const existing = await countPaidOrders30d(product.id)
  console.log("[seed-social-proof]", {
    productId: product.id,
    productName: product.name.slice(0, 80),
    paidOrdersLast30d: existing,
  })

  if (existing > 0) {
    console.log("[seed-social-proof]", { result: "skip", reason: "paid_orders_exist" })
    return product.id
  }

  const affiliates = await prisma.user.findMany({
    where: { role: "AFFILIATE" },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, name: true, email: true },
  })

  if (affiliates.length === 0) {
    throw new Error("[seed-social-proof] No AFFILIATE users — create one first")
  }

  const now = Date.now()
  let created = 0

  for (let i = 0; i < MARGINS.length; i++) {
    const marginCents = MARGINS[i]!
    const paidAt = new Date(now - OFFSETS_MS[i]!)
    const sessionKey = `${SEED_PREFIX}${product.id}_${i}`
    const existingOrder = await prisma.order.findUnique({
      where: { stripeSessionId: sessionKey },
      select: { id: true },
    })
    if (existingOrder) continue

    const affiliate = affiliates[i % affiliates.length]!
    if (DEMO_AFFILIATE_NAMES[i] && (!affiliate.name || affiliate.name.trim().length < 2)) {
      await prisma.user.update({
        where: { id: affiliate.id },
        data: { name: DEMO_AFFILIATE_NAMES[i] },
      })
    }

    const sellingPriceCents = product.basePriceCents + marginCents + 500
    const settlement = computeMarketplaceOrderSettlement({
      sellingPriceCents,
      basePriceCents: product.basePriceCents,
      supplierCommissionRatePercent: product.commissionRate,
    })

    let listing = await prisma.affiliateProduct.findUnique({
      where: {
        affiliateId_productId: { affiliateId: affiliate.id, productId: product.id },
      },
      select: { id: true },
    })

    if (!listing) {
      listing = await prisma.affiliateProduct.create({
        data: {
          affiliateId: affiliate.id,
          productId: product.id,
          sellingPriceCents,
          marginCents,
          isListed: true,
          customImages: [],
          collections: [],
        },
        select: { id: true },
      })
    }

    const order = await prisma.order.create({
      data: {
        status: "paid",
        currency: "eur",
        productId: product.id,
        supplierId: product.supplierId,
        affiliateId: affiliate.id,
        affiliateProductId: listing.id,
        quantity: 1,
        customerEmail: `social-proof-seed+${i}@demo.affisell.com`,
        shippingAddress: { line1: "1 rue Seed", city: "Paris", country: "FR" },
        stripeSessionId: sessionKey,
        stripePaymentIntentId: `${sessionKey}_pi_${randomUUID().slice(0, 8)}`,
        basePriceCents: settlement.basePriceCents,
        sellingPriceCents: settlement.sellingPriceCents,
        commissionCents: settlement.affiliateCommissionCents,
        marginCents,
        affiliatePayoutCents: settlement.affiliateCommissionCents,
        affiliateMarginRetainedCents: marginCents,
        affiliateMarginCents: marginCents,
        affisellFeeCents: settlement.affisellFeeCents,
        supplierPriceCents: product.basePriceCents,
        supplierCommissionRateBps: product.supplierCommissionRateBps ?? product.commissionRate * 100,
        affisellCommissionRateBps: 1200,
        totalCents: sellingPriceCents,
        paymentSettlementStatus: "SETTLED",
        payoutStatus: "PAID",
        paidAt,
        createdAt: paidAt,
      },
      select: { id: true },
    })

    await prisma.affiliateSale.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        affiliateId: affiliate.id,
        supplierId: product.supplierId,
        supplierPriceCents: product.basePriceCents,
        marginAmountCents: marginCents,
        commissionAmountCents: settlement.affiliateCommissionCents,
        resalePriceCents: sellingPriceCents,
      },
      update: {
        marginAmountCents: marginCents,
      },
    })

    created += 1
  }

  const after = await countPaidOrders30d(product.id)
  console.log("[seed-social-proof]", {
    result: "seeded",
    productId: product.id,
    ordersCreated: created,
    paidOrdersLast30d: after,
    distinctAffiliates: affiliates.length,
  })

  return product.id
}

main()
  .catch((err: unknown) => {
    console.error("[seed-social-proof]", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
