import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { config } from "dotenv"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"

import { getStripeClient } from "../lib/stripe"

if (!process.env.STRIPE_SECRET_KEY?.trim()) {
  throw new Error("STRIPE_SECRET_KEY manquant")
}

const stripe = getStripeClient()
const prisma = new PrismaClient()

const LINE_TOTAL_CENTS = 14_560

async function main() {
  // 1. Créer 2 comptes Stripe Connect test à chaque run
  const supplierAcct = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: "supplier@test.com",
    capabilities: { transfers: { requested: true } },
  })

  const affiliateAcct = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: "affiliate@test.com",
    capabilities: { transfers: { requested: true } },
  })

  console.log("Supplier:", supplierAcct.id, "Affiliate:", affiliateAcct.id)

  // 2. Upsert users avec les vrais stripeAccountId
  const supplier = await prisma.user.upsert({
    where: { email: "supplier@test.com" },
    update: { stripeAccountId: supplierAcct.id },
    create: {
      email: "supplier@test.com",
      name: "Supplier Test",
      stripeAccountId: supplierAcct.id,
      role: "SUPPLIER",
    },
  })

  const affiliate = await prisma.user.upsert({
    where: { email: "affiliate@test.com" },
    update: { stripeAccountId: affiliateAcct.id },
    create: {
      email: "affiliate@test.com",
      name: "Affiliate Test",
      stripeAccountId: affiliateAcct.id,
      role: "AFFILIATE",
    },
  })

  // 3. Créer produit + listing + order avec les bons IDs (schéma Affisell)
  const product = await prisma.product.create({
    data: {
      name: "Test 3Way Split",
      description: "Test 3Way Split",
      basePriceCents: LINE_TOTAL_CENTS,
      commissionRate: 10,
      supplierId: supplier.id,
    },
  })

  const affiliateProduct = await prisma.affiliateProduct.create({
    data: {
      affiliateId: affiliate.id,
      productId: product.id,
      sellingPriceCents: LINE_TOTAL_CENTS,
      marginCents: 4_000,
      isListed: true,
    },
  })

  const order = await prisma.order.create({
    data: {
      status: "PENDING",
      currency: "eur",
      productId: product.id,
      supplierId: supplier.id,
      affiliateId: affiliate.id,
      affiliateProductId: affiliateProduct.id,
      quantity: 1,
      customerEmail: "",
      shippingAddress: {},
      stripeSessionId: `pending_${randomUUID()}`,
      basePriceCents: 9_000,
      sellingPriceCents: 13_000,
      commissionCents: 0,
      marginCents: 4_000,
      affiliatePayoutCents: 0,
      supplierPriceCents: 9_000,
      supplierCommissionRateBps: 1000,
      affiliateMarginCents: 4_000,
      affisellCommissionRateBps: 1200,
      affiliateStripeAccountId: affiliateAcct.id,
      totalCents: LINE_TOTAL_CENTS,
      paymentSettlementStatus: "PENDING",
    },
  })

  // 4. Créer session checkout
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: product.name },
          unit_amount: LINE_TOTAL_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: "http://localhost:3001/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "http://localhost:3001/cancel",
    metadata: { orderId: order.id },
  })

  if (!session.url) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    throw new Error("Stripe Checkout URL unavailable")
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  })

  console.log("Checkout URL:", session.url)
  console.log("Order ID:", order.id)
  console.log("Montants attendus: Supplier 87.36€ | Affiliate 38.83€ | Affisell 19.41€")
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
