import { auth } from "@/auth"
import { analyticsConsentFromCookieHeader, legacyTrackingUserId } from "@/lib/events/consent"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const ALLOWED = new Set(["view", "hover", "add_to_cart", "checkout_initiated"])

/**
 * Carousel / PDP lightweight analytics (legacy, read by social proof and the supplier / reseller dashboards).
 * Founder decision D1 (2026-11-23): written ONLY with the visitor's analytics consent, read server-side from the
 * consent cookie — without it nothing is read from the body and nothing is stored.
 */
export async function POST(req: Request) {
  if (!analyticsConsentFromCookieHeader(req.headers.get("cookie"))) {
    return Response.json({ ok: false, skipped: true })
  }
  const session = await auth()
  const userId = legacyTrackingUserId(session?.user)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const b = body as {
    type?: unknown
    productId?: unknown
    sessionId?: unknown
    durationMs?: unknown
  }

  const eventType = typeof b.type === "string" ? b.type.trim() : ""
  if (!ALLOWED.has(eventType)) {
    return Response.json({ error: "Invalid type" }, { status: 400 })
  }

  const productId = typeof b.productId === "string" ? b.productId.trim() || null : null
  const sessionId =
    typeof b.sessionId === "string" && b.sessionId.trim().length >= 8 ? b.sessionId.trim() : null
  const durationMs =
    typeof b.durationMs === "number" && Number.isFinite(b.durationMs)
      ? Math.max(0, Math.min(600_000, Math.round(b.durationMs)))
      : null

  if (!userId && !sessionId) {
    return Response.json({ ok: false, skipped: true })
  }

  await prisma.affisellTrackEvent.create({
    data: {
      eventType,
      productId,
      userId: userId ?? undefined,
      sessionId: userId ? undefined : sessionId ?? undefined,
      durationMs: durationMs ?? undefined,
    },
  })

  return Response.json({ ok: true })
}
