import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import {
  guessSkuOriginCountry,
  isAgentMissionType,
  matchAgentsForMission,
  missionTypeDef,
  type AgentCapabilityValue,
  type AgentMissionTypeValue,
} from "@/lib/agents/agent-network-shared"
import { toMissionRow } from "@/lib/agents/load-agent-network"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSchema = z.object({
  type: z.string().refine(isAgentMissionType, "invalid_mission_type"),
  productId: z.string().min(1),
  instructions: z.string().trim().max(2000).optional(),
})

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

/** Liste les missions agents du fournisseur connecté. */
export async function GET() {
  const guard = await requireSupplier()
  if ("error" in guard) return guard.error

  const missions = await prisma.agentMission.findMany({
    where: { supplierId: guard.supplierId },
    select: {
      id: true,
      type: true,
      status: true,
      productId: true,
      instructions: true,
      reportSummary: true,
      photoUrls: true,
      feeCents: true,
      autoBuyPaused: true,
      requestedAt: true,
      completedAt: true,
      product: { select: { name: true, images: true } },
      agent: { select: { displayName: true, country: true, city: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 40,
  })

  return NextResponse.json({
    ok: true,
    missions: missions.map((m) =>
      toMissionRow(m as Parameters<typeof toMissionRow>[0])
    ),
  })
}

/**
 * Crée une mission d'inspection sur un SKU du fournisseur connecté et
 * auto-assigne le meilleur agent (capacité requise + pays d'origine + note + rapidité).
 * Idempotence : une mission ouverte du même type sur le même SKU est renvoyée telle quelle.
 */
export async function POST(req: Request) {
  const guard = await requireSupplier()
  if ("error" in guard) return guard.error
  const supplierId = guard.supplierId

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const type = parsed.data.type as AgentMissionTypeValue

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, supplierId: true, importSource: true, sourceUrl: true },
  })
  if (!product || product.supplierId !== supplierId) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const existing = await prisma.agentMission.findFirst({
    where: {
      supplierId,
      productId: product.id,
      type,
      status: { in: ["REQUESTED", "ASSIGNED", "IN_PROGRESS"] },
    },
    select: { id: true, status: true },
  })
  if (existing) {
    console.log("[agent-network]", {
      supplierId,
      productId: product.id,
      type,
      missionId: existing.id,
      result: "already_open",
    })
    return NextResponse.json({ ok: true, missionId: existing.id, status: existing.status, deduped: true })
  }

  const def = missionTypeDef(type)
  const candidates = await prisma.sourcingAgent.findMany({
    where: { status: "ACTIVE", capabilities: { has: def.capability } },
    take: 60,
  })
  const ranked = matchAgentsForMission(
    candidates.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      country: a.country,
      city: a.city,
      capabilities: a.capabilities as AgentCapabilityValue[],
      ratingX10: a.ratingX10,
      missionsDone: a.missionsDone,
      leadTimeHours: a.leadTimeHours,
    })),
    { missionType: type, preferredCountry: guessSkuOriginCountry(product) }
  )
  const best = ranked[0] ?? null

  const mission = await prisma.agentMission.create({
    data: {
      supplierId,
      productId: product.id,
      type,
      instructions: parsed.data.instructions || null,
      feeCents: def.listPriceCents,
      ...(best
        ? { agentId: best.agent.id, status: "ASSIGNED", assignedAt: new Date() }
        : {}),
    },
    select: { id: true, status: true, agent: { select: { displayName: true, country: true } } },
  })

  console.log("[agent-network]", {
    supplierId,
    productId: product.id,
    type,
    missionId: mission.id,
    agent: mission.agent?.displayName ?? null,
    matchScore: best?.score ?? null,
    result: "created",
  })

  return NextResponse.json({
    ok: true,
    missionId: mission.id,
    status: mission.status,
    agentName: mission.agent?.displayName ?? null,
    agentCountry: mission.agent?.country ?? null,
  })
}
