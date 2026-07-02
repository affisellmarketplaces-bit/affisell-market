import {
  isSupplierPipelineStatus,
  type SupplierPipelineStatus,
} from "@/lib/crm/supplier-pipeline-status"
import type { SupplierPipelineNotionConfig, SupplierPipelineRow } from "@/lib/crm/supplier-pipeline-types"

const NOTION_VERSION = "2022-06-28"

/** Noms de propriétés Notion — doivent correspondre au template. */
export const NOTION_CRM_PROPERTY_NAMES = {
  name: "Name",
  siteUrl: "URL site",
  siret: "SIRET",
  categorie: "Catégorie",
  telegram: "Telegram @",
  status: "Status",
  dernierContact: "Dernier contact",
  notes: "Notes",
} as const

export function getSupplierPipelineNotionConfig(): SupplierPipelineNotionConfig {
  const token = process.env.NOTION_API_KEY?.trim()
  const databaseId = process.env.NOTION_CRM_DATABASE_ID?.trim()
  return {
    configured: Boolean(token && databaseId),
    databaseId: databaseId ?? null,
  }
}

type NotionRichText = { plain_text?: string }
type NotionPage = {
  id: string
  url?: string
  properties: Record<string, unknown>
}

export async function fetchSupplierPipelineFromNotion(): Promise<{
  rows: SupplierPipelineRow[]
  error: string | null
}> {
  const token = process.env.NOTION_API_KEY?.trim()
  const databaseId = process.env.NOTION_CRM_DATABASE_ID?.trim()
  if (!token || !databaseId) {
    return { rows: [], error: "not_configured" }
  }

  const rows: SupplierPipelineRow[] = []
  let cursor: string | undefined

  try {
    do {
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
          sorts: [{ property: NOTION_CRM_PROPERTY_NAMES.name, direction: "ascending" }],
        }),
        cache: "no-store",
      })

      if (!res.ok) {
        const body = await res.text()
        console.error("[crm/notion]", { status: res.status, body: body.slice(0, 500) })
        return { rows: [], error: `notion_http_${res.status}` }
      }

      const data = (await res.json()) as {
        results: NotionPage[]
        has_more: boolean
        next_cursor: string | null
      }

      for (const page of data.results) {
        const row = parseNotionPage(page)
        if (row) rows.push(row)
      }

      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (cursor)

    console.log("[crm/notion]", { rows: rows.length, result: "ok" })
    return { rows, error: null }
  } catch (e) {
    console.error("[crm/notion]", {
      error: e instanceof Error ? e.message : String(e),
      result: "fetch_failed",
    })
    return { rows: [], error: "fetch_failed" }
  }
}

function parseNotionPage(page: NotionPage): SupplierPipelineRow | null {
  const props = page.properties
  const name = readTitle(props[NOTION_CRM_PROPERTY_NAMES.name])
  if (!name) return null

  const statusRaw = readSelect(props[NOTION_CRM_PROPERTY_NAMES.status])
  const status: SupplierPipelineStatus =
    statusRaw && isSupplierPipelineStatus(statusRaw) ? statusRaw : "Lead"

  return {
    id: page.id,
    name,
    siteUrl: readUrl(props[NOTION_CRM_PROPERTY_NAMES.siteUrl]),
    siret: readRichText(props[NOTION_CRM_PROPERTY_NAMES.siret]),
    categorie: readSelect(props[NOTION_CRM_PROPERTY_NAMES.categorie]),
    telegram: readRichText(props[NOTION_CRM_PROPERTY_NAMES.telegram]),
    status,
    dernierContact: readDate(props[NOTION_CRM_PROPERTY_NAMES.dernierContact]),
    notes: readRichText(props[NOTION_CRM_PROPERTY_NAMES.notes]),
    notionUrl: page.url ?? null,
  }
}

