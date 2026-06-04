import type { SupplierPipelineStatus } from "@/lib/crm/supplier-pipeline-status"

/** Ligne « Suppliers Pipeline » (Notion ou affichage local). */
export type SupplierPipelineRow = {
  id: string
  name: string
  siteUrl: string | null
  siret: string | null
  categorie: string | null
  telegram: string | null
  status: SupplierPipelineStatus
  dernierContact: string | null
  notes: string | null
  notionUrl: string | null
}

export type SupplierPipelineNotionConfig = {
  configured: boolean
  databaseId: string | null
}
