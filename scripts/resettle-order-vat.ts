/**
 * Re-run three-way Connect settlement for a checkout session (local fix / after resend webhook).
 *
 * Run: npx tsx scripts/resettle-order-vat.ts cs_test_…
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import {
  findOrderIdsForCheckoutSession,
  handleStripeCommissionSplit,
} from "../lib/stripe-marketplace-commission-split"
import { prisma } from "../lib/prisma"
import { getStripeClient } from "../lib/stripe"

const sessionId = process.argv[2]?.trim()

async function main() {
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/resettle-order-vat.ts <checkout_session_id>")
    process.exit(1)
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.error("❌ STRIPE_SECRET_KEY manquant")
    process.exit(1)
  }

  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })

  console.log("\n🔁 Resettle three-way split\n")
  console.log("  sessionId:       ", session.id)
  console.log("  payment_status:  ", session.payment_status)
  console.log("  amount_subtotal: ", session.amount_subtotal, "(HT)")
  console.log("  amount_tax:      ", session.total_details?.amount_tax ?? "—", "(TVA)")
  console.log("  amount_total:    ", session.amount_total, "(TTC)")

  if (session.payment_status !== "paid") {
    throw new Error("Session not paid — complete checkout first")
  }

  const orderIdFromMeta = session.metadata?.orderId?.trim()
  const orderIds = orderIdFromMeta
    ? [orderIdFromMeta]
    : await findOrderIdsForCheckoutSession(session.id)

  if (orderIds.length === 0) {
    throw new Error("No order found for session")
  }

  for (const orderId of orderIds) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new Error(`Order not found: ${orderId}`)
    }

    console.log("\n  orderId:              ", orderId)
    console.log("  supplierPriceCents:   ", order.supplierPriceCents)
    console.log("  affiliateMarginCents: ", order.affiliateMarginCents)
    console.log("  paymentSettlement:    ", order.paymentSettlementStatus)

    if (order.supplierPriceCents == null) {
      throw new Error("Order not migrated to three-way split")
    }

    await handleStripeCommissionSplit(session, orderId)
  }

  console.log("\n✅ Resettle terminé\n")
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
