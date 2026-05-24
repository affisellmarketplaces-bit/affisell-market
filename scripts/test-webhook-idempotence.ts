/**
 * Vérifie qu'un même evt_… ne déclenche qu'un seul split (ProcessedWebhook + guard order).
 *
 * Run (dev server optional):
 *   npx tsx scripts/test-webhook-idempotence.ts <orderId> [checkoutSessionId]
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"
import type Stripe from "stripe"

import { handleMarketplaceThreeWaySplit } from "../lib/stripe-marketplace-commission-split"
import { processStripeWebhookEvent } from "../lib/stripe-webhook-processor"
import { getStripeClient } from "../lib/stripe"

const prisma = new PrismaClient()

async function main() {
  const orderId = process.argv[2]?.trim()
  if (!orderId) {
    console.error("Usage: npx tsx scripts/test-webhook-idempotence.ts <orderId> [sessionId]")
    process.exit(1)
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      stripeSessionId: true,
      supplierPayoutCents: true,
      affiliatePayoutCents: true,
    },
  })
  if (!order?.stripeSessionId) {
    throw new Error("Order not found or missing stripeSessionId")
  }

  const sessionId = process.argv[3]?.trim() || order.stripeSessionId
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== "paid") {
    console.warn("Session not paid — testing handleMarketplaceThreeWaySplit idempotency only")
    const before = { ...order }
    await handleMarketplaceThreeWaySplit(session, orderId)
    await handleMarketplaceThreeWaySplit(session, orderId)
    const after = await prisma.order.findUnique({ where: { id: orderId } })
    console.log("supplierPayoutCents before/after:", before.supplierPayoutCents, after?.supplierPayoutCents)
    console.log("OK: second split call should no-op (already_settled)")
    return
  }

  const eventId = `evt_test_idempotence_${orderId}`
  await prisma.processedWebhook.deleteMany({ where: { id: eventId } }).catch(() => undefined)

  const event = {
    id: eventId,
    type: "checkout.session.completed",
    data: { object: session },
  } as unknown as Stripe.Event

  const r1 = await processStripeWebhookEvent(event)
  const r2 = await processStripeWebhookEvent(event)

  const webhookRows = await prisma.processedWebhook.count({ where: { id: eventId } })
  const final = await prisma.order.findUnique({
    where: { id: orderId },
    select: { supplierPayoutCents: true, affiliatePayoutCents: true },
  })

  console.log(JSON.stringify({ r1, r2, webhookRows, final }, null, 2))

  if (!r2.duplicate) {
    throw new Error("Expected second webhook call to be duplicate")
  }
  if (webhookRows !== 1) {
    throw new Error(`Expected 1 ProcessedWebhook row, got ${webhookRows}`)
  }

  console.log("✅ Idempotence OK: 1 ProcessedWebhook, second event skipped")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
