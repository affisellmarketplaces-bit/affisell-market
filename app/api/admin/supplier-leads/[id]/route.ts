import type { LeadStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  markConverted,
  serializeSupplierLead,
  updateLeadStatus,
} from "@/lib/supplier-leads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const patchSchema = z
  .object({
    status: z.enum(["CONTACTED", "REPLIED", "DEMO_BOOKED", "CONVERTED", "LOST"]).optional(),
    notes: z.string().optional().nullable(),
    convertedUserId: z.string().optional(),
  })
  .refine((data) => data.status !== undefined || data.notes !== undefined || data.convertedUserId !== undefined, {
    message: "status, notes, or convertedUserId required",
  })

export async function PATCH(req: Request, context: RouteContext) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.status === "CONVERTED" || parsed.data.convertedUserId) {
    if (!parsed.data.convertedUserId) {
      return NextResponse.json({ error: "convertedUserId_required" }, { status: 400 })
    }
    const result = await markConverted(id, parsed.data.convertedUserId)
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }
    return NextResponse.json({
      lead: serializeSupplierLead(result.lead),
      bonusCents: result.bonusCents,
      duplicate: result.duplicate ?? false,
    })
  }

  if (!parsed.data.status) {
    return NextResponse.json({ error: "status_required" }, { status: 400 })
  }

  const lead = await updateLeadStatus(id, parsed.data.status as LeadStatus, parsed.data.notes)
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ lead: serializeSupplierLead(lead) })
}
