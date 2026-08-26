import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  listRecentLegalScans,
  runLegalGuardianScan,
  updateLegalScanStatus,
} from "@/lib/legal/run-legal-scan"
import type { LegalIssue } from "@/lib/legal/scan-types"
import { prisma } from "@/lib/prisma"

async function enrichScansWithSupplierId(
  scans: Array<{
    id: string
    type: string
    targetId: string
    targetName: string
    riskScore: number
    issues: unknown
    status: string
    createdAt: Date
    updatedAt: Date
  }>
) {
  const productIds = scans.filter((s) => s.type === "product").map((s) => s.targetId)
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, supplierId: true },
        })
      : []
  const supplierByProduct = new Map(products.map((p) => [p.id, p.supplierId]))

  return scans.map((row) => ({
    id: row.id,
    type: row.type,
    targetId: row.targetId,
    targetName: row.targetName,
    riskScore: row.riskScore,
    issues: row.issues as LegalIssue[],
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    supplierIdForLetter:
      row.type === "supplier"
        ? row.targetId
        : (supplierByProduct.get(row.targetId) ?? null),
  }))
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const patchSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["open", "fixed", "ignored"]),
  })
  .strict()

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const scans = await listRecentLegalScans(20)
    const enriched = await enrichScansWithSupplierId(scans)
    return Response.json({
      ok: true,
      scans: enriched,
    })
  } catch (error) {
    console.error("[legal:scan]", {
      stage: "get",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "list_failed" }, { status: 500 })
  }
}

export async function POST() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const { stats, highRisk } = await runLegalGuardianScan({ dryRun: false })
    console.log("[legal:scan]", { stage: "post", result: "ok", ...stats })
    return Response.json({ ok: true, stats, highRisk })
  } catch (error) {
    console.error("[legal:scan]", {
      stage: "post",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "scan_failed" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const body = patchSchema.parse(await req.json())
    await updateLegalScanStatus(body.id, body.status)
    console.log("[legal:scan]", { stage: "patch", id: body.id, status: body.status })
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "patch_failed"
    console.log("[legal:scan]", { stage: "patch", result: "error", message })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}
