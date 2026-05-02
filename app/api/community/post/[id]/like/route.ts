import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const updated = await prisma.communityPost.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { id: true, likes: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
