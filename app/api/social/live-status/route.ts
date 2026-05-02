import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"
import { mockLiveStatus } from "@/lib/social-sync-mock"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 })
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  const status = mockLiveStatus({ twitch: store.twitch, youtube: store.youtube })

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      isLive: status.isLive,
      livePlatform: status.livePlatform,
      liveUrl: status.liveUrl,
    },
  })

  return NextResponse.json({
    isLive: updated.isLive,
    livePlatform: updated.livePlatform,
    liveUrl: updated.liveUrl,
  })
}
