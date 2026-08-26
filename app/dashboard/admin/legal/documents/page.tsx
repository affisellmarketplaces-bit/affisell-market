import type { Metadata } from "next"

import { IngAdminBoundary } from "@/components/admin/ing-admin-boundary"
import { LegalDocumentsPanel } from "@/components/admin/legal-documents-panel"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Documents légaux | Avocat Numérique",
  robots: { index: false, follow: false },
}

export default function LegalDocumentsPage() {
  return (
    <IngAdminBoundary>
      <LegalDocumentsPanel />
    </IngAdminBoundary>
  )
}
