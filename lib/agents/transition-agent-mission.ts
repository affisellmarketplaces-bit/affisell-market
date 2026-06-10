import { Prisma } from "@prisma/client"

import {
  canTransitionMission,
  type AgentMissionStatusValue,
} from "@/lib/agents/agent-network-shared"
import { dispatchAgentMissionEmails } from "@/lib/agents/send-agent-mission-emails"
import { prisma } from "@/lib/prisma"

export type MissionTransitionInput = {
  missionId: string
  to: AgentMissionStatusValue
  agentId?: string | null
  reportSummary?: string | null
  photoUrls?: string[] | null
  actorId?: string
}

export type MissionTransitionResult =
  | { ok: true; status: AgentMissionStatusValue; qualityGate: boolean; idempotent?: boolean }
  | { ok: false; error: string; from?: string }

/**
 * Transition mission avec Quality Gate partagé (admin + espace agent).
 * Idempotent : même statut → ok sans effet.
 */
export async function transitionAgentMission(
  input: MissionTransitionInput
): Promise<MissionTransitionResult> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: input.missionId },
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
    return { ok: false, error: "mission_not_found" }
  }

  const from = mission.status as AgentMissionStatusValue
  const { to } = input

  if (from === to) {
    return { ok: true, status: to, qualityGate: false, idempotent: true }
  }
  if (!canTransitionMission(from, to)) {
    return { ok: false, error: "invalid_transition", from }
  }

  if (to === "ASSIGNED" && input.agentId) {
    const agent = await prisma.sourcingAgent.findUnique({
      where: { id: input.agentId },
      select: { id: true },
    })
    if (!agent) {
      return { ok: false, error: "agent_not_found" }
    }
  }

  const now = new Date()
  const isTerminal = to === "PASSED" || to === "FAILED" || to === "CANCELLED"
  const failedWithSku = to === "FAILED" && mission.productId !== null

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.agentMission.update({
      where: { id: input.missionId },
      data: {
        status: to,
        ...(to === "ASSIGNED" && input.agentId
          ? { agentId: input.agentId, assignedAt: now }
          : {}),
        ...(isTerminal ? { completedAt: now } : {}),
        ...(input.reportSummary !== undefined ? { reportSummary: input.reportSummary } : {}),
        ...(input.photoUrls !== undefined && input.photoUrls !== null
          ? { photoUrls: input.photoUrls }
          : {}),
        ...(failedWithSku ? { autoBuyPaused: true } : {}),
      },
    }),
  ]

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

  const agentIdForStats = input.agentId ?? mission.agentId
  if (to === "PASSED" && agentIdForStats) {
    ops.push(
      prisma.sourcingAgent.update({
        where: { id: agentIdForStats },
        data: { missionsDone: { increment: 1 } },
      })
    )
  }

  await prisma.$transaction(ops)

  console.log("[agent-network]", {
    missionId: input.missionId,
    supplierId: mission.supplierId,
    productId: mission.productId,
    from,
    to,
    qualityGate: failedWithSku,
    actorId: input.actorId ?? null,
    result: "transitioned",
  })

  if (to === "ASSIGNED" && (input.agentId ?? mission.agentId)) {
    dispatchAgentMissionEmails(input.missionId, "assigned")
  }
  if (to === "PASSED" || to === "FAILED") {
    dispatchAgentMissionEmails(input.missionId, "completed")
  }

  return { ok: true, status: to, qualityGate: failedWithSku }
}

/** Transitions autorisées depuis l'espace agent connecté. */
export const AGENT_SELF_TRANSITIONS: Partial<
  Record<AgentMissionStatusValue, readonly AgentMissionStatusValue[]>
> = {
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PASSED", "FAILED"],
}

export function canAgentSelfTransition(
  from: AgentMissionStatusValue,
  to: AgentMissionStatusValue
): boolean {
  return AGENT_SELF_TRANSITIONS[from]?.includes(to) ?? false
}
