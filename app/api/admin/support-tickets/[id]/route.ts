import { NextResponse } from "next/server"
import { z } from "zod"

import { isSupportTicketStatus } from "@/lib/admin/support-ticket-shared"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  status: z.string().optional(),
  adminNote: z.string().max(4000).optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 })
  }

  const existing = await prisma.supportTicket.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const nextStatus = parsed.data.status
  if (nextStatus !== undefined && !isSupportTicketStatus(nextStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 })
  }

  const status = nextStatus ?? existing.status
  const resolvedAt =
    status === "RESOLVED" || status === "SPAM"
      ? existing.resolvedAt ?? new Date()
      : status === "OPEN" || status === "IN_PROGRESS"
        ? null
        : existing.resolvedAt

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status,
      adminNote: parsed.data.adminNote !== undefined ? parsed.data.adminNote : undefined,
      resolvedAt,
    },
  })

  console.log("[admin-support]", {
    ticketId: id,
    ticketRef: updated.ticketRef,
    status: updated.status,
    result: "updated",
  })

  return NextResponse.json({
    ok: true,
    ticket: {
      id: updated.id,
      ticketRef: updated.ticketRef,
      status: updated.status,
      adminNote: updated.adminNote,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    },
  })
}
