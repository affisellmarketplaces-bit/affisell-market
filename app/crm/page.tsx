import type { Metadata } from "next"

import { SuppliersPipelineClient } from "@/components/crm/suppliers-pipeline-client"
import {
  fetchSupplierPipelineFromNotion,
  getSupplierPipelineNotionConfig,
} from "@/lib/crm/notion-supplier-pipeline"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "CRM Suppliers | Affisell",
  robots: { index: false, follow: false },
}

export default async function CrmPage() {
  const notion = getSupplierPipelineNotionConfig()
  const { rows, error } = notion.configured
    ? await fetchSupplierPipelineFromNotion()
    : { rows: [], error: null }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SuppliersPipelineClient
        rows={rows}
        notionConfigured={notion.configured}
        notionDatabaseId={notion.databaseId}
        fetchError={error}
      />
    </main>
  )
}
