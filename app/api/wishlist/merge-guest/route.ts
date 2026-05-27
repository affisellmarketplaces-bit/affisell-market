import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import { mergeGuestWishlistForUser } from "@/lib/guest-wishlist-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Merge anonymous guest likes into the signed-in buyer wishlist (idempotent). */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const guestId = await readGuestWishlistId()
  if (!guestId) {
    return NextResponse.json({ ok: true, merged: 0, skipped: 0 })
  }

  const { merged, skipped } = await mergeGuestWishlistForUser(session.user.id, guestId)
  return NextResponse.json({ ok: true, merged, skipped })
}
