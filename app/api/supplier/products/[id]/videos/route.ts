import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { serializeProductVideo } from "@/lib/meta-ai"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: productId } = await context.params
  const own = await prisma.product.findFirst({
    where: { id: productId, supplierId: session.user.id },
    select: { id: true },
  })
  if (!own) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rows = await prisma.videoGenerationJob.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 12,
  })

  return NextResponse.json({
    videos: rows.map(serializeProductVideo),
  })
}
