import { Prisma } from ".prisma/client-mi"
import { after, NextResponse } from "next/server"

import { getRadarDb } from "@/lib/prisma-radar"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import {
  extractWebhookExternalId,
  resolveTikTokSignatureHeader,
  verifyTikTokWebhookSignature,
} from "@/lib/radar/tiktok-webhook"
import { processTikTokWebhookEvent } from "@/lib/tiktok/webhook-processor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OK = { code: 0, message: "success" } as const

function ack(): NextResponse {
  return NextResponse.json(OK, { status: 200 })
}

/**
 * TikTok Partner Center webhook:
 * POST https://affisell.com/api/webhooks/tiktok
 *
 * CRITICAL: always respond 200 {code:0} quickly — process in `after()`.
 * Partner test tool often sends unsigned probes; never 401 those.
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signatureHeader = resolveTikTokSignatureHeader(req)

  let signatureOk = false
  if (signatureHeader) {
    try {
      verifyTikTokWebhookSignature(rawBody, signatureHeader)
      signatureOk = true
    } catch (err) {
      console.warn("[webhooks/tiktok]", {
        result: "signature_invalid_ack_anyway",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  } else {
    console.warn("[webhooks/tiktok]", {
      result: "unsigned_test_ack",
      note: "TikTok test tool / curl without signature — ACK only",
    })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return ack()
  }

  // Unsigned / invalid signature: ACK for Partner probes, do not process.
  if (!signatureOk) {
    return ack()
  }

  const externalId = extractWebhookExternalId(rawBody, payload)
  const type =
    typeof payload.type === "string" || typeof payload.type === "number"
      ? String(payload.type)
      : typeof payload.event_type === "string"
        ? payload.event_type
        : null
  const shopIdRaw = payload.shop_id ?? payload.shopId
  const shopId =
    typeof shopIdRaw === "string" || typeof shopIdRaw === "number" ? String(shopIdRaw) : null

  if (!resolveRadarDatabaseUrl()) {
    console.warn("[webhooks/tiktok]", { result: "no_db", externalId })
    return ack()
  }

  let logId: string | undefined
  try {
    const db = getRadarDb()
    const log = await db.tikTokWebhookLog.create({
      data: {
        externalId,
        type,
        shopId,
        status: "received",
        payload: payload as Prisma.InputJsonValue,
      },
    })
    logId = log.id

    await db.webhookEvent.create({
      data: {
        externalId,
        topic: type,
        shopId,
        connectorId: "tiktok_shop",
        payload: payload as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.log("[webhooks/tiktok]", { externalId, result: "duplicate" })
      return ack()
    }
    console.error("[webhooks/tiktok]", {
      externalId,
      result: "db_error",
      message: err instanceof Error ? err.message : String(err),
    })
    return ack()
  }

  after(() =>
    processTikTokWebhookEvent({
      externalId,
      payload: payload as {
        type?: string | number
        shop_id?: string | number
        shopId?: string | number
        data?: Record<string, unknown>
      },
      logId,
    })
  )

  console.log("[webhooks/tiktok]", { externalId, type, shopId, result: "acked" })
  return ack()
}
