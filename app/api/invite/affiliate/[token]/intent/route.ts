import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { setAffiliateInviteTokenCookie } from "@/lib/affiliate-invite-cookie"
import {
  MERCHANT_COOKIE_OPTS,
  OAUTH_SIGNUP_INTENT_COOKIE,
} from "@/lib/oauth-cookies"
import { loadPublicAffiliateInvitation } from "@/lib/supplier-affiliate-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const invite = await loadPublicAffiliateInvitation(token)
  if (!invite || invite.expired) {
    return NextResponse.json({ error: "not_found_or_expired" }, { status: 404 })
  }

  const ok = await setAffiliateInviteTokenCookie(token)
  if (!ok) {
    return NextResponse.json({ error: "cookie_failed" }, { status: 500 })
  }

  try {
    const jar = await cookies()
    jar.set(OAUTH_SIGNUP_INTENT_COOKIE, "AFFILIATE", {
      ...MERCHANT_COOKIE_OPTS,
      maxAge: 600,
    })
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true })
}
