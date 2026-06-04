import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logBusiness } from "@/lib/business-log"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { stripeConnectBusinessUrl, stripeConnectReturnUrls } from "@/lib/stripe-connect-legal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, stripeAccountId: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.role !== "SUPPLIER" && user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Role not eligible for Connect" }, { status: 403 })
  }

  const stripe = getStripeClient()

  if (user.stripeAccountId) {
    const { refresh_url, return_url } = stripeConnectReturnUrls(user.role)
    const link = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      type: "account_onboarding",
      refresh_url,
      return_url,
    })
    return NextResponse.json({
      accountId: user.stripeAccountId,
      url: link.url,
      businessProfileUrl: stripeConnectBusinessUrl(user.role),
    })
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: user.email,
    business_profile: {
      url: stripeConnectBusinessUrl(user.role),
    },
    tos_acceptance: {
      service_agreement: "recipient",
    },
    capabilities: {
      transfers: { requested: true },
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeAccountId: account.id },
  })

  const { refresh_url, return_url } = stripeConnectReturnUrls(user.role)
  const link = await stripe.accountLinks.create({
    account: account.id,
    type: "account_onboarding",
    refresh_url,
    return_url,
  })

  logBusiness("stripe-connect", {
    userId: user.id,
    role: user.role,
    accountId: account.id,
    businessProfileUrl: stripeConnectBusinessUrl(user.role),
    result: "created",
  })

  console.log("[stripe-connect/create-account]", {
    userId: user.id,
    role: user.role,
    accountId: account.id,
    businessProfileUrl: stripeConnectBusinessUrl(user.role),
  })

  return NextResponse.json({
    accountId: account.id,
    url: link.url,
    businessProfileUrl: stripeConnectBusinessUrl(user.role),
  })
}
