import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"

export async function POST() {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: "eur", product_data: { name: "Test HOLD" }, unit_amount: 2000 }, quantity: 1 }],
    success_url: "http://localhost:3000/success",
    cancel_url: "http://localhost:3000/cancel",
    payment_intent_data: { capture_method: "manual" }
  })
  return NextResponse.json({ url: session.url })
}
