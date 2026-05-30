import type { AdminAutoFulfillDashboard } from "@/lib/admin/auto-fulfill/load-dashboard"

export async function fetchAdminAutoFulfillDashboard(q?: string): Promise<AdminAutoFulfillDashboard> {
  const params = new URLSearchParams()
  if (q?.trim()) params.set("q", q.trim())
  const res = await fetch(`/api/admin/auto-fulfill?${params}`, { credentials: "include", cache: "no-store" })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<AdminAutoFulfillDashboard>
}
