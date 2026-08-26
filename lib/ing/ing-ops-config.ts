/** Humanoid Ops v2 — Slack + /admin/ing dashboard gate. */
export function isIngDashboardEnabled(): boolean {
  const raw = process.env.ING_DASHBOARD_ENABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false") return false
  if (raw === "1" || raw === "true") return true
  return process.env.NODE_ENV !== "production"
}

/** Daily cron schedule — 09:00 UTC (vercel.json). */
export function nextIngCronRunUtc(from = new Date()): Date {
  const next = new Date(from)
  next.setUTCHours(9, 0, 0, 0)
  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1)
  }
  return next
}

export function formatIngOpsRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "just now"
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
