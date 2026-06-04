import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logBusiness } from "@/lib/business-log"
import { buildRoleTermsPayload } from "@/lib/legal/role-terms"
import { logTermsAcceptance } from "@/lib/legal/terms-acceptance-log"
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

  await logTermsAcceptance(req, user.id, termsLogTypeForRole(role))

  const res = NextResponse.json({
    ok: true,
    termsAcceptedVersion: user.termsAcceptedVersion,
  })
  setTermsOkCookie(res, role)
  return res
}
