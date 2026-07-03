import {
  buildNotionLeadCreateProperties,
  detectNotionCrmSchema,
  mapCrmAffisellStatus,
  normalizeNotionDatabaseId,
  type NotionCrmSchemaKind,
  type NotionLeadCreateInput,
} from "@/lib/crm/notion-crm-schema"
import {
  isSupplierPipelineStatus,
  type SupplierPipelineStatus,
} from "@/lib/crm/supplier-pipeline-status"
import type { SupplierPipelineNotionConfig, SupplierPipelineRow } from "@/lib/crm/supplier-pipeline-types"

const NOTION_VERSION = "2022-06-28"

/** Noms de propriétés Notion — template « Suppliers Pipeline » (legacy doc). */
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

type NotionRichText = { plain_text?: string }
type NotionPage = {
  id: string
  url?: string
  properties: Record<string, unknown>
}

type NotionCredentials = {
  token: string
  databaseId: string
}

type SchemaCacheEntry = {
  schema: NotionCrmSchemaKind
  titleProperty: string
  fetchedAt: number
}

const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000
let schemaCache: { databaseId: string; entry: SchemaCacheEntry } | null = null

function resolveNotionCredentials(): NotionCredentials | null {
  const token = process.env.NOTION_API_KEY?.trim()
  const databaseId = normalizeNotionDatabaseId(process.env.NOTION_CRM_DATABASE_ID)
  if (!token || !databaseId) return null
  return { token, databaseId }
}

export function getSupplierPipelineNotionConfig(): SupplierPipelineNotionConfig {
  const creds = resolveNotionCredentials()
  return {
    configured: Boolean(creds),
    databaseId: creds?.databaseId ?? null,
  }
}

async function fetchNotionDatabaseSchema(creds: NotionCredentials): Promise<
  | { ok: true; schema: NotionCrmSchemaKind; titleProperty: string }
  | { ok: false; error: string }
> {
  const cached = schemaCache
  if (
    cached &&
    cached.databaseId === creds.databaseId &&
    Date.now() - cached.entry.fetchedAt < SCHEMA_CACHE_TTL_MS
  ) {
    return {
      ok: true,
      schema: cached.entry.schema,
      titleProperty: cached.entry.titleProperty,
    }
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${creds.databaseId}`, {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Notion-Version": NOTION_VERSION,
      },
      cache: "no-store",
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("[crm/notion-schema]", { status: res.status, body: body.slice(0, 500) })
      return { ok: false, error: `notion_http_${res.status}` }
    }

    const data = (await res.json()) as { properties?: Record<string, { type?: string }> }
    const properties = data.properties ?? {}
    const schema = detectNotionCrmSchema(properties)
    const titleProperty = schema === "crm_affisell" ? "Nom" : NOTION_CRM_PROPERTY_NAMES.name

    schemaCache = {
      databaseId: creds.databaseId,
      entry: { schema, titleProperty, fetchedAt: Date.now() },
    }

    console.log("[crm/notion-schema]", { schema, titleProperty, result: "ok" })
    return { ok: true, schema, titleProperty }
  } catch (e) {
    console.error("[crm/notion-schema]", {
      error: e instanceof Error ? e.message : String(e),
      result: "schema_fetch_failed",
    })
    return { ok: false, error: "schema_fetch_failed" }
  }
}

export async function fetchSupplierPipelineFromNotion(): Promise<{
  rows: SupplierPipelineRow[]
  error: string | null
}> {
  const creds = resolveNotionCredentials()
  if (!creds) {
    return { rows: [], error: "not_configured" }
  }

  const schemaResult = await fetchNotionDatabaseSchema(creds)
  if (!schemaResult.ok) {
    return { rows: [], error: schemaResult.error }
  }

  const { schema, titleProperty } = schemaResult
  const rows: SupplierPipelineRow[] = []
  let cursor: string | undefined

  try {
    do {
      const res = await fetch(`https://api.notion.com/v1/databases/${creds.databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
          sorts: [{ property: titleProperty, direction: "ascending" }],
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
        const row = parseNotionPage(page, schema)
        if (row) rows.push(row)
      }

      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (cursor)

    console.log("[crm/notion]", { rows: rows.length, schema, result: "ok" })
    return { rows, error: null }
  } catch (e) {
    console.error("[crm/notion]", {
      error: e instanceof Error ? e.message : String(e),
      result: "fetch_failed",
    })
    return { rows: [], error: "fetch_failed" }
  }
}

function parseNotionPage(page: NotionPage, schema: NotionCrmSchemaKind): SupplierPipelineRow | null {
  const props = page.properties

  if (schema === "crm_affisell") {
    const name = readTitle(props.Nom)
    if (!name) return null

    const supplierId = readRichText(props.SupplierId)
    const email = readEmail(props["E-mail"])
    const statusRaw = readStatusOrSelect(props.Status)
    const status = mapCrmAffisellStatus(statusRaw, supplierId)
    const noteParts = [supplierId, email ? `E-mail: ${email}` : null].filter(Boolean)

    return {
      id: page.id,
      name,
      siteUrl: null,
      siret: null,
      categorie: null,
      telegram: null,
      status,
      dernierContact: readDate(props.Date),
      notes: noteParts.length > 0 ? noteParts.join("\n") : null,
      notionUrl: page.url ?? null,
    }
  }

  const name = readTitle(props[NOTION_CRM_PROPERTY_NAMES.name])
  if (!name) return null

  const statusRaw = readStatusOrSelect(props[NOTION_CRM_PROPERTY_NAMES.status])
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

function readEmail(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as { type?: string; email?: string | null }
  if (p.type !== "email") return null
  return p.email?.trim().toLowerCase() || null
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

function readStatusOrSelect(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null
  const p = prop as {
    type?: string
    select?: { name?: string } | null
    status?: { name?: string } | null
  }
  if (p.type === "select") return p.select?.name?.trim() || null
  if (p.type === "status") return p.status?.name?.trim() || null
  return null
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

export type CreateSupplierPipelineLeadInput = NotionLeadCreateInput

/** Idempotent-safe create — duplicate brand names become separate rows (founder merges in Notion). */
export async function createSupplierPipelineLeadInNotion(
  input: CreateSupplierPipelineLeadInput
): Promise<{ ok: true; notionPageId: string; notionUrl: string | null } | { ok: false; error: string }> {
  const creds = resolveNotionCredentials()
  if (!creds) {
    return { ok: false, error: "not_configured" }
  }

  const schemaResult = await fetchNotionDatabaseSchema(creds)
  if (!schemaResult.ok) {
    return { ok: false, error: schemaResult.error }
  }

  const properties = buildNotionLeadCreateProperties(schemaResult.schema, input)

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: creds.databaseId },
        properties,
      }),
      cache: "no-store",
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("[crm/notion-create]", {
        status: res.status,
        schema: schemaResult.schema,
        body: body.slice(0, 500),
      })
      return { ok: false, error: `notion_http_${res.status}` }
    }

    const page = (await res.json()) as { id?: string; url?: string }
    console.log("[crm/notion-create]", {
      name: input.name,
      pageId: page.id,
      schema: schemaResult.schema,
      result: "ok",
    })
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
