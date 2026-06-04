import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SuppliersPipelineClient } from "@/components/crm/suppliers-pipeline-client"
import {
  fetchSupplierPipelineFromNotion,
  getSupplierPipelineNotionConfig,
} from "@/lib/crm/notion-supplier-pipeline"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "CRM Suppliers | Affisell",
  robots: { index: false, follow: false },
}

export default async function CrmPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/admin?callbackUrl=/crm")
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    redirect("/")
  }

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
