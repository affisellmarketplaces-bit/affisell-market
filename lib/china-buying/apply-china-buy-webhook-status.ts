import type { ChinaBuyRouteStatus } from "@prisma/client"

import { mapChinaBuyWebhookStatus } from "@/lib/china-buying/map-agent-webhook-status"
import { prisma } from "@/lib/prisma"

export type ApplyChinaBuyWebhookInput = {
  agentId: string
  externalRef: string
  status: string
  message?: string | null
}

export type ApplyChinaBuyWebhookResult =
  | { ok: true; logId: string; status: ChinaBuyRouteStatus; idempotent: boolean }
  | { ok: false; error: string }

/**
 * Idempotent status update for a China buy route log (webhook replay safe).
 */
export async function applyChinaBuyWebhookStatus(
  input: ApplyChinaBuyWebhookInput
): Promise<ApplyChinaBuyWebhookResult> {
  const externalRef = input.externalRef.trim()
  if (!externalRef) {
    return { ok: false, error: "missing_external_ref" }
  }

  const mapped = mapChinaBuyWebhookStatus(input.status)
  if (!mapped) {
    return { ok: false, error: "unknown_status" }
  }

  const log = await prisma.chinaBuyRouteLog.findFirst({
    where: { agentId: input.agentId, externalRef },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  })
  if (!log) {
    return { ok: false, error: "route_not_found" }
  }

  if (log.status === mapped) {
    console.log("[china-buy-webhook]", {
      logId: log.id,
      agentId: input.agentId,
      externalRef,
      status: mapped,
      result: "idempotent",
    })
    return { ok: true, logId: log.id, status: mapped, idempotent: true }
  }

  const message = input.message?.trim() || null
  await prisma.chinaBuyRouteLog.update({
    where: { id: log.id },
    data: {
      status: mapped,
      ...(message ? { errorMessage: message.slice(0, 2000) } : {}),
    },
  })

  console.log("[china-buy-webhook]", {
    logId: log.id,
    agentId: input.agentId,
    externalRef,
    from: log.status,
    to: mapped,
    result: "updated",
  })

  return { ok: true, logId: log.id, status: mapped, idempotent: false }
}
