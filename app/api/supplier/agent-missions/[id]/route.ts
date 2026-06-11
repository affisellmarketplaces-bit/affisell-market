import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { isAgentMissionType } from "@/lib/agents/agent-network-shared"
import { toMissionRow } from "@/lib/agents/load-agent-network"
import {
  cancelSupplierAgentMission,
  deleteSupplierAgentMission,
  MISSION_FEE_MAX_CENTS,
  MISSION_FEE_MIN_CENTS,
  patchSupplierAgentMission,
} from "@/lib/agents/supplier-mission-mutations"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    action: z.enum(["update", "cancel", "end"]).optional(),
    instructions: z.string().trim().max(2000).nullable().optional(),
    feeCents: z.number().int().min(MISSION_FEE_MIN_CENTS).max(MISSION_FEE_MAX_CENTS).optional(),
    urgent: z.boolean().optional(),
    deadlineAt: z.string().nullable().optional(),
    type: z.string().refine(isAgentMissionType, "invalid_mission_type").optional(),
  })
  .strict()

type RouteContext = { params: Promise<{ id: string }> }

async function requireSupplier() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supplierId: session.user.id }
}

/** Update, cancel, end, or delete a supplier mission. */
export async function PATCH(req: Request, context: RouteContext) {
  const guard = await requireSupplier()
  if ("error" in guard) return guard.error

  const { id: missionId } = await context.params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const { action, instructions, feeCents, urgent, deadlineAt, type } = parsed.data

  if (action === "cancel" || action === "end") {
    const result = await cancelSupplierAgentMission({
      missionId,
      supplierId: guard.supplierId,
      actorId: guard.supplierId,
      mode: action,
    })
    if (!result.ok) {
      const status = result.error.startsWith("cannot_") ? 409 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ ok: true, status: result.status })
  }

  const result = await patchSupplierAgentMission({
    missionId,
    supplierId: guard.supplierId,
    ...(instructions !== undefined ? { instructions } : {}),
    ...(feeCents !== undefined ? { feeCents } : {}),
    ...(urgent !== undefined ? { urgent } : {}),
    ...(deadlineAt !== undefined
      ? { deadlineAt: deadlineAt ? new Date(deadlineAt) : null }
      : {}),
    ...(type !== undefined ? { type } : {}),
  })

  if (!result.ok) {
    const status = result.error === "mission_not_found" ? 404 : 409
    return NextResponse.json({ error: result.error }, { status })
  }

  const mission = await prisma.agentMission.findUnique({
    where: { id: missionId },
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
  })

  return NextResponse.json({
    ok: true,
    mission: mission ? toMissionRow(mission as Parameters<typeof toMissionRow>[0]) : null,
  })
}

export async function DELETE(_req: Request, context: RouteContext) {
  const guard = await requireSupplier()
  if ("error" in guard) return guard.error

  const { id: missionId } = await context.params
  const result = await deleteSupplierAgentMission({
    missionId,
    supplierId: guard.supplierId,
  })

  if (!result.ok) {
    const status =
      result.error === "mission_not_found"
        ? 404
        : result.error === "mission_has_ledger"
          ? 409
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
