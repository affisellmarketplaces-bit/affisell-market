import { prisma } from "@/lib/prisma"

export type CreditAgentMissionFeeResult =
  | { ok: true; credited: boolean; amountCents?: number }
  | { ok: false; error: string }

/**
 * Credit agent balance when a mission passes — idempotent via AgentLedgerEntry.missionId.
 */
export async function creditAgentMissionFee(
  missionId: string
): Promise<CreditAgentMissionFeeResult> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: missionId },
    select: {
      id: true,
      status: true,
      agentId: true,
      feeCents: true,
      type: true,
    },
  })
  if (!mission) {
    return { ok: false, error: "mission_not_found" }
  }
  if (mission.status !== "PASSED") {
    return { ok: false, error: "mission_not_passed" }
  }
  if (!mission.agentId) {
    return { ok: false, error: "no_agent" }
  }
  if (mission.feeCents <= 0) {
    return { ok: true, credited: false }
  }

  const existing = await prisma.agentLedgerEntry.findUnique({
    where: { missionId },
    select: { id: true },
  })
  if (existing) {
    console.log("[agent-payment]", { missionId, result: "idempotent" })
    return { ok: true, credited: false }
  }

  const result = await prisma.$transaction(async (tx) => {
    const agent = await tx.sourcingAgent.findUnique({
      where: { id: mission.agentId as string },
      select: { balanceCents: true },
    })
    if (!agent) {
      return { ok: false as const, error: "agent_not_found" }
    }

    const nextBalance = agent.balanceCents + mission.feeCents
    await tx.sourcingAgent.update({
      where: { id: mission.agentId as string },
      data: {
        balanceCents: nextBalance,
        lifetimeEarningsCents: { increment: mission.feeCents },
      },
    })
    await tx.agentLedgerEntry.create({
      data: {
        agentId: mission.agentId as string,
        missionId,
        type: "CREDIT",
        amountCents: mission.feeCents,
        balanceAfterCents: nextBalance,
        note: `Mission ${mission.type} — fee`,
      },
    })
    return { ok: true as const, credited: true, amountCents: mission.feeCents }
  })

  if (!result.ok) {
    return result
  }

  console.log("[agent-payment]", {
    missionId,
    agentId: mission.agentId,
    amountCents: result.amountCents,
    result: "credited",
  })
  return result
}
