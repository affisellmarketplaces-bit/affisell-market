import { Eye } from "lucide-react"
import { notFound } from "next/navigation"

import { isE2ePulseFixturesEnabled } from "@/lib/e2e-pulse-swipe-fixtures"
import { shouldShowAffiliateCreatorsWatchingBadge } from "@/lib/affiliate-product-opportunity-pulse-shared"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ count?: string }>
}

function isE2eLtvRouteEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true
  return isE2ePulseFixturesEnabled()
}

/** Playwright-only — Opportunity Pulse badge threshold (non-production). */
export default async function E2eLtvBadgePage({ searchParams }: PageProps) {
  if (!isE2eLtvRouteEnabled()) notFound()

  const sp = await searchParams
  const count = Number.parseInt(sp.count ?? "3", 10)
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0

  if (!shouldShowAffiliateCreatorsWatchingBadge(safeCount)) {
    return <p data-testid="badge-hidden">hidden</p>
  }

  return (
    <div
      data-testid="affiliate-creators-watching-badge"
      className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-sm font-bold text-white"
    >
      <Eye className="size-4" aria-hidden />
      {safeCount} creators watching
    </div>
  )
}
