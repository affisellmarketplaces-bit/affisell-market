import { config } from "dotenv"

config({ path: ".env.local" })

/**
 * Run:
 *   npx tsx scripts/create-test-order-three-way.ts
 *   npx tsx scripts/create-test-order-three-way.ts --require-onboarded
 *   npx tsx scripts/create-test-order-three-way.ts --check-only
 */
import { randomUUID } from "node:crypto"
import { Prisma, PrismaClient } from "@prisma/client"
import Stripe from "stripe"

import { computeTransferAmountsFromOrder } from "../lib/marketplace-split-amounts"
import { computeMarketplaceOrderSettlement } from "../lib/marketplace-order-settlement"

const SUPPLIER_ACCOUNT_ID = "acct_1TaaA6FXp6SP9lqY"
const CHECKOUT_SUCCESS_URL =
  "http://localhost:3001/success?session_id={CHECKOUT_SESSION_ID}"
const CHECKOUT_CANCEL_URL = "http://localhost:3001/cancel"

const requireOnboarded = process.argv.includes("--require-onboarded")
const checkOnly = process.argv.includes("--check-only")

function requireStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY invalide ou manquante (sk_test_… requis)")
  }
  console.log("Key OK:", key.substring(0, 15))
  return key
}

const prisma = new PrismaClient()

const SUPPLIER_PRICE_CENTS = 9_000
const SELLING_PRICE_CENTS = 13_000
const AFFILIATE_MARGIN_CENTS = 4_000
const LINE_TOTAL_CENTS = 14_560

async function upsertTestUser(args: {
  email: string
  name: string
  role: "SUPPLIER" | "AFFILIATE"
  stripeAccountId: string
  stripeOnboardedAt?: Date | null
  stripeCapabilities?: Prisma.InputJsonValue
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
      stripeCapabilities: args.stripeCapabilities ?? undefined,
    },
    create: {
      email: args.email,
      name: args.name,
      stripeAccountId: args.stripeAccountId,
      role: args.role,
      stripeOnboardedAt: args.stripeOnboardedAt ?? null,
      stripeCapabilities: args.stripeCapabilities ?? undefined,
    },
  })
}

async function logAccountCapabilities(
  stripe: Stripe,
  label: string,
  accountId: string
) {
  const account = await stripe.accounts.retrieve(accountId)
  console.log(
    JSON.stringify({
      level: "info",
      metric: "connect_capabilities_check",
      label,
      accountId,
      transfers: account.capabilities?.transfers ?? null,
      card_payments: account.capabilities?.card_payments ?? null,
    })
  )
  return account
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

  console.log(
    JSON.stringify({
      AFFILIATE_ONBOARDING_URL: link.url,
      accountId: affiliateAcct.id,
    })
  )

  return { accountId: affiliateAcct.id, onboardingUrl: link.url }
}

