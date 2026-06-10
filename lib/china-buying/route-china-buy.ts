import type { ChinaBuyRouteStatus } from "@prisma/client"

import { routeAnovabuyItem } from "@/lib/china-buying/adapters/anovabuy"
import { routeSuperbuyItem } from "@/lib/china-buying/adapters/superbuy"
import {
  chinaBuyIdempotencyKey,
  isChinaBuyingAgentId,
  type ChinaBuyingAgentId,
} from "@/lib/china-buying/china-buying-shared"
import { prisma } from "@/lib/prisma"

export type RouteChinaBuyInput = {
  supplierId: string
  sourceUrl: string
  agentId: string
  platform?: string | null
  productId?: string | null
  quantity?: number
  /** Override idempotency key (e.g. `china-buy:order:{orderId}`). */
  idempotencyKey?: string
}

export type RouteChinaBuyResult =
  | {
      ok: true
      logId: string
      status: ChinaBuyRouteStatus
      externalRef?: string | null
      idempotent?: boolean
    }
  | { ok: false; error: string }

async function callAgentAdapter(
  agentId: ChinaBuyingAgentId,
  args: { sourceUrl: string; platform: string | null; quantity: number }
): Promise<{
  status: ChinaBuyRouteStatus
  externalRef?: string | null
  errorMessage?: string | null
}> {
  if (agentId === "superbuy") {
    const r = await routeSuperbuyItem(args)
    if (r.ok && r.status === "API_OK") {
      return { status: "API_OK", externalRef: r.externalRef }
    }
    if (r.ok && r.status === "STUB") {
      return { status: "STUB", errorMessage: r.message }
    }
    return { status: "API_FAIL", errorMessage: r.error }
  }

  if (agentId === "anovabuy") {
    const r = await routeAnovabuyItem(args)
    if (r.ok && r.status === "API_OK") {
      return { status: "API_OK", externalRef: r.externalRef }
    }
    if (r.ok && r.status === "STUB") {
      return { status: "STUB", errorMessage: r.message }
    }
    return { status: "API_FAIL", errorMessage: r.error }
  }

  return {
    status: "STUB",
    errorMessage: `${agentId}: API integration pending — choice persisted for manual buy`,
  }
}

/**
 * Route a China source URL to the selected buying agent.
 * Idempotent per supplier + url + agent (ChinaBuyRouteLog.idempotencyKey).
 */
export async function routeChinaBuy(input: RouteChinaBuyInput): Promise<RouteChinaBuyResult> {
  const sourceUrl = input.sourceUrl.trim()
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, error: "invalid_url" }
  }
  if (!isChinaBuyingAgentId(input.agentId)) {
    return { ok: false, error: "unknown_agent" }
  }

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    chinaBuyIdempotencyKey({
      supplierId: input.supplierId,
      sourceUrl,
      agentId: input.agentId,
    })

  const existing = await prisma.chinaBuyRouteLog.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, externalRef: true },
  })
  if (existing) {
    console.log("[china-buy]", {
      supplierId: input.supplierId,
      productId: input.productId ?? null,
      agentId: input.agentId,
      logId: existing.id,
      result: "idempotent",
    })
    return {
      ok: true,
      logId: existing.id,
      status: existing.status,
      externalRef: existing.externalRef,
      idempotent: true,
    }
  }

  const quantity = Math.max(1, Math.min(99, Math.round(input.quantity ?? 1)))
  const adapter = await callAgentAdapter(input.agentId, {
    sourceUrl,
    platform: input.platform?.trim() ?? null,
    quantity,
  })

  const log = await prisma.chinaBuyRouteLog.create({
    data: {
      supplierId: input.supplierId,
      productId: input.productId ?? null,
      agentId: input.agentId,
      platform: input.platform?.trim() ?? null,
      sourceUrl,
      status: adapter.status,
      externalRef: adapter.externalRef ?? null,
      errorMessage: adapter.errorMessage ?? null,
      idempotencyKey,
    },
    select: { id: true, status: true, externalRef: true },
  })

  console.log("[china-buy]", {
    supplierId: input.supplierId,
    productId: input.productId ?? null,
    agentId: input.agentId,
    platform: input.platform ?? null,
    logId: log.id,
    status: log.status,
    result: "routed",
  })

  return {
    ok: true,
    logId: log.id,
    status: log.status,
    externalRef: log.externalRef,
  }
}
