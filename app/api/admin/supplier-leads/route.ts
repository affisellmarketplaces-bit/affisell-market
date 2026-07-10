import type { LeadStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  createLead,
  getLeads,
  getSupplierLeadStats,
  serializeSupplierLead,
} from "@/lib/supplier-leads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEAD_STATUSES: LeadStatus[] = ["CONTACTED", "REPLIED", "DEMO_BOOKED", "CONVERTED", "LOST"]

const createLeadSchema = z.object({
  email: z.string().email(),
  domain: z.string().min(1),
  brand: z.string().min(1),
  firstName: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  source: z.enum(["shopify", "linkedin", "manual", "referral"]).or(z.string().min(1)),
  notes: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const statusParam = url.searchParams.get("status")
  const sourceParam = url.searchParams.get("source")
  const status =
    statusParam && LEAD_STATUSES.includes(statusParam as LeadStatus)
      ? (statusParam as LeadStatus)
      : undefined
  const source = sourceParam?.trim() || undefined

  const [leads, stats] = await Promise.all([
    getLeads({ status, source }),
    getSupplierLeadStats(),
  ])

  return NextResponse.json({
    leads: leads.map(serializeSupplierLead),
    stats,
  })
}

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 })
  }

  const lead = await createLead({
    ...parsed.data,
    source: parsed.data.source === "manual" ? "manual" : parsed.data.source,
  })

  return NextResponse.json({ lead: serializeSupplierLead(lead) }, { status: 201 })
}
