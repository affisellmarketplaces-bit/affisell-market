import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Manually dismiss a signal until the next scan re-detects it. */
export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const row = await prisma.opsSignal.findUnique({ where: { id }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 })
  }

  await prisma.opsSignal.update({
    where: { id },
    data: { resolvedAt: new Date() },
  })

  console.log("[sentinel]", { signalId: id, result: "manual_resolve", actorId: auth.session.user.id })

  return NextResponse.json({ ok: true })
}
