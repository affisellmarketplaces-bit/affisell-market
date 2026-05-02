import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    storeSlug?: string
    storeId?: string
  }
  const slug = typeof body.storeSlug === "string" ? body.storeSlug.trim() : ""
  let store =
    slug.length > 0
      ? await prisma.store.findUnique({ where: { slug }, select: { id: true } })
      : null
  if (!store && typeof body.storeId === "string") {
    store = await prisma.store.findUnique({ where: { id: body.storeId.trim() }, select: { id: true } })
  }
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  const existing = await prisma.follow.findUnique({
    where: {
      userId_storeId: { userId, storeId: store.id },
    },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
  } else {
    await prisma.follow.create({ data: { userId, storeId: store.id } })
  }

  const followCount = await prisma.follow.count({ where: { storeId: store.id } })
  return NextResponse.json({ following: !existing, followCount })
}
