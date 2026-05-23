/**
 * Vérifie HT / TVA / TTC / commission après un checkout Stripe Tax.
 *
 * Run: npx tsx scripts/check-order-vat.ts cs_test_…
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { calculateRefundSplit, calculateSplit } from "../lib/commission"
import { prisma } from "../lib/prisma"
import { getStripeClient } from "../lib/stripe"

const sessionId = process.argv[2]?.trim()
const TOLERANCE_CENTS = 2

function assertNear(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > TOLERANCE_CENTS) {
    throw new Error(`${label}: attendu ~${expected}, reçu ${actual}`)
  }
}

async function main() {
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/check-order-vat.ts <checkout_session_id>")
    process.exit(1)
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.error("❌ STRIPE_SECRET_KEY manquant")
    process.exit(1)
  }

  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["total_details.breakdown", "payment_intent"],
  })

  console.log("\n🔍 Session Stripe\n")
  console.log("  status:          ", session.status)
  console.log("  payment_status:  ", session.payment_status)
  console.log("  amount_subtotal: ", session.amount_subtotal, "(HT)")
  console.log("  amount_tax:      ", session.total_details?.amount_tax ?? "—", "(TVA)")
  console.log("  amount_total:    ", session.amount_total, "(TTC)")

  const ht = session.amount_subtotal ?? 0
  const tax = session.total_details?.amount_tax ?? 0
  const ttc = session.amount_total ?? 0

  if (session.payment_status === "paid") {
    assertNear(ht, 10_000, "HT session")
    assertNear(tax, 2_000, "TVA session (~20% FR)")
    assertNear(ttc, 12_000, "TTC session")
    console.log("\n  ✅ Montants session cohérents (100€ HT + 20€ TVA)\n")
  } else {
    console.log("\n  ⚠️  Paiement non finalisé — complète le checkout test puis relance.\n")
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId: sessionId }, { stripeSessionId: { startsWith: `${sessionId}:line:` } }],
    },
    include: {
      stripeRefunds: true,
      supplier: { select: { email: true, stripeAccountId: true } },
    },
  })

  if (orders.length === 0) {
    console.log("  ℹ️  Aucune commande en base pour cette session.")
    console.log("     Assure-toi que le webhook checkout.session.completed a tourné (npm run dev).\n")
    return
  }

  for (const order of orders) {
    console.log(`\n📦 Order ${order.id}\n`)
    console.log("  subtotalCents (HT):     ", order.subtotalCents)
    console.log("  taxCents:               ", order.taxCents)
    console.log("  totalCents (TTC):       ", order.totalCents)
    console.log("  taxCountry:             ", order.taxCountry)
    console.log("  platformCommissionCents:", order.platformCommissionCents)
    console.log("  sellerPayoutCents:      ", order.sellerPayoutCents)
    console.log("  stripeFeesCents:        ", order.stripeFeesCents)
    console.log("  paymentSettlement:      ", order.paymentSettlementStatus)
    console.log("  stripeTransferId:       ", order.stripeTransferId ?? "—")
    console.log("  supplier Connect:       ", order.supplier.stripeAccountId ?? "—")

    if (
      order.paymentSettlementStatus === "SETTLED" &&
      order.stripeTransferId &&
      (order.sellerPayoutCents ?? 0) > 0
    ) {
      console.log("\n  ✅ Commande SETTLED (transfer Connect OK)")
    } else if (order.paymentSettlementStatus === "PENDING") {
      console.log("\n  ⚠️  Encore PENDING — resend webhook checkout.session.completed")
    }

    const subtotal = order.subtotalCents ?? 0
    const taxCents = order.taxCents ?? 0
    const totalCents = order.totalCents ?? order.sellingPriceCents
    const fees = order.stripeFeesCents ?? 0

    if (subtotal > 0 && taxCents > 0) {
      const split = calculateSplit({
        subtotalCents: subtotal,
        shippingCents: order.shippingCents ?? 0,
        taxCents,
        stripeFeeCents: fees,
      })
      assertNear(split.commissionCents, Math.round(subtotal * 0.12), "commission recalculée")
      console.log("\n  ✅ calculateSplit aligné (commission sur HT uniquement)")

      const refundHalf = calculateRefundSplit(
        {
          totalCents,
          commissionCents: order.platformCommissionCents,
          taxCents,
        },
        Math.round(totalCents / 2)
      )
      console.log("  refund 50% prorata:     ", refundHalf)
    }

    if (order.stripeRefunds.length > 0) {
      console.log("\n  Remboursements:")
      for (const r of order.stripeRefunds) {
        console.log(
          `    - ${r.stripeRefundId}: ${r.amountCents}¢ | com ${r.commissionReturnedCents}¢ | TVA ${r.taxReturnedCents}¢`
        )
      }
    }
  }

  console.log("\n✅ Vérification terminée\n")
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
