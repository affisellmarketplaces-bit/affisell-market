import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { gate } from "@/lib/radar/gate"
import { getRadarImportJobForUser } from "@/lib/radar/radar-import-bridge.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/radar/import-job/[jobId]
 * Read ImportJob payload for supplier prefill (`?prefill=jobId` on product wizard).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const { jobId } = await ctx.params
  const trimmed = jobId?.trim()
  if (!trimmed) {
    return NextResponse.json({ error: "missing_job_id" }, { status: 400 })
  }

  const job = await getRadarImportJobForUser({ jobId: trimmed, userId: session.user.id })
  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 })
  }

  console.log("[api/radar/import-job]", {
    userId: session.user.id,
    jobId: job.id,
    count: job.products.length,
    destination: job.destination,
  })

  return NextResponse.json(job)
}
