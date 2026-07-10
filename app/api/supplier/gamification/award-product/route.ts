import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { awardProductPublishXp } from "@/lib/gamification/award-product-xp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Idempotent-friendly XP award after a successful publish from wizard v2. */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const award = await awardProductPublishXp(session.user.id)
    return NextResponse.json(award)
  } catch (err) {
    const message = err instanceof Error ? err.message : "award_failed"
    console.log("[gamification/award-product]", { result: "error", message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
