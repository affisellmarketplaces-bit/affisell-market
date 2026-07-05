#!/usr/bin/env npx tsx
/**
 * Prépare une commande existante (ou en crée une) pour tester Lightning Payout en local.
 *
 * Usage:
 *   npx tsx scripts/prepare-lightning-e2e-test.ts
 *   npx tsx scripts/prepare-lightning-e2e-test.ts --order-id=cmqzfcwfb0001jv04912c4we4
 *   npx tsx scripts/prepare-lightning-e2e-test.ts --new-checkout
 */
import { config } from "dotenv"
import { randomUUID } from "node:crypto"

for (const name of [".env.local", ".env"]) config({ path: name, override: true })

import Stripe from "stripe"
import { PrismaClient } from "@prisma/client"

import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"

const prisma = new PrismaClient()

const DEFAULT_SUPPLIER_STRIPE = "acct_1TaaA6FXp6SP9lqY"
const DEFAULT_AFFILIATE_STRIPE = "acct_1TR6FpFAAjBxFiOT"
const DEFAULT_AFFILIATE_PRODUCT_ID = "cmqjggk4m01eothz377d8l4s1"
const DEFAULT_ORDER_ID = "cmqzfcwfb0001jv04912c4we4"
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "")

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

function requireStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key?.startsWith("sk_")) throw new Error("STRIPE_SECRET_KEY manquante (sk_test_…)")
  return new Stripe(key)
}

async function assertTransfersActive(stripe: Stripe, accountId: string, label: string) {
  const account = await stripe.accounts.retrieve(accountId)
  if (account.capabilities?.transfers !== "active") {
    throw new Error(`${label} ${accountId} — transfers=${account.capabilities?.transfers ?? "inactive"}`)
  }
  return account
}

async function resolveConnectAccount(
  stripe: Stripe,
  envValue: string | undefined,
  fallback: string,
  label: string
): Promise<string> {
  const candidates = [envValue?.trim(), fallback].filter(Boolean) as string[]
  const seen = new Set<string>()
  for (const accountId of candidates) {
    if (seen.has(accountId)) continue
    seen.add(accountId)
    try {
      await assertTransfersActive(stripe, accountId, label)
      return accountId
    } catch (error) {
      console.warn(
        "[prepare-lightning-e2e]",
        `${label} ${accountId} ignoré:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }
  throw new Error(`Aucun compte Connect actif pour ${label}`)
}

async function healOrderForLightning(orderId: string) {
  const stripe = requireStripe()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { name: true } },
      supplier: { select: { id: true, email: true } },
      affiliate: { select: { id: true, email: true } },
    },
  })
  if (!order) throw new Error(`Order introuvable: ${orderId}`)

  let paymentIntentId = order.stripePaymentIntentId
  let chargeId = order.stripeChargeId

  if (!paymentIntentId && order.stripeSessionId.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId)
    paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null
    if (paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (pi.status !== "succeeded") {
        throw new Error(`PaymentIntent ${paymentIntentId} status=${pi.status}`)
      }
      const latest = pi.latest_charge
      chargeId = typeof latest === "string" ? latest : latest?.id ?? null
    }
  }

  if (!paymentIntentId) {
    throw new Error("stripePaymentIntentId absent — repassez un checkout Stripe ou --new-checkout")
  }

  const supplierStripe = await resolveConnectAccount(
    stripe,
    process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID,
    DEFAULT_SUPPLIER_STRIPE,
    "Supplier Connect"
  )
  const affiliateStripe = await resolveConnectAccount(
    stripe,
    process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID,
    DEFAULT_AFFILIATE_STRIPE,
    "Affiliate Connect"
  )

  await prisma.user.updateMany({
    where: { stripeAccountId: supplierStripe, NOT: { id: order.supplierId } },
    data: { stripeAccountId: null },
  })
  await prisma.user.updateMany({
    where: { stripeAccountId: affiliateStripe, NOT: { id: order.affiliateId } },
    data: { stripeAccountId: null },
  })

  await prisma.user.update({
    where: { id: order.supplierId },
    data: { stripeAccountId: supplierStripe },
  })
  await prisma.user.update({
    where: { id: order.affiliateId },
    data: { stripeAccountId: affiliateStripe },
  })

  await prisma.supplierProfile.upsert({
    where: { userId: order.supplierId },
    create: {
      userId: order.supplierId,
      trustScore: 50,
      lightningEnabled: true,
      lightningAdminOverride: true,
    },
    update: {
      trustScore: 50,
      lightningEnabled: true,
      lightningAdminOverride: true,
    },
  })

  const healed = await prisma.order.update({
    where: { id: orderId },
    data: {
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      payoutStatus: "PENDING",
      status: order.status === "paid" ? "preparing" : order.status,
    },
    select: {
      id: true,
      status: true,
      payoutStatus: true,
      supplierPayoutCents: true,
      affiliatePayoutCents: true,
      affiliateProductId: true,
    },
  })

  console.log("[prepare-lightning-e2e]", {
    orderId: healed.id,
    product: order.product.name,
    supplierEmail: order.supplier.email,
    affiliateEmail: order.affiliate.email,
    paymentIntentId,
    supplierStripe,
    affiliateStripe,
    payoutStatus: healed.payoutStatus,
    supplierPayoutCents: healed.supplierPayoutCents,
    affiliatePayoutCents: healed.affiliatePayoutCents,
  })

  printPlaybook({
    orderId: healed.id,
    affiliateProductId: healed.affiliateProductId,
    supplierEmail: order.supplier.email ?? "",
    productName: order.product.name,
    mode: "existing",
  })
}

async function createNewCheckout() {
  const stripe = requireStripe()
  const affiliateProduct = await prisma.affiliateProduct.findUnique({
    where: { id: DEFAULT_AFFILIATE_PRODUCT_ID },
    include: {
      product: true,
      affiliate: { select: { id: true, email: true } },
    },
  })
  if (!affiliateProduct?.product.active) {
    throw new Error(`Listing introuvable ou inactif: ${DEFAULT_AFFILIATE_PRODUCT_ID}`)
  }

  const supplierId = affiliateProduct.product.supplierId
  const supplier = await prisma.user.findUnique({
    where: { id: supplierId },
    select: { id: true, email: true },
  })
  if (!supplier) throw new Error("Supplier introuvable")

  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: affiliateProduct.sellingPriceCents,
    basePriceCents: affiliateProduct.product.basePriceCents,
    supplierCommissionRatePercent: affiliateProduct.product.commissionRate,
  })

  const order = await prisma.order.create({
    data: {
      status: "PENDING",
      currency: "eur",
      productId: affiliateProduct.productId,
      supplierId,
      affiliateId: affiliateProduct.affiliateId,
      affiliateProductId: affiliateProduct.id,
      quantity: 1,
      customerEmail: "",
      shippingAddress: { line1: "1 rue Test", city: "Paris", country: "FR" },
      stripeSessionId: `pending_${randomUUID()}`,
      basePriceCents: settlement.basePriceCents,
      sellingPriceCents: settlement.sellingPriceCents,
      commissionCents: settlement.affiliateCommissionCents,
      marginCents: settlement.marginCents,
      affiliatePayoutCents: settlement.affiliateCommissionCents,
      affiliateMarginRetainedCents: settlement.affiliateMarginRetainedCents,
      affisellFeeCents: settlement.affisellFeeCents,
      supplierPriceCents: affiliateProduct.product.basePriceCents,
      supplierCommissionRateBps: affiliateProduct.product.supplierCommissionRateBps ?? 1000,
      affiliateMarginCents: affiliateProduct.marginCents,
      affisellCommissionRateBps: 1200,
      totalCents: Math.round(affiliateProduct.sellingPriceCents * 1.2),
      paymentSettlementStatus: "PENDING",
      payoutStatus: "PENDING",
    },
  })

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: affiliateProduct.product.name },
          unit_amount: order.totalCents ?? affiliateProduct.sellingPriceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/marketplace/${affiliateProduct.id}`,
    metadata: { orderId: order.id, affiliateProductId: affiliateProduct.id },
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
  })

  if (!session.url) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined)
    throw new Error("Stripe Checkout URL indisponible")
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  })

  console.log("[prepare-lightning-e2e]", {
    mode: "new-checkout",
    orderId: order.id,
    product: affiliateProduct.product.name,
    checkoutUrl: session.url,
    marketplaceUrl: `${APP_URL}/marketplace/${affiliateProduct.id}`,
  })

  printPlaybook({
    orderId: order.id,
    affiliateProductId: affiliateProduct.id,
    supplierEmail: supplier.email ?? "",
    productName: affiliateProduct.product.name,
    mode: "new",
    checkoutUrl: session.url,
    marketplaceUrl: `${APP_URL}/marketplace/${affiliateProduct.id}`,
  })
}

