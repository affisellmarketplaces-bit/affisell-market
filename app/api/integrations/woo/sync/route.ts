import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { syncOrchestrator, SyncJobConflictError } from "@/lib/integrations/orchestrator"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** WooCommerce manual sync — delegates to SyncOrchestrator. */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { integrationId?: string; force?: boolean }
  try {
    body = (await req.json()) as { integrationId?: string; force?: boolean }
  } catch {
    body = {}
  }

  const integration = body.integrationId
    ? await prisma.supplierIntegration.findFirst({
        where: {
          id: body.integrationId,
          userId: session.user.id,
          platform: "woocommerce",
          provider: "WOOCOMMERCE",
        },
      })
    : await prisma.supplierIntegration.findFirst({
        where: {
          userId: session.user.id,
          platform: "woocommerce",
          provider: "WOOCOMMERCE",
          status: { not: "DISCONNECTED" },
        },
        orderBy: { updatedAt: "desc" },
      })

  if (!integration) {
    return NextResponse.json({ error: "WooCommerce integration not found" }, { status: 404 })
  }

  try {
    const { jobId, stats, guard } = await syncOrchestrator.sync(integration.id, session.user.id, {
      force: body.force === true,
    })
    const syncedCount = stats.imported + stats.updated + stats.unpublished
    return NextResponse.json({ ok: true, jobId, syncedCount, stats, guard: guard.triggered ? guard : null })
  } catch (e) {
    if (e instanceof SyncJobConflictError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 })
    }
    const msg = e instanceof Error ? e.message : "Sync failed"
    console.error("[woo-sync]", {
      supplierId: session.user.id,
      integrationId: integration.id,
      result: "sync_error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
