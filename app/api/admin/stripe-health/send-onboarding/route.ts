import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  accountId: z.string().min(1),
})

function onboardingReturnUrls() {
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3001"
  return {
    refresh_url: `${app}/admin/stripe-health`,
    return_url: `${app}/admin/stripe-health?onboarded=1`,
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const accountId = parsed.data.accountId.trim()
  const stripe = getStripeClient()
  const { refresh_url, return_url } = onboardingReturnUrls()

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url,
    return_url,
  })

  logStripeWebhookInfo({
    level: "info",
    metric: "admin_send_onboarding_link",
    accountId,
    url: link.url,
  })

  console.log(
    JSON.stringify({
      level: "info",
      metric: "AFFILIATE_ONBOARDING_URL",
      accountId,
      url: link.url,
    })
  )

  return NextResponse.json({ ok: true, accountId, url: link.url })
}
