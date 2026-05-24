import { redirect } from "next/navigation"

import { SplitsPageClient } from "@/app/admin/splits/splits-page-client"
import { loadAdminSplits } from "@/lib/admin/splits/load-splits"
import type { SplitDisplayStatus } from "@/lib/admin/splits/types"
import { SPLIT_DISPLAY_STATUSES } from "@/lib/admin/splits/types"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
  status?: string
  from?: string
  to?: string
}>

function parseDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function parseStatus(value: string | undefined): SplitDisplayStatus | "all" {
  if (!value || value === "all") return "all"
  return SPLIT_DISPLAY_STATUSES.includes(value as SplitDisplayStatus)
    ? (value as SplitDisplayStatus)
    : "all"
}

export default async function AdminSplitsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/splits")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const sp = await searchParams
  const status = parseStatus(sp.status)
  const from = parseDate(sp.from)
  const to = parseDate(sp.to)

  const rows = await loadAdminSplits({ status, from, to })

  const summary = {
    SUCCESS: rows.filter((r) => r.splitStatus === "SUCCESS").length,
    PARTIAL: rows.filter((r) => r.splitStatus === "PARTIAL").length,
    FAILED: rows.filter((r) => r.splitStatus === "FAILED").length,
    PENDING: rows.filter((r) => r.splitStatus === "PENDING").length,
    blocked: rows.filter((r) => r.splitStatus === "PARTIAL" || r.splitStatus === "FAILED").length,
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SplitsPageClient
        rows={rows}
        summary={summary}
        initialFilters={{
          status,
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />
    </main>
  )
}
