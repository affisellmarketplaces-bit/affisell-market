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

/**
 * TikTok Partner Center webhook:
 * POST https://affisell.com/api/webhooks/tiktok
 *
 * CRITICAL: always respond 200 {code:0} quickly — process in `after()`.
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signatureHeader = resolveTikTokSignatureHeader(req)

  try {
    verifyTikTokWebhookSignature(rawBody, signatureHeader)
  } catch (err) {
    console.error("[webhooks/tiktok]", {
      result: "signature_rejected",
      message: err instanceof Error ? err.message : String(err),
    })
    // Still 200 for Partner retries on bad probes? No — 401 for real auth failures.
    // TikTok may disable on non-2xx; signature fail should stay 401.
    return NextResponse.json({ code: 401, message: "unauthorized" }, { status: 401 })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json(OK)
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
    return NextResponse.json(OK)
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
      return NextResponse.json(OK)
    }
    console.error("[webhooks/tiktok]", {
      externalId,
      result: "db_error",
      message: err instanceof Error ? err.message : String(err),
    })
    // Still ACK to avoid Partner disable — log already attempted
    return NextResponse.json(OK)
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
  return NextResponse.json(OK)
}
