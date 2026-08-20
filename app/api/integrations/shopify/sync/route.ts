import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { syncOrchestrator, SyncJobConflictError } from "@/lib/integrations/orchestrator"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Legacy path — delegates to SyncOrchestrator (GraphQL + SyncJob). */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { supplierId?: string; integrationId?: string }
  try {
    body = (await req.json()) as { supplierId?: string; integrationId?: string }
  } catch {
    body = {}
  }

  const supplierId = body.supplierId?.trim() || session.user.id
  if (supplierId !== session.user.id) {
    return NextResponse.json({ error: "supplierId mismatch" }, { status: 403 })
  }

  const integration = body.integrationId
    ? await prisma.supplierIntegration.findFirst({
        where: { id: body.integrationId, userId: supplierId, platform: "shopify" },
      })
    : await prisma.supplierIntegration.findFirst({
        where: {
          userId: supplierId,
          platform: "shopify",
          status: { not: "DISCONNECTED" },
        },
        orderBy: { updatedAt: "desc" },
      })

  if (!integration) {
    return NextResponse.json({ error: "Shopify integration not found" }, { status: 404 })
  }

  try {
    const { jobId, stats } = await syncOrchestrator.sync(integration.id, supplierId)
    const syncedCount = stats.imported + stats.updated + stats.unpublished
    return NextResponse.json({ ok: true, jobId, syncedCount, summary: stats, stats })
  } catch (e) {
    if (e instanceof SyncJobConflictError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 })
    }
    const msg = e instanceof Error ? e.message : "Sync failed"
    console.error("[integrations/shopify/sync]", {
      supplierId,
      integrationId: integration.id,
      result: "error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
