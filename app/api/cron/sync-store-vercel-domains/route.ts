import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { syncPendingStoreCustomDomains } from "@/lib/store-custom-domain-activation"
import { syncPendingStoreSubdomains } from "@/lib/store-subdomain-provisioning"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const [customDomains, subdomains] = await Promise.all([
    syncPendingStoreCustomDomains(40),
    syncPendingStoreSubdomains(50),
  ])
  return NextResponse.json({ ok: true, customDomains, subdomains })
}
