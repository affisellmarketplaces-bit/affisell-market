import type { LeadStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const SUPPLIER_LEAD_CONVERSION_BONUS_CENTS = 10_000
export const SUPPLIER_LEAD_BONUS_ENTRY_TYPE = "SUPPLIER_LEAD_CONVERTED"

export type CreateSupplierLeadInput = {
  email: string
  domain: string
  brand: string
  firstName?: string | null
  linkedinUrl?: string | null
  source: string
  notes?: string | null
  status?: LeadStatus
}

export type SupplierLeadRow = {
  id: string
  email: string
  domain: string
  brand: string
  firstName: string | null
  linkedinUrl: string | null
  status: LeadStatus
  source: string
  contactedAt: Date
  repliedAt: Date | null
  demoAt: Date | null
  convertedAt: Date | null
  convertedUserId: string | null
  notes: string | null
}

export type SupplierLeadStats = {
  total: number
  repliedPct: number
  convertedPct: number
  byStatus: Record<LeadStatus, number>
}

const LEAD_SELECT = {
  id: true,
  email: true,
  domain: true,
  brand: true,
  firstName: true,
  linkedinUrl: true,
  status: true,
  source: true,
  contactedAt: true,
  repliedAt: true,
  demoAt: true,
  convertedAt: true,
  convertedUserId: true,
  notes: true,
} satisfies Prisma.SupplierLeadSelect

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function statusTimestampField(
  status: LeadStatus
): "repliedAt" | "demoAt" | "convertedAt" | null {
  if (status === "REPLIED") return "repliedAt"
  if (status === "DEMO_BOOKED") return "demoAt"
  if (status === "CONVERTED") return "convertedAt"
  return null
}

export async function createLead(data: CreateSupplierLeadInput): Promise<SupplierLeadRow> {
  const email = normalizeEmail(data.email)
  const existing = await prisma.supplierLead.findUnique({ where: { email } })
  if (existing) {
    console.log("[supplier-leads]", { email, result: "duplicate_email" })
    return existing
  }

  const lead = await prisma.supplierLead.create({
    data: {
      email,
      domain: data.domain.trim(),
      brand: data.brand.trim(),
      firstName: data.firstName?.trim() || null,
      linkedinUrl: data.linkedinUrl?.trim() || null,
      source: data.source.trim(),
      notes: data.notes?.trim() || null,
      status: data.status ?? "CONTACTED",
    },
    select: LEAD_SELECT,
  })

  console.log("[supplier-leads]", { leadId: lead.id, email, source: lead.source, result: "created" })
  return lead
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
  notes?: string | null
): Promise<SupplierLeadRow | null> {
  const existing = await prisma.supplierLead.findUnique({ where: { id } })
  if (!existing) return null

  const tsField = statusTimestampField(status)
  const now = new Date()

  const lead = await prisma.supplierLead.update({
    where: { id },
    data: {
      status,
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(tsField === "repliedAt" && !existing.repliedAt ? { repliedAt: now } : {}),
      ...(tsField === "demoAt" && !existing.demoAt ? { demoAt: now } : {}),
      ...(tsField === "convertedAt" && !existing.convertedAt ? { convertedAt: now } : {}),
    },
    select: LEAD_SELECT,
  })

  console.log("[supplier-leads]", { leadId: id, status, result: "status_updated" })
  return lead
}

export async function markConverted(
  id: string,
  userId: string
): Promise<
  | { ok: true; lead: SupplierLeadRow; bonusCents: number; duplicate?: boolean }
  | { ok: false; reason: string }
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })
  if (!user) return { ok: false, reason: "user_not_found" }
  if (user.role !== "SUPPLIER") return { ok: false, reason: "user_not_supplier" }

  const bonusKey = `supplier-lead:converted:${id}`

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.supplierLead.findUnique({ where: { id } })
    if (!lead) return { ok: false as const, reason: "lead_not_found" }

    const now = new Date()
    const updated = await tx.supplierLead.update({
      where: { id },
      data: {
        status: "CONVERTED",
        convertedUserId: userId,
        convertedAt: lead.convertedAt ?? now,
        repliedAt: lead.repliedAt ?? now,
      },
      select: LEAD_SELECT,
    })

    const existingBonus = await tx.referralBonusLedger.findUnique({
      where: { idempotencyKey: bonusKey },
    })
    if (existingBonus) {
      return { ok: true as const, lead: updated, bonusCents: existingBonus.amountCents, duplicate: true }
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        referralBonusBalanceCents: { increment: SUPPLIER_LEAD_CONVERSION_BONUS_CENTS },
      },
    })
    await tx.referralBonusLedger.create({
      data: {
        userId,
        entryType: SUPPLIER_LEAD_BONUS_ENTRY_TYPE,
        amountCents: SUPPLIER_LEAD_CONVERSION_BONUS_CENTS,
        idempotencyKey: bonusKey,
        note: `Supplier lead converted: ${lead.brand}`,
      },
    })

    return {
      ok: true as const,
      lead: updated,
      bonusCents: SUPPLIER_LEAD_CONVERSION_BONUS_CENTS,
    }
  })

  if (result.ok) {
    console.log("[supplier-leads]", {
      leadId: id,
      userId,
      bonusCents: result.bonusCents,
      duplicate: "duplicate" in result ? result.duplicate : false,
      result: "converted",
    })
  }

  return result
}

export async function getLeads(filters?: {
  status?: LeadStatus
  source?: string
}): Promise<SupplierLeadRow[]> {
  return prisma.supplierLead.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.source ? { source: filters.source } : {}),
    },
    orderBy: { contactedAt: "desc" },
    select: LEAD_SELECT,
  })
}

/** @deprecated Use getLeads({ status }) */
export async function getLeadsByStatus(status?: LeadStatus): Promise<SupplierLeadRow[]> {
  return getLeads(status ? { status } : undefined)
}

export async function getSupplierLeadStats(): Promise<SupplierLeadStats> {
  const grouped = await prisma.supplierLead.groupBy({
    by: ["status"],
    _count: { id: true },
  })

  const byStatus: Record<LeadStatus, number> = {
    CONTACTED: 0,
    REPLIED: 0,
    DEMO_BOOKED: 0,
    CONVERTED: 0,
    LOST: 0,
  }

  let total = 0
  for (const row of grouped) {
    byStatus[row.status] = row._count.id
    total += row._count.id
  }

  const repliedCount = byStatus.REPLIED + byStatus.DEMO_BOOKED + byStatus.CONVERTED
  const convertedCount = byStatus.CONVERTED

  return {
    total,
    repliedPct: total > 0 ? Math.round((repliedCount / total) * 1000) / 10 : 0,
    convertedPct: total > 0 ? Math.round((convertedCount / total) * 1000) / 10 : 0,
    byStatus,
  }
}

export function serializeSupplierLead(lead: SupplierLeadRow) {
  return {
    ...lead,
    contactedAt: lead.contactedAt.toISOString(),
    repliedAt: lead.repliedAt?.toISOString() ?? null,
    demoAt: lead.demoAt?.toISOString() ?? null,
    convertedAt: lead.convertedAt?.toISOString() ?? null,
  }
}
