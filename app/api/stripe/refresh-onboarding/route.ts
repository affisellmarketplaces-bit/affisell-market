import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { prisma } from "@/lib/prisma"
import { safeAuth } from "@/lib/safe-auth"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookError, logStripeWebhookInfo, stripeErrorFields } from "@/lib/stripe-webhook-observability"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Same roles as `POST /api/stripe/connect/create-account`: whoever can open a Connect account can resync it. */
const CONNECT_ROLES = new Set(["SUPPLIER", "AFFILIATE", "AGENT"])

/**
 * Re-reads the signed-in user's OWN Connect account from Stripe and stores its onboarding state.
 *
 * The state is always Stripe's, never the caller's, but the route used to take any `acct_…` from the body with no
 * session: anyone could spend the platform's Stripe quota and learn whether an account id belongs to a user. It now
 * acts on the account of the session user only; a body `accountId` is accepted for the existing client but must match.
 */
export async function POST(req: Request) {
  const session = await safeAuth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limited = rateLimitResponse(rateLimitClientKey(req, userId), {
    prefix: "stripe-refresh-onboarding",
    limit: 10,
    windowMs: 60_000,
  })
  if (limited) return limited

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, stripeAccountId: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (!CONNECT_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Role not eligible for Connect" }, { status: 403 })
  }
  const accountId = user.stripeAccountId?.trim()
  if (!accountId) {
    return NextResponse.json({ error: "no_stripe_account" }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as { accountId?: string }
  const requestedAccountId = body.accountId?.trim()
  if (requestedAccountId && requestedAccountId !== accountId) {
    return NextResponse.json({ error: "forbidden_account" }, { status: 403 })
  }

  let account: Awaited<ReturnType<ReturnType<typeof getStripeClient>["accounts"]["retrieve"]>>
  try {
    account = await getStripeClient().accounts.retrieve(accountId)
  } catch (error) {
    logStripeWebhookError({ ...stripeErrorFields(error), metric: "refresh_onboarding_failed", accountId })
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 502 })
  }
  const transfersActive = account.capabilities?.transfers === "active"

  const capabilities = (account.capabilities ?? undefined) as Prisma.InputJsonValue | undefined
  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: {
      stripeOnboardedAt: transfersActive ? new Date() : null,
      stripeCapabilities: capabilities,
    },
  })
  const userUpdated = transfersActive ? result.count : 0

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
