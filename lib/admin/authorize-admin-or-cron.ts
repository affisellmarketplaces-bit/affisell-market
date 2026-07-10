import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

/** Admin session or `Authorization: Bearer ${CRON_SECRET}` (ops scripts). */
export async function authorizeAdminOrCron(req: Request) {
  const cronDenied = authorizeCronRequest(req)
  if (cronDenied === null) {
    return { ok: true as const, via: "cron" as const }
  }

  const gate = await requireAdminSession()
  if (!gate.ok) {
    return { ok: false as const, status: gate.status, error: gate.error }
  }

  return { ok: true as const, via: "admin" as const, session: gate.session }
}
