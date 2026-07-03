import type { SupplierPipelineStatus } from "@/lib/crm/supplier-pipeline-status"
import { isSupplierPipelineStatus } from "@/lib/crm/supplier-pipeline-status"

export type NotionCrmSchemaKind = "supplier_pipeline" | "crm_affisell"

export type NotionPropertyMeta = { name: string; type: string }

export type NotionLeadCreateInput = {
  name: string
  siteUrl?: string | null
  contactEmail?: string | null
  contactName?: string | null
  status?: SupplierPipelineStatus
  categorie?: string | null
  notes: string
  dernierContactIso?: string
}

const SUPPLIER_PIPELINE_TITLE = "Name"
const CRM_AFFISELL_TITLE = "Nom"

/** Accept UUID with or without dashes (common copy/paste from Notion URLs). */
export function normalizeNotionDatabaseId(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  const compact = trimmed.replace(/-/g, "")
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase()
  }
  return trimmed
}

export function detectNotionCrmSchema(
  properties: Record<string, { type?: string }>
): NotionCrmSchemaKind {
  const byName = new Map<string, string>()
  for (const [name, meta] of Object.entries(properties)) {
    if (meta?.type) byName.set(name, meta.type)
  }

  if (byName.get(CRM_AFFISELL_TITLE) === "title" && byName.get("E-mail") === "email") {
    return "crm_affisell"
  }

  if (byName.get(SUPPLIER_PIPELINE_TITLE) === "title") {
    return "supplier_pipeline"
  }

  return "crm_affisell"
}

export function buildNotionLeadCreateProperties(
  schema: NotionCrmSchemaKind,
  input: NotionLeadCreateInput
): Record<string, unknown> {
  const today = input.dernierContactIso ?? new Date().toISOString().slice(0, 10)

  if (schema === "crm_affisell") {
    const properties: Record<string, unknown> = {
      Nom: {
        title: [{ text: { content: input.name.trim().slice(0, 200) } }],
      },
      Date: { date: { start: today } },
      SupplierId: {
        rich_text: [{ text: { content: input.notes.trim().slice(0, 1900) } }],
      },
    }

    const email = input.contactEmail?.trim().toLowerCase()
    if (email) {
      properties["E-mail"] = { email }
    }

    return properties
  }

  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: input.name.trim().slice(0, 200) } }],
    },
    Status: {
      select: { name: input.status ?? "Lead" },
    },
    Notes: {
      rich_text: [{ text: { content: input.notes.trim().slice(0, 1900) } }],
    },
    "Dernier contact": {
      date: { start: today },
    },
  }

  const siteUrl = input.siteUrl?.trim()
  if (siteUrl) {
    properties["URL site"] = { url: siteUrl }
  }

  const categorie = input.categorie?.trim()
  if (categorie) {
    properties["Catégorie"] = { select: { name: categorie } }
  }

  return properties
}

export function mapCrmAffisellStatus(raw: string | null, supplierIdNotes: string | null): SupplierPipelineStatus {
  if (supplierIdNotes?.includes("[Enterprise")) return "Lead"
  if (raw === "paid") return "Actif"
  if (raw === "failed" || raw === "refunded") return "Lost"
  if (raw && isSupplierPipelineStatus(raw)) return raw
  return "Lead"
}
