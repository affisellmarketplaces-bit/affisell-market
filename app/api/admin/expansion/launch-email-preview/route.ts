import { NextRequest, NextResponse } from "next/server"

import { renderCheckoutCountryLaunchEmailHtml } from "@/lib/emails/render-checkout-country-launch-email"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const countryRaw = req.nextUrl.searchParams.get("countryIso2")?.trim()
  const countryIso2 = countryRaw ? normalizeVisitorCountryIso2(countryRaw) : null
  if (!countryIso2) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 })
  }

  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr"
  const html = await renderCheckoutCountryLaunchEmailHtml({ countryIso2, locale })

  console.log("[expansion-rollout]", {
    userId: gate.session.user.id,
    countryIso2,
    locale,
    result: "launch_email_preview",
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