function readTitle(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as { type?: string; title?: NotionRichText[] }
  if (p.type !== "title" || !Array.isArray(p.title)) return null
  return p.title.map((t) => t.plain_text ?? "").join("").trim() || null
}

function readRichText(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as { type?: string; rich_text?: NotionRichText[] }
  if (p.type !== "rich_text" || !Array.isArray(p.rich_text)) return null
  const v = p.rich_text.map((t) => t.plain_text ?? "").join("").trim()
  return v || null
}

function readUrl(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as { type?: string; url?: string | null }
  if (p.type !== "url") return null
  return p.url?.trim() || null
}

function readSelect(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as { type?: string; select?: { name?: string } | null }
  if (p.type !== "select") return null
  return p.select?.name?.trim() || null
}

function readDate(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as { type?: string; date?: { start?: string } | null }
  if (p.type !== "date") return null
  return p.date?.start ?? null
}

const NOTION_KNOWN_CATEGORIES = new Set(["Mode", "Tech", "Maison"])

const ENTERPRISE_CATEGORY_TO_NOTION: Partial<Record<string, string>> = {
  fashion: "Mode",
  luxury: "Mode",
  tech: "Tech",
  home: "Maison",
}

export type CreateSupplierPipelineLeadInput = {
  name: string
  siteUrl?: string | null
  status?: "Lead"
  categorie?: string | null
  notes: string
  dernierContactIso?: string
}

/** Idempotent-safe create — duplicate brand names become separate rows (founder merges in Notion). */
export async function createSupplierPipelineLeadInNotion(
  input: CreateSupplierPipelineLeadInput
): Promise<{ ok: true; notionPageId: string; notionUrl: string | null } | { ok: false; error: string }> {
  const token = process.env.NOTION_API_KEY?.trim()
  const databaseId = process.env.NOTION_CRM_DATABASE_ID?.trim()
  if (!token || !databaseId) {
    return { ok: false, error: "not_configured" }
  }

  const properties: Record<string, unknown> = {
    [NOTION_CRM_PROPERTY_NAMES.name]: {
      title: [{ text: { content: input.name.trim().slice(0, 200) } }],
    },
    [NOTION_CRM_PROPERTY_NAMES.status]: {
      select: { name: input.status ?? "Lead" },
    },
    [NOTION_CRM_PROPERTY_NAMES.notes]: {
      rich_text: [{ text: { content: input.notes.trim().slice(0, 1900) } }],
    },
    [NOTION_CRM_PROPERTY_NAMES.dernierContact]: {
      date: { start: input.dernierContactIso ?? new Date().toISOString().slice(0, 10) },
    },
  }

  const siteUrl = input.siteUrl?.trim()
  if (siteUrl) {
    properties[NOTION_CRM_PROPERTY_NAMES.siteUrl] = { url: siteUrl }
  }

  const categorie = input.categorie?.trim()
  if (categorie && NOTION_KNOWN_CATEGORIES.has(categorie)) {
    properties[NOTION_CRM_PROPERTY_NAMES.categorie] = { select: { name: categorie } }
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
      cache: "no-store",
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("[crm/notion-create]", { status: res.status, body: body.slice(0, 500) })
      return { ok: false, error: `notion_http_${res.status}` }
    }

    const page = (await res.json()) as { id?: string; url?: string }
    console.log("[crm/notion-create]", { name: input.name, pageId: page.id, result: "ok" })
    return {
      ok: true,
      notionPageId: page.id ?? "",
      notionUrl: page.url ?? null,
    }
  } catch (e) {
    console.error("[crm/notion-create]", {
      error: e instanceof Error ? e.message : String(e),
      result: "create_failed",
    })
    return { ok: false, error: "create_failed" }
  }
}

export function notionCategoryForEnterprise(category: string): string | null {
  const mapped = ENTERPRISE_CATEGORY_TO_NOTION[category]
  if (mapped && NOTION_KNOWN_CATEGORIES.has(mapped)) return mapped
  return null
}
