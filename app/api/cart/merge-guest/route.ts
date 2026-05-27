import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  mergeGuestCartLinesForUser,
  parseGuestCartMergeBody,
} from "@/lib/merge-guest-cart-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Merge local guest cart lines into the signed-in buyer cart (idempotent). */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { items?: unknown }
  const lines = parseGuestCartMergeBody(body.items)
  if (lines.length === 0) {
    return NextResponse.json({ ok: true, merged: 0, skipped: 0 })
  }

  const { merged, skipped } = await mergeGuestCartLinesForUser(session.user.id, lines)
  console.log("[cart-merge-guest]", { userId: session.user.id, merged, skipped })

  return NextResponse.json({ ok: true, merged, skipped })
}
