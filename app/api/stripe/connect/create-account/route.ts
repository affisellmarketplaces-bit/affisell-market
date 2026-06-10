import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logBusiness } from "@/lib/business-log"
import {
  clientIpFromRequest,
  errorMessage,
  errorStackSnippet,
  flushLogs,
  logger,
} from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { stripeConnectBusinessUrl, stripeConnectReturnUrls } from "@/lib/stripe-connect-legal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROUTE = "stripe/connect/create-account"

export async function POST(req: Request) {
  try {
    const ip = clientIpFromRequest(req)
    await logger.info("Stripe Connect create-account", { route: ROUTE, ip })

    const session = await auth()
    if (!session?.user?.id) {
      await logger.warn("Connect unauthorized", { route: ROUTE, ip })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true, stripeAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.role !== "SUPPLIER" && user.role !== "AFFILIATE" && user.role !== "AGENT") {
      await logger.warn("Connect role not eligible", { route: ROUTE, userId: user.id, role: user.role })
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
      await logger.info("Connect onboarding link (existing account)", {
        route: ROUTE,
        userId: user.id,
        accountId: user.stripeAccountId,
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

    await logger.info("Connect account created", {
      route: ROUTE,
      userId: user.id,
      role: user.role,
      accountId: account.id,
    })

    return NextResponse.json({
      accountId: account.id,
      url: link.url,
      businessProfileUrl: stripeConnectBusinessUrl(user.role),
    })
  } catch (e) {
    Sentry.captureException(e)
    await logger.error("Connect create-account failed", {
      route: ROUTE,
      error: errorMessage(e),
      stack: errorStackSnippet(e),
    })
    return NextResponse.json({ error: "Connect onboarding failed" }, { status: 500 })
  } finally {
    await flushLogs()
  }
}
