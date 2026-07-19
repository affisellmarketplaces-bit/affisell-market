import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { flushLogs, logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { parseSupplierKind } from "@/lib/supplier-kind"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/supplier-profile/me — current user supplierKind from DB (not stale JWT).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    await flushLogs()
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, supplierKind: true, role: true },
  })

  if (!row) {
    await flushLogs()
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  logger.info("[supplier-profile/me]", {
    userId: row.id,
    result: "ok",
    supplierKind: row.supplierKind,
  })
  await flushLogs()

  return NextResponse.json({
    id: row.id,
    supplierKind: parseSupplierKind(row.supplierKind),
    role: row.role,
  })
}
