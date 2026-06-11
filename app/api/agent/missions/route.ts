import { NextResponse } from "next/server"

import { requireAgentContext } from "@/lib/agents/require-agent-context"
import { toMissionRow } from "@/lib/agents/load-agent-network"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Missions assignées à l'agent connecté. */
export async function GET() {
  const guard = await requireAgentContext()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const missions = await prisma.agentMission.findMany({
    where: { agentId: guard.ctx.sourcingAgentId },
    select: {
      id: true,
      type: true,
      status: true,
      productId: true,
      instructions: true,
      reportSummary: true,
      photoUrls: true,
      feeCents: true,
      urgent: true,
      deadlineAt: true,
      autoBuyPaused: true,
      requestedAt: true,
      completedAt: true,
      product: { select: { name: true, images: true } },
      agent: { select: { displayName: true, country: true, city: true } },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 60,
  })

  return NextResponse.json({
    ok: true,
    profile: {
      displayName: guard.ctx.displayName,
      status: guard.ctx.status,
      country: guard.ctx.country,
      city: guard.ctx.city,
    },
    missions: missions.map((m) => toMissionRow(m as Parameters<typeof toMissionRow>[0])),
  })
}
