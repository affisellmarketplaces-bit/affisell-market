import type { Metadata } from "next"

import { IngAdminBoundary } from "@/components/admin/ing-admin-boundary"
import { IngAdminPanel } from "@/components/admin/ing-admin-panel"
import { LogObserver } from "@/lib/ai-engineer/observer"
import type { IngAnalyzeResult } from "@/lib/ai-engineer/types"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Ing | Affisell Admin",
  robots: { index: false, follow: false },
}

export default async function AdminIngPage() {
  let initialAnalyze: IngAnalyzeResult | null = null
  let bootstrapError: string | null = null

  try {
    const observer = new LogObserver()
    initialAnalyze = await observer.analyzeLastLogs(100)
  } catch (error) {
    bootstrapError =
      error instanceof Error ? error.message : "Ing bootstrap failed — check DATABASE_URL"
    console.error("[ing]", { stage: "page_bootstrap", error: bootstrapError })
  }

  return (
    <IngAdminBoundary>
      <IngAdminPanel initialAnalyze={initialAnalyze} bootstrapError={bootstrapError} />
    </IngAdminBoundary>
  )
}
