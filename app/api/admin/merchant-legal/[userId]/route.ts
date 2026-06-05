import { NextResponse } from "next/server"

import { loadAdminKycDetail } from "@/lib/admin/merchant-kyc/load-kyc-queue"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { logBusiness } from "@/lib/business-log"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ userId: string }> }

/** Admin: détail dossier KYC + documents. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { userId } = await ctx.params
  const detail = await loadAdminKycDetail(userId)
  if (!detail) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 })
  }

  return NextResponse.json({ detail })
}

/** Admin: approve or reject merchant KYC. */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { userId } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as {
    verificationStatus?: string
    rejectionReason?: string
  }

  const status = body.verificationStatus?.trim()
  if (status !== "APPROVED" && status !== "REJECTED" && status !== "NEEDS_MORE_INFO") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 })
  }

  const profile = await prisma.merchantLegalProfile.findUnique({ where: { userId } })
  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 })
  }

  await prisma.merchantLegalProfile.update({
    where: { userId },
    data: {
      verificationStatus: status,
      reviewedAt: new Date(),
      rejectionReason:
        status === "REJECTED" || status === "NEEDS_MORE_INFO"
          ? body.rejectionReason?.trim().slice(0, 500) ?? null
          : null,
    },
  })

  logBusiness("admin-merchant-legal", { userId, result: status, adminId: gate.session.user.id })
  return NextResponse.json({ ok: true, verificationStatus: status })
}
