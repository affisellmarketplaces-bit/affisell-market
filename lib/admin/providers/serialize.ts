import type { FulfillmentProvider } from "@prisma/client"

import { readProviderMetadata } from "@/lib/admin/providers/metadata"

export type ProviderListRow = {
  id: string
  name: string
  slug: string
  type: string
  /** Health / lifecycle badge: ACTIVE | INACTIVE | ERROR */
  status: "ACTIVE" | "INACTIVE" | "ERROR"
  lifecycleStatus: string
  paymentMethod: string
  lastHealthCheck: string | null
  latencyMs: number | null
  hasCredentials: boolean
  apiEndpoint: string | null
}

export function toProviderListRow(row: FulfillmentProvider): ProviderListRow {
  const meta = readProviderMetadata(row.metadata)
  const apiConfig =
    row.apiConfig && typeof row.apiConfig === "object" && !Array.isArray(row.apiConfig)
      ? (row.apiConfig as Record<string, unknown>)
      : {}
  const endpoint =
    typeof apiConfig.apiEndpoint === "string"
      ? apiConfig.apiEndpoint
      : typeof apiConfig.endpoint === "string"
        ? apiConfig.endpoint
        : null

  let status: ProviderListRow["status"] = "INACTIVE"
  if (meta.healthStatus === "ERROR") status = "ERROR"
  else if (row.status === "ACTIVE") status = "ACTIVE"

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.channelType,
    status,
    lifecycleStatus: row.status,
    paymentMethod: row.paymentMethod,
    lastHealthCheck: meta.lastHealthCheckAt ?? null,
    latencyMs:
      typeof meta.latencyMs === "number" && Number.isFinite(meta.latencyMs)
        ? Math.round(meta.latencyMs)
        : null,
    hasCredentials: Boolean(row.credentialsEncrypted),
    apiEndpoint: endpoint,
  }
}
