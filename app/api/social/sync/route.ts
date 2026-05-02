import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { parseFollowersJson } from "@/lib/format-followers"
import { prisma } from "@/lib/prisma"
import { bumpFollowersMock, defaultFollowersMock } from "@/lib/social-sync-mock"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PlatformKey = "instagram" | "tiktok" | "youtube" | "twitch" | "twitter"

function driftOne(v: number) {
  return Math.max(0, Math.round(v * (1 + (Math.random() * 0.1 - 0.02))))
}

export async function POST(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as { platform?: string }
  const plat = typeof body.platform === "string" ? (body.platform.toLowerCase() as PlatformKey) : null

  const prev =
    parseFollowersJson(store.followers).instagram != null
      ? parseFollowersJson(store.followers)
      : defaultFollowersMock()

  const next =
    plat && ["instagram", "tiktok", "youtube", "twitch", "twitter"].includes(plat)
      ? { ...prev, [plat]: driftOne(prev[plat] ?? Math.floor(Math.random() * 20_000) + 500) }
      : bumpFollowersMock(prev)

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      followers: next as object,
      lastSyncAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true, followers: updated.followers, lastSyncAt: updated.lastSyncAt })
}