function printPlaybook(args: {
  orderId: string
  affiliateProductId: string
  supplierEmail: string
  productName: string
  mode: "existing" | "new"
  checkoutUrl?: string
  marketplaceUrl?: string
}) {
  console.log("\n=== PLAYBOOK LIGHTNING E2E ===\n")
  if (args.mode === "new") {
    console.log("1. Payer (carte test Stripe 4242…):", args.checkoutUrl)
    console.log("   ou via fiche produit:", args.marketplaceUrl)
    console.log("2. Attendre redirect /success puis relancer:")
    console.log(`   npx tsx scripts/prepare-lightning-e2e-test.ts --order-id=${args.orderId}`)
  } else {
    console.log("1. Commande déjà payée — prête pour Lightning.")
  }
  console.log(`\n2. Connecte-toi fournisseur: ${args.supplierEmail}`)
  console.log(`   → ${APP_URL}/dashboard/supplier (commandes)`)
  console.log(`\n3. Commande: ${args.productName}`)
  console.log(`   orderId: ${args.orderId}`)
  console.log("\n4. Marquer expédié avec le bouton SHEET « Marquer expédié » (Lightning)")
  console.log("   ⚠️  Pas le bouton violet inline (celui-là = payout J+2)")
  console.log("\n5. Toast attendu: « Expédié. Lightning Payout déclenché »")
  console.log("\n6. Vérifier logs terminal: [stripe-lightning] result: paid")
  console.log(`\n7. Admin Lightning ON: ${APP_URL}/admin/suppliers/lightning`)
  console.log("\nCarte test Stripe: 4242 4242 4242 4242 · date future · CVC 123\n")
}

async function main() {
  if (process.argv.includes("--new-checkout")) {
    await createNewCheckout()
    return
  }
  const orderId = arg("order-id") ?? DEFAULT_ORDER_ID
  await healOrderForLightning(orderId)
}

main()
  .catch((error) => {
    console.error("[prepare-lightning-e2e]", error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
