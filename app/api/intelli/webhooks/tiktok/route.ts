import { Prisma } from ".prisma/client-mi"
import { NextResponse } from "next/server"

import { assertMarketIntelliApiEnabled } from "@/lib/market-intelli/gate"
import {
  extractWebhookExternalId,
  verifyTikTokWebhookSignature,
} from "@/lib/market-intelli/tiktok-webhook"
import { getMiDb } from "@/lib/prisma-mi"

export async function POST(req: Request) {
  const blocked = assertMarketIntelliApiEnabled()
  if (blocked) return blocked

  const rawBody = await req.text()
  const signatureHeader = req.headers.get("x-tt-signature")

  try {
    verifyTikTokWebhookSignature(rawBody, signatureHeader)
  } catch (err) {
    console.error("[intelli/webhooks/tiktok]", {
      result: "signature_rejected",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const externalId = extractWebhookExternalId(rawBody, payload)
  const topic =
    typeof payload.type === "string"
      ? payload.type
      : typeof payload.event_type === "string"
        ? payload.event_type
        : null
  const shopIdRaw = payload.shop_id ?? payload.shopId
  const shopId = typeof shopIdRaw === "string" || typeof shopIdRaw === "number" ? String(shopIdRaw) : null

  try {
    await getMiDb().webhookEvent.create({
      data: {
        externalId,
        topic,
        shopId,
        payload: payload as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.log("[intelli/webhooks/tiktok]", { externalId, result: "duplicate" })
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error("[intelli/webhooks/tiktok]", {
      externalId,
      result: "db_error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  console.log("[intelli/webhooks/tiktok]", { externalId, topic, shopId, result: "stored" })
  return NextResponse.json({ ok: true })
}
