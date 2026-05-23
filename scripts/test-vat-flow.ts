/**
 * Stripe Tax test flow (mode test) — France ~20% VAT on HT.
 *
 * Run:
 *   npx tsx scripts/test-vat-flow.ts
 *   npx tsx scripts/test-vat-flow.ts --math-only
 *
 * Env (.env / .env.local):
 *   STRIPE_SECRET_KEY
 *   DATABASE_URL
 *   TEST_STRIPE_CONNECT_ACCOUNT_ID  — Connect Express test account (acct_…)
 *   NEXT_PUBLIC_APP_URL             — success/cancel URLs (default http://localhost:3001)
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { calculateRefundSplit, calculateSplit, COMMISSION_RATE } from "../lib/commission"
import { marketplaceCheckoutTaxOptions } from "../lib/marketplace-stripe-checkout"
import { prisma } from "../lib/prisma"
import { getStripeClient } from "../lib/stripe"
import { appBaseUrl } from "../lib/stripe-pro"

const HT_CENTS = 10_000
const EXPECTED_TAX_CENTS = 2_000
const EXPECTED_TOTAL_CENTS = 12_000
const STRIPE_FEE_CENTS = 373

const RUN_TAG = process.env.TEST_VAT_RUN_TAG?.trim() || `vat-${Date.now()}`
const SUPPLIER_EMAIL = `vat-supplier-${RUN_TAG}@affisell.test`
const AFFILIATE_EMAIL = `vat-affiliate-${RUN_TAG}@affisell.test`
const TEST_PRODUCT_ID =
  process.env.TEST_VAT_PRODUCT_ID?.trim() || "cmpiddd890003thlps6tp"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function runMathChecks(): void {
  console.log("\n📐 Vérification calculateSplit / calculateRefundSplit (offline)\n")

  const split = calculateSplit({
    subtotalCents: HT_CENTS,
    shippingCents: 0,
    taxCents: EXPECTED_TAX_CENTS,
    stripeFeeCents: STRIPE_FEE_CENTS,
  })

  assert(split.commissionCents === Math.round(HT_CENTS * COMMISSION_RATE), "commission 12% HT")
  assert(split.commissionCents === 1200, `commission attendue 1200, reçu ${split.commissionCents}`)
  assert(split.totalCents === EXPECTED_TOTAL_CENTS, "total TTC")
  assert(split.sellerPayoutCents === 10_427, `seller payout attendu 10427, reçu ${split.sellerPayoutCents}`)

  const refund50 = calculateRefundSplit(
    { totalCents: EXPECTED_TOTAL_CENTS, commissionCents: 1200, taxCents: EXPECTED_TAX_CENTS },
    6000
  )
  assert(refund50.commissionReturnedCents === 600, "refund 50% commission")
  assert(refund50.taxReturnedCents === 1000, "refund 50% TVA")

  const refund100 = calculateRefundSplit(
    { totalCents: EXPECTED_TOTAL_CENTS, commissionCents: 1200, taxCents: EXPECTED_TAX_CENTS },
    EXPECTED_TOTAL_CENTS
  )
  assert(refund100.commissionReturnedCents === 1200, "refund 100% commission")
  assert(refund100.taxReturnedCents === 2000, "refund 100% TVA")

  console.log("  ✅ HT → TTC → commission HT → refund prorata OK\n")
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  )
}

/**
 * Resolve supplier by Connect account (unique). Never upsert on email when acct is taken.
 */
async function ensureTestSupplier(stripeAccountId: string) {
  const name = "Vendeur Test TVA"
  const vatNumber = "FR12345678901"

  const existing = await prisma.user.findUnique({
    where: { stripeAccountId },
  })

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name, vatNumber },
    })
  }

  try {
    return await prisma.user.create({
      data: {
        email: SUPPLIER_EMAIL,
        name,
        role: "SUPPLIER",
        stripeAccountId,
        vatNumber,
      },
    })
  } catch (e) {
    if (isPrismaUniqueViolation(e)) {
      const raced = await prisma.user.findUnique({ where: { stripeAccountId } })
      if (raced) {
        return prisma.user.update({
          where: { id: raced.id },
          data: { name, vatNumber },
        })
      }
    }
    throw e
  }
}

async function ensureTestAffiliate() {
  return prisma.user.upsert({
    where: { email: AFFILIATE_EMAIL },
    create: {
      email: AFFILIATE_EMAIL,
      name: "Affilié Test TVA",
      role: "AFFILIATE",
    },
    update: { name: "Affilié Test TVA" },
  })
}

async function ensureTestUsers(stripeAccountId: string) {
  const supplier = await ensureTestSupplier(stripeAccountId)
  const affiliate = await ensureTestAffiliate()
  return { supplier, affiliate }
}

