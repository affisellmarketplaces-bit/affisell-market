import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const LIVE_SELECT = {
  id: true,
  platform: true,
  name: true,
  enabled: true,
  config: true,
  shopDomain: true,
  provider: true,
  status: true,
  scopes: true,
  webhookId: true,
  errorMessage: true,
  lastSyncAt: true,
  lastSyncError: true,
  lastSyncSummary: true,
  updatedAt: true,
} as const

const LEGACY_SELECT = {
  id: true,
  platform: true,
  name: true,
  enabled: true,
  config: true,
  lastSyncAt: true,
  lastSyncError: true,
  lastSyncSummary: true,
  updatedAt: true,
} as const

export type SupplierIntegrationRow = Prisma.SupplierIntegrationGetPayload<{
  select: typeof LIVE_SELECT
}>

function isSchemaDriftError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (err.code === "P2022") return true
  const msg = err.message
  return (
    msg.includes("shopDomain") ||
    msg.includes("IntegrationStatus") ||
    msg.includes("SupplierWebhookEvent") ||
    msg.includes("does not exist")
  )
}

function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    const msg = err instanceof Error ? err.message : String(err)
    return msg.includes("Can't reach database") || msg.includes("Connection")
  }
  return err.code === "P1001" || err.code === "P1002" || err.code === "P1017"
}

function loadLiveIntegrations(userId: string): Promise<SupplierIntegrationRow[]> {
  return prisma.supplierIntegration.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: LIVE_SELECT,
  })
}

function loadLegacyIntegrations(userId: string): Promise<SupplierIntegrationRow[]> {
  return prisma.supplierIntegration.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: LEGACY_SELECT,
  }) as Promise<SupplierIntegrationRow[]>
}

/** Resilient integrations load — legacy schema fallback + one retry on Neon blips. */
export async function loadSupplierIntegrationsForUser(
  userId: string
): Promise<{ rows: SupplierIntegrationRow[]; schemaMode: "live" | "legacy" }> {
  try {
    const rows = await loadLiveIntegrations(userId)
    return { rows, schemaMode: "live" }
  } catch (first) {
    if (isSchemaDriftError(first)) {
      console.warn("[supplier-integrations]", {
        userId,
        result: "legacy_schema_fallback",
        hint: "npx prisma migrate deploy",
      })
      const rows = await loadLegacyIntegrations(userId)
      return { rows, schemaMode: "legacy" }
    }

    if (isTransientDbError(first)) {
      await new Promise((r) => setTimeout(r, 120))
      try {
        const rows = await loadLiveIntegrations(userId)
        return { rows, schemaMode: "live" }
      } catch (retry) {
        if (isSchemaDriftError(retry)) {
          const rows = await loadLegacyIntegrations(userId)
          return { rows, schemaMode: "legacy" }
        }
        throw retry
      }
    }

    console.error("[supplier-integrations]", {
      userId,
      result: "load_failed",
      error: first instanceof Error ? first.message : String(first),
    })
    throw first
  }
}

export type IntegrationSyncStats = {
  fetched: number
  created: number
  updated: number
  skipped: number
  unpublished: number
}

export function parseIntegrationSyncSummary(summary: unknown): IntegrationSyncStats | null {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null
  const s = summary as Record<string, unknown>
  const num = (k: string) => {
    const v = Number(s[k])
    return Number.isFinite(v) ? v : 0
  }
  if (!Number.isFinite(Number(s.fetched)) && !Number.isFinite(Number(s.created))) return null
  return {
    fetched: num("fetched"),
    created: num("created"),
    updated: num("updated"),
    skipped: num("skipped"),
    unpublished: num("unpublished"),
  }
}

export function integrationLiveConnected(row: {
  platform: string
  enabled: boolean
  status?: string | null
  config: unknown
  shopDomain?: string | null
  accessTokenEncrypted?: string | null
}): boolean {
  if (!row.enabled) return false
  if (row.status === "DISCONNECTED") return false

  if (row.platform === "shopify") {
    if (row.status === "CONNECTED") return true
    const cfg =
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : null
    return Boolean(cfg?.oauth || row.shopDomain)
  }

  if (row.platform === "woocommerce") {
    if (row.status === "CONNECTED") return true
    return Boolean(row.accessTokenEncrypted && row.shopDomain)
  }

  return false
}
