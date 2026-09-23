import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { syncOrchestrator, SyncJobConflictError } from "@/lib/integrations/orchestrator"
import { syncJobModelLive } from "@/lib/integrations/schema-capabilities"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Resolves a Sync Guardian's `NEEDS_REVIEW` parked run — "apply" re-runs the sync with the
 * guard bypassed (the supplier reviewed the drop and confirmed it's real), "dismiss" clears
 * it without writing anything (nothing changes; the next scheduled/manual sync judges itself
 * against the same last-known-healthy baseline).
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!syncJobModelLive()) {
    return NextResponse.json({ error: "Not available yet — run npx prisma migrate deploy" }, { status: 503 })
  }

  const { id: integrationId } = await ctx.params

  let body: { action?: string }
  try {
    body = (await req.json()) as { action?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (body.action !== "apply" && body.action !== "dismiss") {
    return NextResponse.json({ error: "action must be apply or dismiss" }, { status: 400 })
  }

  const integration = await prisma.supplierIntegration.findFirst({
    where: { id: integrationId, userId: session.user.id },
    select: { id: true },
  })
  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 })
  }

  const pending = await prisma.syncJob.findFirst({
    where: { integrationId, status: "NEEDS_REVIEW" },
    orderBy: { createdAt: "desc" },
  })
  if (!pending) {
    return NextResponse.json({ error: "No sync is waiting for review" }, { status: 404 })
  }

  if (body.action === "dismiss") {
    await prisma.syncJob.update({
      where: { id: pending.id },
      data: { status: "FAILED", error: "dismissed_by_supplier" },
    })
    return NextResponse.json({ ok: true, dismissed: true })
  }

  try {
    const { jobId, stats, guard } = await syncOrchestrator.sync(integrationId, session.user.id, { force: true })
    const syncedCount = stats.imported + stats.updated + stats.unpublished
    return NextResponse.json({ ok: true, applied: true, jobId, syncedCount, stats, guard: guard.triggered ? guard : null })
  } catch (e) {
    if (e instanceof SyncJobConflictError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 })
    }
    const msg = e instanceof Error ? e.message : "Sync failed"
    console.error("[integrations/review-sync]", {
      supplierId: session.user.id,
      integrationId,
      result: "error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
