import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { syncPendingStoreCustomDomains } from "@/lib/store-custom-domain-activation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const batch = await syncPendingStoreCustomDomains(40)
  return NextResponse.json({ ok: true, ...batch })
}
