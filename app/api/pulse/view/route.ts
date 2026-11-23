import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { analyticsConsentFromCookieHeader, legacyTrackingUserId } from "@/lib/events/consent"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Increment Pulse clip view count (community posts) — an anonymous +1 on the post, no identifier, kept as is.
 * The per-product view ROW (it carries the account id) is written only with analytics consent (founder decision D1).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    source?: string
    id?: string
    productId?: string
  }

  const source = typeof body.source === "string" ? body.source.trim() : ""
  const id = typeof body.id === "string" ? body.id.trim() : ""
  const productId = typeof body.productId === "string" ? body.productId.trim() : null

  if (source === "community" && id) {
    await prisma.communityPost.update({
      where: { id },
      data: { views: { increment: 1 } },
    })
  }

  if (productId && analyticsConsentFromCookieHeader(req.headers.get("cookie"))) {
    const session = await auth()
    const userId = legacyTrackingUserId(session?.user)
    await prisma.affisellTrackEvent.create({
      data: {
        eventType: "view",
        productId,
        userId: userId ?? undefined,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
