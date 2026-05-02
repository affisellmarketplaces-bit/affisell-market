import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { orderedIds?: unknown }
  const ids = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((x): x is string => typeof x === "string")
    : []
  if (!ids.length) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 })
  }

  await prisma.$transaction(
    ids.map((listingId, index) =>
      prisma.affiliateProduct.updateMany({
        where: { id: listingId, affiliateId: session.user.id },
        data: { position: index },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
