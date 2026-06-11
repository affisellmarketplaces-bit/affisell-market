import {
  canSupplierCancelMission,
  canSupplierDeleteMission,
  canSupplierEditMission,
  isAgentMissionType,
  type AgentMissionStatusValue,
  type AgentMissionTypeValue,
} from "@/lib/agents/agent-network-shared"
import { transitionAgentMission } from "@/lib/agents/transition-agent-mission"
import { prisma } from "@/lib/prisma"

export const MISSION_FEE_MIN_CENTS = 0
export const MISSION_FEE_MAX_CENTS = 50_000

export type SupplierMissionPatchInput = {
  missionId: string
  supplierId: string
  instructions?: string | null
  feeCents?: number
  urgent?: boolean
  deadlineAt?: Date | null
  type?: AgentMissionTypeValue
}

export type SupplierMissionMutationResult =
  | { ok: true }
  | { ok: false; error: string }

function clampFeeCents(cents: number): number {
  return Math.max(MISSION_FEE_MIN_CENTS, Math.min(MISSION_FEE_MAX_CENTS, Math.round(cents)))
}

/** Update editable fields on an open supplier mission. */
export async function patchSupplierAgentMission(
  input: SupplierMissionPatchInput
): Promise<SupplierMissionMutationResult> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: input.missionId },
    select: { id: true, supplierId: true, status: true },
  })
  if (!mission || mission.supplierId !== input.supplierId) {
    return { ok: false, error: "mission_not_found" }
  }
  const status = mission.status as AgentMissionStatusValue
  if (!canSupplierEditMission(status)) {
    return { ok: false, error: "mission_not_editable" }
  }

  const data: {
    instructions?: string | null
    feeCents?: number
    urgent?: boolean
    deadlineAt?: Date | null
    type?: AgentMissionTypeValue
  } = {}

  if (input.instructions !== undefined) {
    data.instructions = input.instructions?.trim().slice(0, 2000) || null
  }
  if (input.feeCents !== undefined) {
    data.feeCents = clampFeeCents(input.feeCents)
  }
  if (input.urgent !== undefined) {
    data.urgent = input.urgent
  }
  if (input.deadlineAt !== undefined) {
    data.deadlineAt = input.deadlineAt
  }
  if (input.type !== undefined && status === "REQUESTED") {
    if (!isAgentMissionType(input.type)) {
      return { ok: false, error: "invalid_mission_type" }
    }
    data.type = input.type
  }

  if (Object.keys(data).length === 0) {
    return { ok: true }
  }

  await prisma.agentMission.update({
    where: { id: input.missionId },
    data,
  })

  console.log("[agent-network]", {
    missionId: input.missionId,
    supplierId: input.supplierId,
    fields: Object.keys(data),
    result: "supplier_patched",
  })

  return { ok: true }
}

/** Cancel or end early — transitions to CANCELLED when allowed. */
export async function cancelSupplierAgentMission(args: {
  missionId: string
  supplierId: string
  actorId: string
  mode: "cancel" | "end"
}): Promise<SupplierMissionMutationResult & { status?: AgentMissionStatusValue }> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: args.missionId },
    select: { id: true, supplierId: true, status: true },
  })
  if (!mission || mission.supplierId !== args.supplierId) {
    return { ok: false, error: "mission_not_found" }
  }
  const status = mission.status as AgentMissionStatusValue

  if (args.mode === "end" && status !== "IN_PROGRESS" && status !== "ASSIGNED") {
    return { ok: false, error: "cannot_end_mission" }
  }
  if (args.mode === "cancel" && !canSupplierCancelMission(status)) {
    return { ok: false, error: "cannot_cancel_mission" }
  }
  if (!canSupplierCancelMission(status)) {
    return { ok: false, error: "cannot_cancel_mission" }
  }

  const result = await transitionAgentMission({
    missionId: args.missionId,
    to: "CANCELLED",
    actorId: args.actorId,
  })
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  console.log("[agent-network]", {
    missionId: args.missionId,
    supplierId: args.supplierId,
    mode: args.mode,
    result: "supplier_cancelled",
  })

  return { ok: true, status: result.status }
}

/** Hard-delete terminal missions from supplier history. */
export async function deleteSupplierAgentMission(args: {
  missionId: string
  supplierId: string
}): Promise<SupplierMissionMutationResult> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: args.missionId },
    select: { id: true, supplierId: true, status: true, ledgerEntry: { select: { id: true } } },
  })
  if (!mission || mission.supplierId !== args.supplierId) {
    return { ok: false, error: "mission_not_found" }
  }
  const status = mission.status as AgentMissionStatusValue
  if (!canSupplierDeleteMission(status)) {
    return { ok: false, error: "mission_not_deletable" }
  }
  if (mission.ledgerEntry) {
    return { ok: false, error: "mission_has_ledger" }
  }

  await prisma.agentMission.delete({ where: { id: args.missionId } })

  console.log("[agent-network]", {
    missionId: args.missionId,
    supplierId: args.supplierId,
    status,
    result: "supplier_deleted",
  })

  return { ok: true }
}
