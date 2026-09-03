import { NextResponse } from "next/server"
import { z } from "zod"

import { buildDropForgePreviewFromAerCapture } from "@/lib/dropforge-ae-import.server"
import { storeAeCaptureSessionResult } from "@/lib/fulfillment/ae-capture-session"
import { verifyAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"
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

  if (
    !body.sessionId ||
    !body.captureToken ||
    !verifyAeCaptureToken(body.captureToken, body.sessionId, relayKey)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const aeProductId = parseAliExpressProductId(body.aeUrl)
  if (!aeProductId) {
    return NextResponse.json({ error: "invalid_aliexpress_url" }, { status: 400, headers: cors })
  }

  const built = await buildDropForgePreviewFromAerCapture(body.aeUrl, body.aerData)
  if (!built.ok) {
    return NextResponse.json(
      { ok: false, error: built.error },
      { status: built.status, headers: cors }
    )
  }

  const payload = built.payload

  await storeAeCaptureSessionResult(body.sessionId, relayKey, payload)

  console.log("[dropforge-ae-capture]", {
    relayKey,
    aeProductId,
    method: built.preview.method,
    titleLen: built.preview.title.length,
    sessionId: body.sessionId,
  })

  if (!contentType.includes("application/json")) {
    const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
    return NextResponse.redirect(`${appBase}/dropforge?url=${encodeURIComponent(body.aeUrl)}&aeImported=1`, {
      headers: cors,
    })
  }

  return NextResponse.json({ ok: true, ...payload }, { headers: cors })
}
