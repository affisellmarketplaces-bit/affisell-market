/**
 * Full three-way split test: PENDING order + real Stripe Checkout (never settled).
 *
 * Run: npx tsx scripts/create-test-order-three-way.ts
 */
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { config } from "dotenv"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { prisma } from "../lib/prisma"
import { getStripeClient } from "../lib/stripe"

const PRODUCT_ID = "test_product_3way"
const LINE_TOTAL_CENTS = 14_560
const SUPPLIER_PRICE_CENTS = 9_000
const AFFILIATE_MARGIN_CENTS = 4_000

async function main() {
  const affiliateStripeAccountId = process.env.TEST_AFFILIATE_STRIPE_ACCOUNT_ID?.trim()
  const supplierStripeAccountId = process.env.TEST_SUPPLIER_STRIPE_ACCOUNT_ID?.trim()

  if (!affiliateStripeAccountId) {
    throw new Error("TEST_AFFILIATE_STRIPE_ACCOUNT_ID manquant dans .env")
  }
  if (!supplierStripeAccountId) {
    throw new Error("TEST_SUPPLIER_STRIPE_ACCOUNT_ID manquant dans .env")
  }

  const product = await prisma.product.findUnique({
    where: { id: PRODUCT_ID },
    include: { supplier: { select: { id: true, stripeAccountId: true } } },
  })
  if (!product) {
    throw new Error(`Product ${PRODUCT_ID} introuvable`)
  }
  if (!product.supplier.stripeAccountId?.trim()) {
    throw new Error("Product.supplierId n'a pas de stripeAccountId")
  }

  let affiliateProduct = await prisma.affiliateProduct.findFirst({
    where: { productId: product.id },
  })

  if (affiliateProduct) {
    affiliateProduct = await prisma.affiliateProduct.update({
      where: { id: affiliateProduct.id },
      data: {
        marginCents: AFFILIATE_MARGIN_CENTS,
        sellingPriceCents: LINE_TOTAL_CENTS,
      },
    })
  } else {
    const affiliate = await prisma.user.findFirst({
      where: { stripeAccountId: affiliateStripeAccountId, role: "AFFILIATE" },
    })
    if (!affiliate) {
      throw new Error(
        "Aucun AffiliateProduct lié et aucun affilié avec TEST_AFFILIATE_STRIPE_ACCOUNT_ID"
      )
    }
    affiliateProduct = await prisma.affiliateProduct.create({
      data: {
        affiliateId: affiliate.id,
        productId: product.id,
        sellingPriceCents: LINE_TOTAL_CENTS,
        marginCents: AFFILIATE_MARGIN_CENTS,
        isListed: true,
      },
    })
  }

  const priceClientCents = SUPPLIER_PRICE_CENTS + AFFILIATE_MARGIN_CENTS

  const order = await prisma.order.create({
    data: {
      status: "PENDING",
      currency: "eur",
      productId: product.id,
      supplierId: product.supplierId,
      affiliateId: affiliateProduct.affiliateId,
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
      affiliateStripeAccountId: affiliateStripeAccountId,
      totalCents: LINE_TOTAL_CENTS,
      paymentSettlementStatus: "PENDING",
    },
  })

  const stripe = getStripeClient()
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")

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
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/marketplace`,
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
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
