import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { appBaseUrl } from "@/lib/app-base-url"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import {
  SPONSOR_DURATIONS_DAYS,
  SPONSOR_FLOW_METADATA,
  SPONSOR_PLACEMENTS,
  SPONSOR_STATUS,
  type SponsorDurationDays,
  type SponsorPlacement,
} from "@/lib/sponsor/sponsor-constants"
import { loadSponsorHtCents, resolveSponsorTarget } from "@/lib/sponsor/sponsor-access"
import { quoteSponsorCampaign } from "@/lib/sponsor/sponsor-pricing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  productId?: string
  affiliateProductId?: string
  sponsorRateBps?: number
  durationDays?: number
  placement?: string
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const role = session?.user?.role
  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const target = await resolveSponsorTarget(userId, role, body)
  if ("error" in target) {
    return NextResponse.json({ error: target.error }, { status: target.status })
  }

  const durationDays = Number(body.durationDays ?? 7) as SponsorDurationDays
  if (!SPONSOR_DURATIONS_DAYS.includes(durationDays)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 })
  }

  const placement = (body.placement ?? "HOME_SPOTLIGHT") as SponsorPlacement
  if (!SPONSOR_PLACEMENTS.includes(placement)) {
    return NextResponse.json({ error: "Invalid placement" }, { status: 400 })
  }

  const htCents = await loadSponsorHtCents(target)
  const quote = quoteSponsorCampaign({
    htCents,
    sponsorRateBps: Number(body.sponsorRateBps ?? 500),
    durationDays,
    placement,
  })

  const campaign = await prisma.sponsorCampaign.create({
    data: {
      payerUserId: userId,
      payerRole: target.payerRole,
      productId: target.productId,
      affiliateProductId: target.affiliateProductId,
      sponsorRateBps: quote.sponsorRateBps,
      htCentsSnapshot: quote.htCents,
      feeCents: quote.feeCents,
      durationDays: quote.durationDays,
      placement: quote.placement,
      boostScore: quote.boostScore,
      status: SPONSOR_STATUS.PENDING_PAYMENT,
      setsListingFeatured: target.payerRole === "AFFILIATE",
    },
  })

  const stripe = getStripeClient()
  const base = appBaseUrl()
  const returnPath =
    target.payerRole === "SUPPLIER"
      ? "/dashboard/supplier/promote"
      : "/dashboard/affiliate/promote"

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: quote.feeCents,
          product_data: {
            name: `Affisell Promote — ${placement.replace(/_/g, " ")}`,
            description: `${quote.ratePercent}% HT · ${durationDays} jours`,
          },
        },
      },
    ],
    success_url: `${base}${returnPath}?success=1&campaign=${campaign.id}`,
    cancel_url: `${base}${returnPath}?canceled=1`,
    metadata: {
      flow: SPONSOR_FLOW_METADATA,
      campaignId: campaign.id,
      userId,
      payerRole: target.payerRole,
    },
  })

  await prisma.sponsorCampaign.update({
    where: { id: campaign.id },
    data: { stripeCheckoutSessionId: checkoutSession.id },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe checkout URL missing" }, { status: 502 })
  }

  return NextResponse.json({
    campaignId: campaign.id,
    url: checkoutSession.url,
    quote,
  })
}
