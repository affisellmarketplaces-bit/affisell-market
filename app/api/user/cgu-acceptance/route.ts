import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logBusiness } from "@/lib/business-log"
import { buildConsentPayload } from "@/lib/legal/consent"
import { logTermsAcceptanceFromRequest } from "@/lib/terms-logger"
import { setTermsOkCookie } from "@/lib/legal/terms-acceptance-cookie"
import { termsLogTypeForRole } from "@/lib/legal-versions"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    acceptCgu?: boolean
    acceptRoleTerms?: boolean
    acceptPrivacy?: boolean
  }
  if (!body.acceptCgu || !body.acceptPrivacy) {
    return NextResponse.json({ error: "CGU et confidentialité requises" }, { status: 400 })
  }

  const role = session.user.role
  if ((role === "AFFILIATE" || role === "SUPPLIER") && !body.acceptRoleTerms) {
    return NextResponse.json({ error: "Conditions rôle requises" }, { status: 400 })
  }

  const consent =
    role === "AFFILIATE" || role === "SUPPLIER"
      ? buildConsentPayload(role)
      : { ...buildConsentPayload("CUSTOMER") }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: consent,
    select: { id: true, cguVersion: true, cguAcceptedAt: true },
  })

  logBusiness("cgu-acceptance", { userId: user.id, cguVersion: user.cguVersion, result: "ok" })

  await logTermsAcceptanceFromRequest(req, user.id, "cgu")
  if (role === "AFFILIATE" || role === "SUPPLIER") {
    await logTermsAcceptanceFromRequest(req, user.id, termsLogTypeForRole(role))
  }

  const res = NextResponse.json({ ok: true, cguVersion: user.cguVersion })
  if (role === "AFFILIATE" || role === "SUPPLIER") {
    setTermsOkCookie(res, role)
  }
  return res
}
