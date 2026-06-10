import { NextResponse } from "next/server"
import { z } from "zod"

import type { AgentMissionStatusValue } from "@/lib/agents/agent-network-shared"
import { requireAgentContext } from "@/lib/agents/require-agent-context"
import {
  canAgentSelfTransition,
  transitionAgentMission,
} from "@/lib/agents/transition-agent-mission"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  status: z.enum(["IN_PROGRESS", "PASSED", "FAILED"]),
  reportSummary: z.string().trim().max(4000).optional(),
  photoUrls: z.array(z.string().url()).max(12).optional(),
})

/**
 * Espace agent : démarrer une mission, soumettre rapport + photos QC.
 * Quality Gate identique à l'admin sur FAILED.
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireAgentContext()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  if (guard.ctx.status !== "ACTIVE") {
    return NextResponse.json({ error: "agent_not_active" }, { status: 403 })
  }

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const mission = await prisma.agentMission.findUnique({
    where: { id },
    select: { id: true, status: true, agentId: true },
  })
  if (!mission || mission.agentId !== guard.ctx.sourcingAgentId) {
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 })
  }

  const from = mission.status as AgentMissionStatusValue
  const to = parsed.data.status as AgentMissionStatusValue
  if (!canAgentSelfTransition(from, to)) {
    return NextResponse.json({ error: "invalid_transition", from, to }, { status: 409 })
  }

  if ((to === "PASSED" || to === "FAILED") && !parsed.data.reportSummary?.trim()) {
    return NextResponse.json({ error: "report_required" }, { status: 400 })
  }

  const result = await transitionAgentMission({
    missionId: id,
    to,
    reportSummary: parsed.data.reportSummary ?? null,
    photoUrls: parsed.data.photoUrls ?? undefined,
    actorId: guard.ctx.userId,
  })

  if (!result.ok) {
    const httpStatus = result.error === "invalid_transition" ? 409 : 404
    return NextResponse.json({ error: result.error, from: result.from }, { status: httpStatus })
  }

  return NextResponse.json({
    ok: true,
    missionId: id,
    status: result.status,
    qualityGate: result.qualityGate,
  })
}
