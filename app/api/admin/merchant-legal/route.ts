import { NextResponse } from "next/server"

import { loadAdminKycQueue, parseKycStatusFilter } from "@/lib/admin/merchant-kyc/load-kyc-queue"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Admin: liste des dossiers KYC marchands. */
export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const status = parseKycStatusFilter(url.searchParams.get("status"))
  const queue = await loadAdminKycQueue(status)

  return NextResponse.json(queue)
}
