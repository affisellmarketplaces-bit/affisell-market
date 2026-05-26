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
    select: { cookieConsent: true, termsAcceptedAt: true, privacyAcceptedAt: true },
  })
  return NextResponse.json({
    cookieConsent: parseCookieConsent(user?.cookieConsent),
    termsAcceptedAt: user?.termsAcceptedAt,
    privacyAcceptedAt: user?.privacyAcceptedAt,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as Partial<CookieConsentPrefs>
  const prefs: CookieConsentPrefs = {
    essential: true,
    analytics: Boolean(body.analytics),
    marketing: Boolean(body.marketing),
    updatedAt: new Date().toISOString(),
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { cookieConsent: prefs },
  })

  return NextResponse.json({ ok: true, cookieConsent: prefs })
}
