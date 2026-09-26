import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { effectiveToolRole } from "@/lib/ai-connect/tools"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId || !effectiveToolRole(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const missions = await prisma.aiMission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      tool: true,
      status: true,
      error: true,
      createdAt: true,
      completedAt: true,
      key: { select: { label: true } },
    },
  })
  return NextResponse.json({
    missions: missions.map((m) => ({
      id: m.id,
      tool: m.tool,
      status: m.status,
      error: m.error,
      createdAt: m.createdAt,
      completedAt: m.completedAt,
      keyLabel: m.key?.label ?? null,
    })),
  })
}
