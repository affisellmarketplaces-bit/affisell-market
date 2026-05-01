import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AMOUNT_CENTS = 500
const DELIVERABLE_DAYS = 7

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  const userId = session.user.id
  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: AMOUNT_CENTS,
          product_data: { name: "Paiement test 5€" },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/orders`,
    cancel_url: `${baseUrl}/test`,
    metadata: { userId },
    payment_intent_data: { metadata: { userId } },
  })

  let paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id

  if (!paymentIntentId) {
    const refreshed = await stripe.checkout.sessions.retrieve(checkoutSession.id, {
      expand: ["payment_intent"],
    })
    paymentIntentId =
      typeof refreshed.payment_intent === "string"
        ? refreshed.payment_intent
        : refreshed.payment_intent?.id
  }

  if (!paymentIntentId || !checkoutSession.url) {
    return NextResponse.json(
      { error: "Stripe Checkout incomplet (PaymentIntent ou URL manquant)" },
      { status: 502 }
    )
  }

  const deliverableAt = new Date(
    Date.now() + DELIVERABLE_DAYS * 24 * 60 * 60 * 1000
  )

  try {
    await prisma.order.create({
      data: {
        userId,
        amount: AMOUNT_CENTS,
        currency: "eur",
        deliverableAt,
        stripePaymentIntentId: paymentIntentId,
        status: "PENDING",
      },
    })
  } catch (dbError) {
    console.error("[checkout] prisma.order.create échec (détail) :", dbError)
    try {
      await stripe.checkout.sessions.expire(checkoutSession.id)
    } catch (expireErr) {
      console.error("[checkout] expire session Stripe :", expireErr)
    }
    return NextResponse.json(
      {
        error:
          "Impossible d’enregistrer la commande en base (Neon / PostgreSQL). Réessaie dans quelques secondes si la base venait de se réveiller.",
        code: "DATABASE_ORDER_CREATE_FAILED",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: checkoutSession.url })
}
