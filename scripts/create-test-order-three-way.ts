import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

/**
 * Run: npx tsx scripts/create-test-order-three-way.ts
 */
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import Stripe from "stripe"

const SUPPLIER_ACCOUNT_ID = "acct_1TaaA6FXp6SP9lqY"
const CONNECT_BUSINESS_URL = "https://affisell.com"
const CHECKOUT_SUCCESS_URL =
  "http://localhost:3001/success?session_id={CHECKOUT_SESSION_ID}"
const CHECKOUT_CANCEL_URL = "http://localhost:3001/cancel"

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
    update: { stripeAccountId: args.stripeAccountId, name: args.name, role: args.role },
    create: {
      email: args.email,
      name: args.name,
      stripeAccountId: args.stripeAccountId,
      role: args.role,
    },
  })
}

async function createAndOnboardAffiliate(stripe: Stripe) {
  const affiliateAcct = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: "affiliate@test.com",
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  })

  const profileUpdate: Stripe.AccountUpdateParams = {
    business_type: "individual",
    individual: {
      first_name: "Test",
      last_name: "Affiliate",
      email: "affiliate@test.com",
      dob: { day: 1, month: 1, year: 1990 },
      address: {
        line1: "1 rue de Rivoli",
        city: "Paris",
        postal_code: "75001",
        country: "FR",
      },
    },
    business_profile: { mcc: "5734", url: CONNECT_BUSINESS_URL },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
  }

  try {
    await stripe.accounts.update(affiliateAcct.id, profileUpdate)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (!msg.includes("Terms of Service")) {
      throw e
    }
    console.warn(
      "Express: tos_acceptance via API impossible — onboarding sans ToS, lien Dashboard ci-dessous"
    )
    const { tos_acceptance: _tos, ...withoutTos } = profileUpdate
    await stripe.accounts.update(affiliateAcct.id, withoutTos)
    const link = await stripe.accountLinks.create({
      account: affiliateAcct.id,
      refresh_url: "http://localhost:3001/cancel",
      return_url: CHECKOUT_SUCCESS_URL.replace("{CHECKOUT_SESSION_ID}", "affiliate_onboard"),
      type: "account_onboarding",
    })
    console.warn("Affiliate onboarding URL:", link.url)
  }

  return affiliateAcct.id
}

async function main() {
  console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
  console.log("Supplier:", SUPPLIER_ACCOUNT_ID)

  const stripe = new Stripe(requireStripeKey())

  console.log("→ Création + onboarding affiliate…")
  const affiliateAcctId = await createAndOnboardAffiliate(stripe)
  console.log("Affiliate:", affiliateAcctId)

  const supplier = await upsertTestUser({
    email: "supplier@test.com",
    name: "Supplier Test",
    role: "SUPPLIER",
    stripeAccountId: SUPPLIER_ACCOUNT_ID,
  })

  const affiliate = await upsertTestUser({
    email: "affiliate@test.com",
    name: "Affiliate Test",
    role: "AFFILIATE",
    stripeAccountId: affiliateAcctId,
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

  console.log("→ Checkout session…")
  console.log("  success_url:", CHECKOUT_SUCCESS_URL)
  console.log("  cancel_url:", CHECKOUT_CANCEL_URL)

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
