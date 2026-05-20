import * as Sentry from "@sentry/nextjs"

import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { AliExpressApiError, createAliExpressClient, unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"
import { requireSupplierOrAdminSession } from "@/lib/supplier-or-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function extractSystemTime(payload: unknown): string | null {
  const node = unwrapAliExpressMethodResponse(payload, "aliexpress.system.time.get")
  if (!node) return null
  const time = node.time ?? node.system_time ?? node.timestamp
  return typeof time === "string" ? time : time != null ? String(time) : null
}

export async function GET() {
  const session = await requireSupplierOrAdminSession()
  if (!session) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const configStatus = getAliExpressConfigStatus()
  if (!configStatus.configured) {
    return Response.json(
      {
        status: "error",
        error: configStatus.message,
        missing: configStatus.missing,
      },
      { status: 503 }
    )
  }

  try {
    const client = await createAliExpressClient()
    const payload = await client.request("aliexpress.system.time.get", {})
    const time = extractSystemTime(payload)
    return Response.json({ status: "ok", time })
  } catch (e) {
    if (!(e instanceof AliExpressApiError)) {
      Sentry.captureException(e)
    }
    const message = e instanceof Error ? e.message : "AliExpress health check failed"
    const status = e instanceof AliExpressApiError && e.rateLimited ? 429 : 502
    return Response.json(
      {
        status: "error",
        error: message,
        ...(e instanceof AliExpressApiError && e.code != null ? { code: e.code } : {}),
      },
      { status }
    )
  }
}
