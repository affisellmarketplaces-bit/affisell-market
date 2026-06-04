import type { AdminTermsLogRow } from "@/lib/admin/terms-logs/types"
import { prisma } from "@/lib/prisma"

const DEFAULT_LIMIT = 2000

export async function loadTermsAcceptanceLogsForAdmin(
  limit = DEFAULT_LIMIT
): Promise<AdminTermsLogRow[]> {
  const rows = await prisma.termsAcceptanceLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    type: row.type,
    version: row.version,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }))
}
