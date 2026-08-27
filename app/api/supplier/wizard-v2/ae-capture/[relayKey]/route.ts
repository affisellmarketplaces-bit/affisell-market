import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { storeAeCaptureSessionResult } from "@/lib/fulfillment/ae-capture-session"
import { verifyAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"
import { buildWizardV2ImportFromAerCapture } from "@/lib/fulfillment/wizard-v2-ae-import"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  aeUrl: z.string().min(4),
  aerData: z.unknown(),
  sessionId: z.string().min(4).optional(),
  captureToken: z.string().min(8).optional(),
})

function aeCaptureCors(origin: string | null): HeadersInit {
  if (!origin) return {}
  try {
    if (!/\.aliexpress\.com$/i.test(new URL(origin).hostname)) return {}
  } catch {
    return {}
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

async function isAuthorizedCapture(
  relayKey: string,
  body: z.infer<typeof bodySchema>
): Promise<boolean> {
  if (
    body.sessionId &&
    body.captureToken &&
    verifyAeCaptureToken(body.captureToken, body.sessionId, relayKey)
  ) {
    return true
  }
  const session = await auth()
  if (!session?.user?.id) return false
  const role = (session.user as { role?: string }).role
  return role === "SUPPLIER" || role === "ADMIN"
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin")
  return new NextResponse(null, { status: 204, headers: aeCaptureCors(origin) })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ relayKey: string }> }
) {
  const origin = req.headers.get("origin")
  const cors = aeCaptureCors(origin)
  const { relayKey } = await ctx.params

  const contentType = req.headers.get("content-type") ?? ""
  let body: z.infer<typeof bodySchema>
  if (contentType.includes("application/json")) {
    body = bodySchema.parse(await req.json())
  } else {
    const form = await req.formData()
    const raw = form.get("payload")
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: cors })
    }
    body = bodySchema.parse(JSON.parse(raw))
  }

  if (!(await isAuthorizedCapture(relayKey, body))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const aeProductId = parseAliExpressProductId(body.aeUrl)
  if (!aeProductId) {
    return NextResponse.json({ error: "invalid_aliexpress_url" }, { status: 400, headers: cors })
  }

  const built = await buildWizardV2ImportFromAerCapture(body.aeUrl, body.aerData)
  if (!built.ok) {
    return NextResponse.json(
      { ok: false, error: built.error },
      { status: built.status, headers: cors }
    )
  }

  const payload = { import: built.payload }

  if (body.sessionId) {
    await storeAeCaptureSessionResult(body.sessionId, relayKey, payload)
  }

  console.log("[wizard-v2-ae-capture]", {
    relayKey,
    aeProductId,
    method: built.payload.method,
    titleLen:
      typeof built.payload.products[0]?.title === "string"
        ? built.payload.products[0].title.length
        : 0,
    sessionId: body.sessionId ?? null,
    viaToken: Boolean(body.captureToken),
  })

  if (!contentType.includes("application/json")) {
    const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
    return NextResponse.redirect(`${appBase}/dashboard/supplier/products/new?wizard=v2&mode=express&aeImported=1`, {
      headers: cors,
    })
  }

  return NextResponse.json({ ok: true, ...payload }, { headers: cors })
}
