import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  const store = await prisma.store.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!store) {
    return NextResponse.json({ error: "Create a store first" }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    content?: string
    images?: string[]
    videoUrl?: string | null
    productId?: string | null
  }
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 8000) : ""
  if (!content) {
    return NextResponse.json({ error: "Content required" }, { status: 400 })
  }

  const images = Array.isArray(body.images)
    ? (body.images as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((u) => u.trim())
        .filter(Boolean)
        .slice(0, 12)
    : []

  const videoUrl =
    typeof body.videoUrl === "string" && body.videoUrl.trim() && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(body.videoUrl.trim())
      ? body.videoUrl.trim().slice(0, 2048)
      : null

  let productId: string | null =
    typeof body.productId === "string" && body.productId.trim() ? body.productId.trim() : null
  if (productId && role === "SUPPLIER") {
    const own = await prisma.product.findFirst({
      where: { id: productId, supplierId: userId },
      select: { id: true },
    })
    if (!own) productId = null
  }

  const post = await prisma.communityPost.create({
    data: {
      storeId: store.id,
      content,
      images,
      videoUrl,
      productId,
    },
  })

  return NextResponse.json(post, { status: 201 })
}
