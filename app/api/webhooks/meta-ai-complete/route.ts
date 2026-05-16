import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const productId = typeof o.productId === "string" ? o.productId.trim() : ""
  const videoUrl = typeof o.videoUrl === "string" ? o.videoUrl.trim() : ""
  const secret = typeof o.secret === "string" ? o.secret : ""

  const expected = process.env.META_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!productId || !videoUrl) {
    return NextResponse.json({ error: "Missing productId or videoUrl" }, { status: 400 })
  }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: { videoAdUrl: videoUrl, videoAdStatus: "ready" },
    })

    await prisma.videoGenerationJob.updateMany({
      where: { productId, status: "pending" },
      data: { status: "ready", videoUrl },
    })
  } catch (e) {
    console.error("[webhooks/meta-ai-complete]", e)
    return NextResponse.json({ error: "Product not found or update failed" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
