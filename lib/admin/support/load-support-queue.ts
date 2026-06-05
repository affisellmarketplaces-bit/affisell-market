import type { SupportTicketStatus } from "@/lib/admin/support-ticket-shared"
import { isSupportTicketStatus } from "@/lib/admin/support-ticket-shared"
import { prisma } from "@/lib/prisma"

export type AdminSupportTicketRow = {
  id: string
  ticketRef: string
  name: string
  email: string
  subject: string
  message: string
  status: SupportTicketStatus
  adminNote: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminSupportStats = {
  open: number
  inProgress: number
  resolved: number
  spam: number
}

export type AdminSupportQueueResponse = {
  stats: AdminSupportStats
  rows: AdminSupportTicketRow[]
}

export function parseSupportStatusFilter(
  raw: string | null
): SupportTicketStatus | "all" | "active" {
  if (!raw || raw === "active") return "active"
  if (raw === "all") return "all"
  return isSupportTicketStatus(raw) ? raw : "active"
}

function serializeRow(row: {
  id: string
  ticketRef: string
  name: string
  email: string
  subject: string
  message: string
  status: string
  adminNote: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): AdminSupportTicketRow {
  return {
    id: row.id,
    ticketRef: row.ticketRef,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status as SupportTicketStatus,
    adminNote: row.adminNote,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function loadAdminSupportStats(): Promise<AdminSupportStats> {
  const grouped = await prisma.supportTicket.groupBy({
    by: ["status"],
    _count: { _all: true },
  })
  const map = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]))
  return {
    open: map.OPEN ?? 0,
    inProgress: map.IN_PROGRESS ?? 0,
    resolved: map.RESOLVED ?? 0,
    spam: map.SPAM ?? 0,
  }
}

export async function loadAdminSupportQueue(
  statusFilter: ReturnType<typeof parseSupportStatusFilter> = "active"
): Promise<AdminSupportQueueResponse> {
  const where =
    statusFilter === "all"
      ? undefined
      : statusFilter === "active"
        ? { status: { in: ["OPEN", "IN_PROGRESS"] } }
        : { status: statusFilter }

  const [stats, rows] = await Promise.all([
    loadAdminSupportStats(),
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ])

  return {
    stats,
    rows: rows.map(serializeRow),
  }
}
