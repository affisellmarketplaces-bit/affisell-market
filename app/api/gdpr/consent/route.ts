import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { parseCookieConsent, type CookieConsentPrefs } from "@/lib/legal/consent"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      cookieConsent: true,
      cguAcceptedAt: true,
      cguVersion: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
    },
  })
  return NextResponse.json({
    cookieConsent: parseCookieConsent(user?.cookieConsent),
    cguAcceptedAt: user?.cguAcceptedAt,
    cguVersion: user?.cguVersion,
    termsAcceptedAt: user?.termsAcceptedAt,
    privacyAcceptedAt: user?.privacyAcceptedAt,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = (await req.json().catch(() => null)) as Partial<CookieConsentPrefs> | null
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const prefs: CookieConsentPrefs = {
    essential: true,
    analytics: Boolean(raw.analytics),
    marketing: Boolean(raw.marketing),
    updatedAt: new Date().toISOString(),
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { cookieConsent: prefs },
    })
  } catch (e) {
    console.log("[cookie-consent]", {
      result: "db_update_failed",
      userId: session.user.id,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cookieConsent: prefs })
}
