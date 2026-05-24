import { config } from "dotenv"

config({ path: ".env.local" })

/**
 * Run: npx tsx scripts/create-test-order-three-way.ts
 *      npx tsx scripts/create-test-order-three-way.ts --require-onboarded
 */
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import Stripe from "stripe"

const SUPPLIER_ACCOUNT_ID = "acct_1TaaA6FXp6SP9lqY"
const CHECKOUT_SUCCESS_URL =
  "http://localhost:3001/success?session_id={CHECKOUT_SESSION_ID}"
const CHECKOUT_CANCEL_URL = "http://localhost:3001/cancel"

const requireOnboarded = process.argv.includes("--require-onboarded")

function requireStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY invalide ou manquante (sk_test_… requis)")
  }
  console.log("Key OK:", key.substring(0, 15))
  return key
}

const prisma = new PrismaClient()

const LINE_TOTAL_CENTS = 14_560

async function upsertTestUser(args: {
  email: string
  name: string
  role: "SUPPLIER" | "AFFILIATE"
  stripeAccountId: string
  stripeOnboardedAt?: Date | null
}) {
  await prisma.user.updateMany({
    where: {
      stripeAccountId: args.stripeAccountId,
      NOT: { email: args.email },
    },
    data: { stripeAccountId: null },
  })

  return prisma.user.upsert({
    where: { email: args.email },
    update: {
      stripeAccountId: args.stripeAccountId,
      name: args.name,
      role: args.role,
      stripeOnboardedAt: args.stripeOnboardedAt,
    },
    create: {
      email: args.email,
      name: args.name,
      stripeAccountId: args.stripeAccountId,
      role: args.role,
      stripeOnboardedAt: args.stripeOnboardedAt ?? null,
    },
  })
}

async function createAffiliateWithOnboardingLink(stripe: Stripe) {
  const affiliateAcct = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: "affiliate@test.com",
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  })

  const link = await stripe.accountLinks.create({
    account: affiliateAcct.id,
    refresh_url: CHECKOUT_CANCEL_URL,
    return_url: CHECKOUT_SUCCESS_URL.replace("{CHECKOUT_SESSION_ID}", "affiliate_onboard"),
    type: "account_onboarding",
  })

  console.log("AFFILIATE_ONBOARDING_URL:", link.url)

  return { accountId: affiliateAcct.id, onboardingUrl: link.url }
}

async function main() {
  console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
  console.log("Supplier:", SUPPLIER_ACCOUNT_ID)

  const stripe = new Stripe(requireStripeKey())

  const { accountId: affiliateAcctId, onboardingUrl } = await createAffiliateWithOnboardingLink(stripe)
  console.log("Affiliate:", affiliateAcctId)

  const affiliateAccount = await stripe.accounts.retrieve(affiliateAcctId)
  const affiliateTransfersActive = affiliateAccount.capabilities?.transfers === "active"

  if (requireOnboarded && !affiliateTransfersActive) {
    console.error(
      "Affiliate transfers not active. Complete onboarding first:\n",
      onboardingUrl
    )
    process.exit(1)
  }

  const supplier = await upsertTestUser({
    email: "supplier@test.com",
    name: "Supplier Test",
    role: "SUPPLIER",
    stripeAccountId: SUPPLIER_ACCOUNT_ID,
    stripeOnboardedAt: new Date(),
  })

  const affiliate = await upsertTestUser({
    email: "affiliate@test.com",
    name: "Affiliate Test",
    role: "AFFILIATE",
    stripeAccountId: affiliateAcctId,
    stripeOnboardedAt: affiliateTransfersActive ? new Date() : null,
  })

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
      affiliateStripeAccountId: affiliateAcctId,
      totalCents: LINE_TOTAL_CENTS,
      paymentSettlementStatus: "PENDING",
    },
  })

  const supplierAcct = await stripe.accounts.retrieve(SUPPLIER_ACCOUNT_ID)
  if (supplierAcct.capabilities?.transfers !== "active") {
    throw new Error(
      `Supplier transfers not active (got: ${supplierAcct.capabilities?.transfers ?? "undefined"})`
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
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
    success_url: CHECKOUT_SUCCESS_URL,
    cancel_url: CHECKOUT_CANCEL_URL,
    metadata: { orderId: order.id },
    expires_at: Math.floor(Date.now() / 1000) + 86400,
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
    if (e instanceof Stripe.errors.StripeError) {
      console.error(`Stripe [${e.code ?? e.type}] ${e.param ?? ""}: ${e.message}`)
    } else {
      console.error(e instanceof Error ? e.message : e)
    }
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
