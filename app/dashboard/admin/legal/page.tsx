import type { Metadata } from "next"

import { IngAdminBoundary } from "@/components/admin/ing-admin-boundary"
import { LegalAdminPanel } from "@/components/admin/legal-admin-panel"
import { hasOpenAiFallback } from "@/lib/ai/openai-chat-fallback"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Avocat Numérique | Affisell Admin",
  robots: { index: false, follow: false },
}

export default function AdminLegalPage() {
  const openAiConfigured = hasOpenAiFallback()

  return (
    <IngAdminBoundary>
      <LegalAdminPanel openAiConfigured={openAiConfigured} />
    </IngAdminBoundary>
  )
}
