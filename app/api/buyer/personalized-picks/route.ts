import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadBuyerPersonalizedPicksSafe } from "@/lib/buyer-personalized-picks"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Client refresh for « Recommandé pour vous » after browse / wishlist signals change. */
export async function GET() {
  try {
    const [session, guestId] = await Promise.all([auth(), readGuestWishlistId()])
    const picks = await loadBuyerPersonalizedPicksSafe({
      userId: session?.user?.id ?? null,
      guestId,
    })
    return NextResponse.json(picks)
  } catch (error) {
    console.error("[buyer-personalized-picks-api]", {
      result: "error",
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ items: [], personalized: false }, { status: 500 })
  }
}
