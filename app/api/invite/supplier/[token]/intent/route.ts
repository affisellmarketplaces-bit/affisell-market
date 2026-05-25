import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { loadPublicSupplierInvitation } from "@/lib/supplier-invitation"
import { setSupplierInviteTokenCookie } from "@/lib/supplier-invite-cookie"
import {
  MERCHANT_COOKIE_OPTS,
  OAUTH_SIGNUP_INTENT_COOKIE,
} from "@/lib/oauth-cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Persist invite token for OAuth signup + credentials claim after redirect. */
export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const invite = await loadPublicSupplierInvitation(token)
  if (!invite || invite.expired) {
    return NextResponse.json({ error: "not_found_or_expired" }, { status: 404 })
  }

  const ok = await setSupplierInviteTokenCookie(token)
  if (!ok) {
    return NextResponse.json({ error: "cookie_failed" }, { status: 500 })
  }

  try {
    const jar = await cookies()
    jar.set(OAUTH_SIGNUP_INTENT_COOKIE, "SUPPLIER", {
      ...MERCHANT_COOKIE_OPTS,
      maxAge: 600,
    })
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true })
}
