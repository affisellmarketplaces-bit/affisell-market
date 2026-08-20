import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { syncOrchestrator, SyncJobConflictError } from "@/lib/integrations/orchestrator"
import { getIntegrationProviderBySlug, platformFromSlug } from "@/lib/integrations/registry"
import { providerEnumFromSlug } from "@/lib/integrations/types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ provider: string }> }

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { provider: providerSlug } = await ctx.params
  const providerEnum = providerEnumFromSlug(providerSlug)
  const adapter = getIntegrationProviderBySlug(providerSlug)
  if (!providerEnum || !adapter) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 })
  }

  let body: { integrationId?: string }
  try {
    body = (await req.json()) as { integrationId?: string }
  } catch {
    body = {}
  }

  const platform = platformFromSlug(providerSlug as "shopify" | "woo" | "custom-api")

  const integration = body.integrationId
    ? await prisma.supplierIntegration.findFirst({
        where: {
          id: body.integrationId,
          userId: session.user.id,
          provider: providerEnum,
        },
      })
    : await prisma.supplierIntegration.findFirst({
        where: {
          userId: session.user.id,
          platform,
          provider: providerEnum,
          status: { not: "DISCONNECTED" },
        },
        orderBy: { updatedAt: "desc" },
      })

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 })
  }

  try {
    const { jobId, stats } = await syncOrchestrator.sync(integration.id, session.user.id)
    const syncedCount = stats.imported + stats.updated + stats.unpublished
    return NextResponse.json({
      ok: true,
      jobId,
      syncedCount,
      stats,
    })
  } catch (e) {
    if (e instanceof SyncJobConflictError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 })
    }
    const msg = e instanceof Error ? e.message : "Sync failed"
    console.error("[integrations/sync]", {
      provider: providerSlug,
      supplierId: session.user.id,
      integrationId: integration.id,
      result: "error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
