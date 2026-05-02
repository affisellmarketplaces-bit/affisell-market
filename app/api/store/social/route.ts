import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function stripHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim().replace(/^@+/, "").slice(0, 120)
  return s.length ? s : null
}

export async function PATCH(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const data: Prisma.StoreUpdateInput = {}

  const ig = stripHandle(body.instagram)
  const tk = stripHandle(body.tiktok)
  const yt = stripHandle(body.youtube)
  const tw = stripHandle(body.twitch)
  const tx = stripHandle(body.twitter)
  if (body.instagram !== undefined) data.instagram = ig
  if (body.tiktok !== undefined) data.tiktok = tk
  if (body.youtube !== undefined) data.youtube = yt
  if (body.twitch !== undefined) data.twitch = tw
  if (body.twitter !== undefined) data.twitter = tx

  if (typeof body.showSocialsOnStore === "boolean") data.showSocialsOnStore = body.showSocialsOnStore
  if (typeof body.autoSyncFollowersDaily === "boolean") data.autoSyncFollowersDaily = body.autoSyncFollowersDaily

  const updated = await prisma.store.update({
    where: { id: store.id },
    data,
  })

  return NextResponse.json({ store: updated })
}
