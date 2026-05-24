import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { accountId?: string }
  const accountId = body.accountId?.trim()
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 })
  }

  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(accountId)
  const transfersActive = account.capabilities?.transfers === "active"

  let userUpdated = 0
  if (transfersActive) {
    const result = await prisma.user.updateMany({
      where: { stripeAccountId: accountId },
      data: { stripeOnboardedAt: new Date() },
    })
    userUpdated = result.count
  } else {
    await prisma.user.updateMany({
      where: { stripeAccountId: accountId },
      data: { stripeOnboardedAt: null },
    })
  }

  logStripeWebhookInfo({
    metric: "refresh_onboarding",
    accountId,
    transfers: account.capabilities?.transfers ?? null,
    userUpdated,
  })

  return NextResponse.json({
    accountId,
    transfers: account.capabilities?.transfers ?? null,
    transfersActive,
    userUpdated,
  })
}
