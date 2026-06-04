/** Statuts pipeline fournisseurs — alignés sur la base Notion « Suppliers Pipeline ». */
export const SUPPLIER_PIPELINE_STATUSES = [
  "Lead",
  "Contacted",
  "Call Booké",
  "Négociation",
  "Onboarded",
  "Actif",
  "Lost",
] as const

export type SupplierPipelineStatus = (typeof SUPPLIER_PIPELINE_STATUSES)[number]

export const SUPPLIER_PIPELINE_KANBAN_STATUSES: SupplierPipelineStatus[] = [
  "Lead",
  "Contacted",
  "Call Booké",
  "Négociation",
  "Onboarded",
  "Actif",
  "Lost",
]

export function isSupplierPipelineStatus(value: string): value is SupplierPipelineStatus {
  return (SUPPLIER_PIPELINE_STATUSES as readonly string[]).includes(value)
}

export const PIPELINE_VIEW_FILTER_STATUSES: SupplierPipelineStatus[] = ["Lead", "Contacted"]
