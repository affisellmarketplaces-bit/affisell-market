/**
 * Full three-way split test: PENDING order + real Stripe Checkout (never settled).
 *
 * Run: npx tsx scripts/create-test-order-three-way.ts
 */
import { randomUUID } from "node:crypto"
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { prisma } from "../lib/prisma"
import { appBaseUrl } from "../lib/stripe-pro"
import { getStripeClient } from "../lib/stripe"

const PRODUCT_ID = "test_product_3way"
const LISTING_ID = "test_listing_3way"
const LINE_TOTAL_CENTS = 14_560
const SUPPLIER_PRICE_CENTS = 9_000
const AFFILIATE_MARGIN_CENTS = 4_000

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new Error("STRIPE_SECRET_KEY manquant")
  }
  if (!process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID?.trim()) {
    throw new Error("TEST_AFFILIATE_STRIPE_ACCOUNT_ID manquant")
  }
  if (!process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID?.trim()) {
    throw new Error("TEST_SUPPLIER_STRIPE_ACCOUNT_ID manquant")
  }

  const supplier = await prisma.user.upsert({
    where: { email: "supplier@test.affisell" },
    update: { stripeAccountId: process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID },
    create: {
      email: "supplier@test.affisell",
      role: "SUPPLIER",
      stripeAccountId: process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID,
    },
  })

  const affiliate = await prisma.user.upsert({
    where: { email: "affiliate@test.affisell" },
    update: { stripeAccountId: process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID },
    create: {
      email: "affiliate@test.affisell",
      role: "AFFILIATE",
      stripeAccountId: process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID,
    },
  })

  const product = await prisma.product.upsert({
    where: { id: PRODUCT_ID },
    update: {
      basePriceCents: SUPPLIER_PRICE_CENTS,
      supplierCommissionRateBps: 1000,
    },
    create: {
      id: PRODUCT_ID,
      name: "Test Three Way Split",
      description: "Test Three Way Split — 90€ supplier + 40€ affiliate margin + 12% Affisell",
      supplierId: supplier.id,
      basePriceCents: SUPPLIER_PRICE_CENTS,
      commissionRate: 10,
      supplierCommissionRateBps: 1000,
    },
  })

  const affiliateProduct = await prisma.affiliateProduct.upsert({
    where: { id: LISTING_ID },
    update: {
      marginCents: AFFILIATE_MARGIN_CENTS,
      sellingPriceCents: LINE_TOTAL_CENTS,
      isListed: true,
    },
    create: {
      id: LISTING_ID,
      affiliateId: affiliate.id,
      productId: product.id,
      sellingPriceCents: LINE_TOTAL_CENTS,
      marginCents: AFFILIATE_MARGIN_CENTS,
      isListed: true,
    },
  })

  const priceClientCents = SUPPLIER_PRICE_CENTS + AFFILIATE_MARGIN_CENTS

  const order = await prisma.order.create({
    data: {
      status: "PENDING",
      currency: "eur",
      productId: product.id,
      supplierId: product.supplierId,
      affiliateId: affiliate.id,
      affiliateProductId: affiliateProduct.id,
      quantity: 1,
      customerEmail: "",
      shippingAddress: {},
      stripeSessionId: `pending_${randomUUID()}`,
      basePriceCents: SUPPLIER_PRICE_CENTS,
      sellingPriceCents: priceClientCents,
      commissionCents: 0,
      marginCents: AFFILIATE_MARGIN_CENTS,
      affiliatePayoutCents: 0,
      supplierPriceCents: SUPPLIER_PRICE_CENTS,
      supplierCommissionRateBps: 1000,
      affiliateMarginCents: AFFILIATE_MARGIN_CENTS,
      affisellCommissionRateBps: 1200,
      affiliateStripeAccountId: process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID,
      totalCents: LINE_TOTAL_CENTS,
      paymentSettlementStatus: "PENDING",
    },
  })

  const stripe = getStripeClient()
  const base = appBaseUrl()

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: LINE_TOTAL_CENTS,
          product_data: { name: product.name },
        },
        quantity: 1,
      },
    ],
    customer_email: "buyer@test.affisell",
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: ["FR"] },
    success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/marketplace`,
    payment_intent_data: {
      metadata: {
        flow: "marketplace",
        orderId: order.id,
        sellerId: product.supplierId,
      },
    },
    metadata: {
      orderId: order.id,
    },
  })

  if (!session.url) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    throw new Error("Stripe Checkout URL unavailable")
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  })

  console.log(`Checkout URL: ${session.url}`)
  console.log(`Order ID: ${order.id}`)
  console.log("Montants attendus: Supplier 90€ | Affiliate 40€ | Affisell 15.60€")
  console.log(`Session ID: ${session.id}`)
  console.log("\nAprès paiement (webhook local):")
  console.log(`  npx tsx scripts/resettle-order-vat.ts ${session.id}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
