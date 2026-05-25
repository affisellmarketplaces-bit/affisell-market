import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { source?: string; id?: string }
  const source = typeof body.source === "string" ? body.source.trim() : ""
  const id = typeof body.id === "string" ? body.id.trim() : ""

  if (source !== "community" || !id) {
    return NextResponse.json({ error: "Invalid pulse like target" }, { status: 400 })
  }

  const updated = await prisma.communityPost.update({
    where: { id },
    data: { likes: { increment: 1 } },
    select: { likes: true },
  })

  return NextResponse.json({ likes: updated.likes })
}
