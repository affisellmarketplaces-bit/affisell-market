import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  canTransitionMission,
  type AgentMissionStatusValue,
} from "@/lib/agents/agent-network-shared"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "PASSED", "FAILED", "CANCELLED"]),
  agentId: z.string().min(1).optional(),
  reportSummary: z.string().trim().max(4000).optional(),
})

/**
 * Transition d'une mission agent (admin) avec Quality Gate :
 * une mission FAILED coupe l'auto-buy du SKU concerné (produit + lien fournisseur).
 * Idempotent : re-poser le statut courant renvoie 200 sans effet.
 */
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

  const mission = await prisma.agentMission.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      productId: true,
      supplierId: true,
      agentId: true,
      product: { select: { supplierLink: { select: { id: true } } } },
    },
  })
  if (!mission) {
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 })
  }

  if (mission.status === status) {
    return NextResponse.json({ ok: true, missionId: id, status, idempotent: true })
  }
  if (!canTransitionMission(mission.status as AgentMissionStatusValue, status)) {
    return NextResponse.json(
      { error: "invalid_transition", from: mission.status, to: status },
      { status: 409 }
    )
  }

  if (status === "ASSIGNED" && agentId) {
    const agent = await prisma.sourcingAgent.findUnique({
      where: { id: agentId },
      select: { id: true },
    })
    if (!agent) {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 })
    }
  }

  const now = new Date()
  const isTerminal = status === "PASSED" || status === "FAILED" || status === "CANCELLED"
  const failedWithSku = status === "FAILED" && mission.productId !== null

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.agentMission.update({
      where: { id },
      data: {
        status,
        ...(status === "ASSIGNED" && agentId ? { agentId, assignedAt: now } : {}),
        ...(isTerminal ? { completedAt: now } : {}),
        ...(reportSummary !== undefined ? { reportSummary } : {}),
        ...(failedWithSku ? { autoBuyPaused: true } : {}),
      },
    }),
  ]

  // Quality Gate : un contrôle échoué suspend l'auto-buy du SKU immédiatement.
  if (failedWithSku) {
    ops.push(
      prisma.product.update({
        where: { id: mission.productId as string },
        data: { autoBuyEnabled: false, autoFulfill: false },
      })
    )
    if (mission.product?.supplierLink) {
      ops.push(
        prisma.supplierLink.update({
          where: { id: mission.product.supplierLink.id },
          data: { autoBuyEnabled: false },
        })
      )
    }
  }

  if (status === "PASSED" && mission.agentId) {
    ops.push(
      prisma.sourcingAgent.update({
        where: { id: mission.agentId },
        data: { missionsDone: { increment: 1 } },
      })
    )
  }

  await prisma.$transaction(ops)

  console.log("[agent-network]", {
    missionId: id,
    supplierId: mission.supplierId,
    productId: mission.productId,
    from: mission.status,
    to: status,
    qualityGate: failedWithSku,
    actorId: auth.session.user.id,
    result: "transitioned",
  })

  return NextResponse.json({ ok: true, missionId: id, status, qualityGate: failedWithSku })
}
