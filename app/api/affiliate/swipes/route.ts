import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { recordAffiliateSwipe, undoAffiliateSwipe } from "@/lib/affiliate-swipe-feed.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SwipeBody = {
  productId?: string
  action?: string
}

function parseAction(raw: unknown): "like" | "skip" | null {
  if (raw === "like" || raw === "skip") return raw
  return null
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as SwipeBody
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  const action = parseAction(body.action)

  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }
  if (!action) {
    return NextResponse.json({ error: "Invalid action — use like or skip" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true, isDraft: false },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const row = await recordAffiliateSwipe(session.user.id, productId, action)
  return NextResponse.json(row, { status: 201 })
}

/** Undo a skip (or like marker) so the product can reappear in the feed. */
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const productId =
    url.searchParams.get("productId")?.trim() ||
    ((await request.json().catch(() => ({}))) as SwipeBody).productId?.trim() ||
    ""

  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  await undoAffiliateSwipe(session.user.id, productId)
  return NextResponse.json({ ok: true })
}
