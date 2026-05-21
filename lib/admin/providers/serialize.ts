import type { FulfillmentProvider } from "@prisma/client"

import { readProviderMetadata } from "@/lib/admin/providers/metadata"

export type ProviderListRow = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  displayStatus: "ACTIVE" | "INACTIVE" | "ERROR"
  paymentMethod: string
  lastHealthCheck: string | null
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

  let displayStatus: ProviderListRow["displayStatus"] = "INACTIVE"
  if (meta.healthStatus === "ERROR") displayStatus = "ERROR"
  else if (row.status === "ACTIVE") displayStatus = "ACTIVE"

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.channelType,
    status: row.status,
    displayStatus,
    paymentMethod: row.paymentMethod,
    lastHealthCheck: meta.lastHealthCheckAt ?? null,
    hasCredentials: Boolean(row.credentialsEncrypted),
    apiEndpoint: endpoint,
  }
}