async function ensureAffiliateListing(productId: string, affiliateId: string) {
  const existing = await prisma.affiliateProduct.findFirst({
    where: { productId, affiliateId },
  })
  if (existing) {
    return prisma.affiliateProduct.update({
      where: { id: existing.id },
      data: { sellingPriceCents: HT_CENTS, isListed: true },
    })
  }
  return prisma.affiliateProduct.create({
    data: {
      affiliateId,
      productId,
      sellingPriceCents: HT_CENTS,
      isListed: true,
    },
  })
}

async function ensureTestListing(supplierId: string, affiliateId: string) {
  const pinned = await prisma.product.findUnique({ where: { id: TEST_PRODUCT_ID } })

  const product = pinned
    ? await prisma.product.update({
        where: { id: TEST_PRODUCT_ID },
        data: {
          supplierId,
          name: "Produit Test TVA Affisell",
          description: "Produit de test Stripe Tax — 100€ HT",
          basePriceCents: HT_CENTS,
          active: true,
          isDraft: false,
        },
      })
    : await prisma.product.create({
        data: {
          id: TEST_PRODUCT_ID,
          supplierId,
          name: "Produit Test TVA Affisell",
          description: "Produit de test Stripe Tax — 100€ HT",
          basePriceCents: HT_CENTS,
          commissionRate: 10,
          stock: 99,
          active: true,
          isDraft: false,
          images: [],
        },
      })

  const listing = await ensureAffiliateListing(product.id, affiliateId)
  return { product, listing }
}

async function createCheckoutSession(args: {
  sellerId: string
  productId: string
  affiliateProductId: string
  productName: string
}) {
  const stripe = getStripeClient()
  const base = appBaseUrl()

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: HT_CENTS,
          tax_behavior: "exclusive",
          product_data: { name: args.productName },
        },
        quantity: 1,
      },
    ],
    ...marketplaceCheckoutTaxOptions(),
    customer_email: "client-test@affisell.test",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["FR"],
    },
    success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/marketplace`,
    payment_intent_data: {
      metadata: {
        flow: "marketplace",
        sellerId: args.sellerId,
        productId: args.productId,
        affiliateProductId: args.affiliateProductId,
        testVatRun: RUN_TAG,
      },
    },
    metadata: {
      flow: "marketplace_vat_test",
      sellerId: args.sellerId,
      productId: args.productId,
      affiliateProductId: args.affiliateProductId,
      supplierId: args.sellerId,
      affiliateId: args.affiliateProductId,
      testVatRun: RUN_TAG,
    },
  })

  return session
}

async function main() {
  const mathOnly = process.argv.includes("--math-only")

  console.log("🧪 Test TVA Affisell (Stripe Tax, FR ~20%)\n")
  runMathChecks()

  if (mathOnly) {
    console.log("Mode --math-only : pas de session Stripe créée.")
    return
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey) {
    console.error("❌ STRIPE_SECRET_KEY manquant")
    process.exit(1)
  }

  const connectAccount = process.env.TEST_STRIPE_CONNECT_ACCOUNT_ID?.trim()
  if (!connectAccount) {
    console.error("❌ TEST_STRIPE_CONNECT_ACCOUNT_ID manquant (compte Connect test acct_…)")
    process.exit(1)
  }

  const { supplier, affiliate } = await ensureTestUsers(connectAccount)
  const { product, listing } = await ensureTestListing(supplier.id, affiliate.id)

  let session
  try {
    session = await createCheckoutSession({
      sellerId: supplier.id,
      productId: product.id,
      affiliateProductId: listing.id,
      productName: product.name,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("head office address") && msg.includes("automatic tax")) {
      console.error("\n❌ Stripe Tax non configuré en mode test.")
      console.error("   Dashboard → Tax → adresse du siège social (mode test):")
      console.error("   https://dashboard.stripe.com/test/settings/tax\n")
      process.exit(1)
    }
    throw e
  }

  if (!session.url) {
    console.error("❌ Session Stripe sans URL")
    process.exit(1)
  }

  console.log("✅ Session Checkout créée (automatic_tax + tax_behavior: exclusive)\n")
  console.log(`   Vendeur:     ${supplier.email} (${supplier.id})`)
  console.log(`   Connect:     ${connectAccount}`)
  console.log(`   Produit:     ${product.id} (HT ${(HT_CENTS / 100).toFixed(2)} €)`)
  console.log(`   Listing:     ${listing.id}\n`)
  console.log("👉 Ouvre et paie en mode test:")
  console.log(`   ${session.url}\n`)
  console.log("👉 Carte: 4242 4242 4242 4242 · Date future · CVC 123")
  console.log("👉 Adresse FR pour TVA 20%: code postal 75001, pays France\n")
  console.log("Session ID:", session.id)
  console.log("\nAprès paiement (webhook local actif), vérifie:")
  console.log(`   npx tsx scripts/check-order-vat.ts ${session.id}\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
