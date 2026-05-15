import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  try {
    const { destination, amount, currency } = await req.json()

    const transfer = await stripe.transfers.create({
      amount,
      currency,
      destination,
    })

    return NextResponse.json({ success: true, transfer })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
