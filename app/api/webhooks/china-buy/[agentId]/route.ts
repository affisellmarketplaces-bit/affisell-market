import { createHmac, timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { applyChinaBuyWebhookStatus } from "@/lib/china-buying/apply-china-buy-webhook-status"
import { isChinaBuyingAgentId } from "@/lib/china-buying/china-buying-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    external_ref: z.string().min(1),
    status: z.string().min(1),
    message: z.string().optional(),
  })
  .strict()

function webhookSecretForAgent(agentId: string): string | null {
  if (agentId === "superbuy") {
    return process.env.SUPERBUY_WEBHOOK_SECRET?.trim() || null
  }
  if (agentId === "anovabuy") {
    return process.env.ANOVABUY_WEBHOOK_SECRET?.trim() || null
  }
  return null
}

function verifyHmac(secret: string, raw: string, sigHeader: string | null): boolean {
  if (!sigHeader) return false
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex")
  const provided = sigHeader.replace(/^sha256=/i, "").trim()
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))
  } catch {
    return false
  }
}

type RouteContext = { params: Promise<{ agentId: string }> }

/** Superbuy / Anovabuy order status webhooks (HMAC via env secret). */
export async function POST(req: NextRequest, context: RouteContext) {
  const { agentId: rawAgentId } = await context.params
  const agentId = rawAgentId.trim().toLowerCase()
  if (!isChinaBuyingAgentId(agentId)) {
    return NextResponse.json({ error: "unknown_agent" }, { status: 404 })
  }

  const secret = webhookSecretForAgent(agentId)
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 501 })
  }

  const raw = await req.text()
  const sig = req.headers.get("x-signature") ?? req.headers.get("x-webhook-signature")
  if (!verifyHmac(secret, raw, sig)) {
    console.warn("[china-buy-webhook]", { agentId, result: "invalid_signature" })
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw) as unknown
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const result = await applyChinaBuyWebhookStatus({
    agentId,
    externalRef: parsed.data.external_ref,
    status: parsed.data.status,
    message: parsed.data.message ?? null,
  })

  if (!result.ok) {
    const status = result.error === "route_not_found" ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    logId: result.logId,
    status: result.status,
    idempotent: result.idempotent,
  })
}
