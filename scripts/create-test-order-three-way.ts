import { config } from "dotenv"

config({ path: ".env.local" })

/**
 * Run: npx tsx scripts/create-test-order-three-way.ts
 */
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("STRIPE_SECRET_KEY invalide ou manquante")
}
console.log("Key OK:", process.env.STRIPE_SECRET_KEY.substring(0, 15))

const prisma = new PrismaClient()

const LINE_TOTAL_CENTS = 14_560

async function main() {
  // 1. Créer comptes Connect avec transfers activé + auto-onboard
  const supplierAcct = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: "supplier@test.com",
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  })

  const affiliateAcct = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: "affiliate@test.com",
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  })

  // 2. Simuler l'onboarding complet pour activer transfers
  await stripe.accounts.update(supplierAcct.id, {
    business_type: "individual",
    individual: {
      first_name: "Test",
      last_name: "Supplier",
      email: "supplier@test.com",
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: "1 rue test", city: "Paris", postal_code: "75001", country: "FR" },
    },
    business_profile: { mcc: "5734", url: "https://test.com" },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
  })

  await stripe.accounts.update(affiliateAcct.id, {
    business_type: "individual",
    individual: {
      first_name: "Test",
      last_name: "Affiliate",
      email: "affiliate@test.com",
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: "1 rue test", city: "Paris", postal_code: "75001", country: "FR" },
    },
    business_profile: { mcc: "5734", url: "https://test.com" },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
  })

  console.log("Supplier:", supplierAcct.id, "Affiliate:", affiliateAcct.id)

  // 3. Upsert users
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

  // 4. Créer produit + listing + order (schéma Affisell)
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

  // 5. Session checkout
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: product.name },
          unit_amount: 14560,
        },
        quantity: 1,
      },
    ],
    success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/cancel`,
    metadata: { orderId: order.id },
    expires_at: Math.floor(Date.now() / 1000) + 86400, // 24h
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
