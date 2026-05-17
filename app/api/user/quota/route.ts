import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { fetchUserVideoQuota } from "@/lib/video-quota"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const row = await fetchUserVideoQuota(session.user.id)
  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const { snapshot } = row
  return NextResponse.json({
    videoCount: snapshot.videoCount,
    videoLimit: snapshot.videoLimit,
    remaining: snapshot.remaining,
    isPro: snapshot.isPro,
  })
}