async function main() {
  console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
  console.log("Supplier:", SUPPLIER_ACCOUNT_ID)

  const stripe = new Stripe(requireStripeKey())

  const supplierAcct = await logAccountCapabilities(stripe, "supplier", SUPPLIER_ACCOUNT_ID)

  if (checkOnly) {
    const affiliateId = process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID?.trim()
    if (affiliateId) {
      await logAccountCapabilities(stripe, "affiliate", affiliateId)
    } else {
      console.log(
        JSON.stringify({
          level: "info",
          metric: "check_only",
          message: "Set TEST_AFFILIATE_STRIPE_ACCOUNT_ID to check affiliate account",
        })
      )
    }
    return
  }

  const { accountId: affiliateAcctId, onboardingUrl } = await createAffiliateWithOnboardingLink(stripe)

  const affiliateAccount = await stripe.accounts.retrieve(affiliateAcctId)
  const affiliateTransfersActive = affiliateAccount.capabilities?.transfers === "active"

  await logAccountCapabilities(stripe, "affiliate", affiliateAcctId)

  if (requireOnboarded && !affiliateTransfersActive) {
    console.error(
      JSON.stringify({
        level: "error",
        metric: "affiliate_not_onboarded",
        AFFILIATE_ONBOARDING_URL: onboardingUrl,
      })
    )
    process.exit(1)
  }

  const supplier = await upsertTestUser({
    email: "supplier@test.com",
    name: "Supplier Test",
    role: "SUPPLIER",
    stripeAccountId: SUPPLIER_ACCOUNT_ID,
    stripeOnboardedAt: supplierAcct.capabilities?.transfers === "active" ? new Date() : null,
    stripeCapabilities: (supplierAcct.capabilities ?? undefined) as Prisma.InputJsonValue | undefined,
  })

  const affiliate = await upsertTestUser({
    email: "affiliate@test.com",
    name: "Affiliate Test",
    role: "AFFILIATE",
    stripeAccountId: affiliateAcctId,
    stripeOnboardedAt: affiliateTransfersActive ? new Date() : null,
    stripeCapabilities: (affiliateAccount.capabilities ?? undefined) as Prisma.InputJsonValue | undefined,
  })

  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: SELLING_PRICE_CENTS,
    basePriceCents: SUPPLIER_PRICE_CENTS,
    supplierCommissionRatePercent: 10,
  })

  const product = await prisma.product.create({
    data: {
      name: "Test 3Way Split",
      description: "Test 3Way Split",
      basePriceCents: SUPPLIER_PRICE_CENTS,
      commissionRate: 10,
      supplierId: supplier.id,
    },
  })

  const affiliateProduct = await prisma.affiliateProduct.create({
    data: {
      affiliateId: affiliate.id,
      productId: product.id,
      sellingPriceCents: SELLING_PRICE_CENTS,
      marginCents: AFFILIATE_MARGIN_CENTS,
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
      basePriceCents: settlement.basePriceCents,
      sellingPriceCents: settlement.sellingPriceCents,
      commissionCents: settlement.affiliateCommissionCents,
      marginCents: settlement.marginCents,
      affiliatePayoutCents: settlement.affiliateCommissionCents,
      affiliateMarginRetainedCents: settlement.affiliateMarginRetainedCents,
      affisellFeeCents: settlement.affisellFeeCents,
      supplierPriceCents: SUPPLIER_PRICE_CENTS,
      supplierCommissionRateBps: 1000,
      affiliateMarginCents: AFFILIATE_MARGIN_CENTS,
      affisellCommissionRateBps: 1200,
      affiliateStripeAccountId: affiliateAcctId,
      totalCents: LINE_TOTAL_CENTS,
      paymentSettlementStatus: "PENDING",
    },
  })

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

  const transfers = computeTransferAmountsFromOrder({
    basePriceCents: order.basePriceCents,
    sellingPriceCents: order.sellingPriceCents,
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affisellFeeCents: order.affisellFeeCents,
    supplierPriceCents: order.supplierPriceCents,
    affiliateMarginCents: order.affiliateMarginCents,
    supplierCommissionRateBps: order.supplierCommissionRateBps,
    affisellCommissionRateBps: order.affisellCommissionRateBps,
  })

  const fmt = (cents: number) => (cents / 100).toFixed(2)

  console.log("Checkout URL:", session.url)
  console.log("Order ID:", order.id)
  console.log(
    `Montants attendus (split réel): Supplier ${fmt(transfers.supplierPayoutCents)}€ | ` +
      `Affiliate ${fmt(transfers.affiliateTransferCents)}€ | ` +
      `Affisell ${fmt(transfers.affisellFeeCents)}€ (reste plateforme)`
  )
}

main()
  .catch((e) => {
    if (e instanceof Stripe.errors.StripeError) {
      console.error(
        JSON.stringify({
          level: "error",
          errorCode: e.code ?? e.type,
          param: e.param ?? null,
          message: e.message,
        })
      )
    } else {
      console.error(e instanceof Error ? e.message : e)
    }
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
