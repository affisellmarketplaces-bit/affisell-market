import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Increment Pulse clip view count (community posts). */
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

  const session = await auth()
  const userId = session?.user?.id ?? null
  if (productId) {
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
