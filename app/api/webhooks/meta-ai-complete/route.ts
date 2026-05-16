import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const { productId, videoUrl, secret } = await req.json()

  if (secret !== process.env.META_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { videoAdUrl: videoUrl, videoAdStatus: "ready" },
    }),
    prisma.videoGenerationJob.updateMany({
      where: { productId, status: "pending" },
      data: { status: "ready", videoUrl },
    }),
  ])

  return NextResponse.json({ success: true })
}
