import { NextRequest, NextResponse } from "next/server"

import { applyAutoDsTrackingUpdate } from "@/lib/autods/apply-tracking-update"
import { parseAutoDsWebhookBody } from "@/lib/autods/parse-webhook-payload"
import { verifyAutoDsWebhookSignature } from "@/lib/autods/verify-webhook-signature"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    null
  )
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const clientIp = readClientIp(req)
  const signature = req.headers.get("x-autods-signature")

  const sigCheck = verifyAutoDsWebhookSignature(rawBody, signature, clientIp)
  if (sigCheck === "invalid") {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const parsed = parseAutoDsWebhookBody(json)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = await applyAutoDsTrackingUpdate({
    payload: parsed.payload,
    source: "webhook",
    event: parsed.event,
    response: json,
  })

  console.log("[autods-webhook]", {
    event: parsed.event,
    autodsOrderId: parsed.payload.autodsOrderId,
    result: result.skipped ?? (result.updated ? "updated" : "ok"),
    ip: clientIp ?? "unknown",
    signature: sigCheck,
  })

  return NextResponse.json(
    {
      ok: true,
      orderId: result.orderId ?? null,
      skipped: result.skipped ?? null,
      updated: result.updated ?? false,
      emailSent: result.emailSent ?? false,
    },
    { status: 200 }
  )
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
