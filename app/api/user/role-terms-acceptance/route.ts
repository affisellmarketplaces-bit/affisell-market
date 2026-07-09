import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logBusiness } from "@/lib/business-log"
import { recordLegalAcceptance, collectAcceptedCurrentVersionIds } from "@/lib/legal/acceptance"
import { setLegalOkCookie } from "@/lib/legal/legal-gate-cookie"
import { buildRoleTermsPayload } from "@/lib/legal/role-terms"
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

  const role = session.user.role
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return NextResponse.json({ error: "Role not eligible" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { acceptRoleTerms?: boolean }
  if (!body.acceptRoleTerms) {
    return NextResponse.json({ error: "acceptRoleTerms required" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: buildRoleTermsPayload(role),
    select: { id: true, termsAcceptedAt: true, termsAcceptedVersion: true },
  })

  console.log("[role-terms-acceptance]", {
    userId: user.id,
    role,
    termsAcceptedVersion: user.termsAcceptedVersion,
    result: "ok",
  })
  logBusiness("role-terms-acceptance", {
    userId: user.id,
    role,
    termsAcceptedVersion: user.termsAcceptedVersion,
    result: "ok",
  })

  await logTermsAcceptanceFromRequest(req, user.id, termsLogTypeForRole(role))

  await recordLegalAcceptance({
    userId: user.id,
    slug: role === "SUPPLIER" ? "supplier" : "affiliate",
    locale: "fr",
    context: "REACCEPT_MODAL",
    req,
  })

  const res = NextResponse.json({
    ok: true,
    termsAcceptedVersion: user.termsAcceptedVersion,
  })
  const versionIds = await collectAcceptedCurrentVersionIds(user.id, role)
  if (versionIds.length > 0) {
    setLegalOkCookie(res, versionIds)
  }
  setTermsOkCookie(res, role)
  return res
}
