import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { flushLogs, logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { gate } from "@/lib/radar/gate"
import {
  getRadarCockpit,
  needsSupplierKindOnboarding,
  parseSupplierKind,
} from "@/lib/supplier-kind"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/radar/context — Radar cockpit hint from User.supplierKind.
 */
export async function GET() {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    await flushLogs()
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { supplierKind: true, role: true },
  })

  const supplierKind = parseSupplierKind(row?.supplierKind)
  const cockpit = getRadarCockpit(supplierKind)
  const needsOnboarding = needsSupplierKindOnboarding(supplierKind)

  logger.info("[radar/context]", {
    userId: session.user.id,
    result: "ok",
    supplierKind,
    cockpit,
    needsOnboarding,
  })
  await flushLogs()

  return NextResponse.json({
    supplierKind,
    cockpit,
    needsOnboarding,
  })
}
