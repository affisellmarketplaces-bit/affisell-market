import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import type { AgentMissionStatusValue } from "@/lib/agents/agent-network-shared"
import { transitionAgentMission } from "@/lib/agents/transition-agent-mission"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "PASSED", "FAILED", "CANCELLED"]),
  agentId: z.string().min(1).optional(),
  reportSummary: z.string().trim().max(4000).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const { status, agentId, reportSummary } = parsed.data

  const result = await transitionAgentMission({
    missionId: id,
    to: status as AgentMissionStatusValue,
    agentId,
    reportSummary,
    actorId: auth.session.user.id,
  })

  if (!result.ok) {
    const httpStatus = result.error === "invalid_transition" ? 409 : 404
    return NextResponse.json(
      { error: result.error, from: result.from },
      { status: httpStatus }
    )
  }

  return NextResponse.json({
    ok: true,
    missionId: id,
    status: result.status,
    qualityGate: result.qualityGate,
    idempotent: result.idempotent ?? false,
  })
}
