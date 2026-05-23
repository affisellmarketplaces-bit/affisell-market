import { prisma } from "../lib/prisma"
import "dotenv/config"

async function main() {
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
    where: { id: "test_product_3way" },
    update: {},
    create: {
      id: "test_product_3way",
      name: "Test Three Way Split",
      description: "Test Three Way Split",
      supplierId: supplier.id,
      basePriceCents: 10000,
      commissionRate: 10,
    },
  })

  const listing = await prisma.affiliateProduct.upsert({
    where: { id: "test_listing_3way" },
    update: { sellingPriceCents: 13000 },
    create: {
      id: "test_listing_3way",
      affiliateId: affiliate.id,
      productId: product.id,
      sellingPriceCents: 13000,
      isListed: true,
    },
  })

  const sessionKey = `cs_test_3way_${Date.now()}`
  const order = await prisma.order.create({
    data: {
      status: "paid",
      currency: "EUR",
      productId: product.id,
      affiliateProductId: listing.id,
      supplierId: supplier.id,
      affiliateId: affiliate.id,
      quantity: 1,
      customerEmail: "buyer@test.affisell",
      shippingAddress: { country: "FR" },
      basePriceCents: 10000,
      sellingPriceCents: 13000,
      commissionCents: 1000,
      marginCents: 3000,
      affiliatePayoutCents: 0,
      stripeSessionId: sessionKey,
      supplierPriceCents: 10000,
      supplierCommissionRateBps: 1000,
      affiliateMarginCents: 3000,
      affisellCommissionRateBps: 1200,
      affiliateStripeAccountId: affiliate.stripeAccountId,
      stripePaymentIntentId: "pi_test_" + Date.now(),
      stripeChargeId: "ch_test_" + Date.now(),
    },
  })

  console.log("Order created:", order.id)
  console.log("Attendu: Total 145.60€ | Supplier 90.00€ | Affiliate 40.00€ | Affisell 15.60€")
  return order.id
}

main().then(console.log).catch(console.error).finally(() => prisma.$disconnect())
