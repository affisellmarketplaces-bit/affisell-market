import { headers } from "next/headers"

import { SupplierIntegrationsHub } from "@/components/supplier/supplier-integrations-hub"
import { hasEncryptionKey } from "@/lib/encryption"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { maskIntegrationConfig } from "@/lib/supplier-integration-config"
import {
  integrationLiveConnected,
  loadSupplierIntegrationsForUser,
  parseIntegrationSyncSummary,
} from "@/lib/supplier/load-supplier-integrations"

export const dynamic = "force-dynamic"

function shopifyOAuthConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_API_KEY?.trim() &&
      process.env.SHOPIFY_API_SECRET?.trim() &&
      (process.env.SHOPIFY_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim())
  )
}

export default async function SupplierIntegrationsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/integrations")

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (host ? `${proto}://${host}` : "")

  let rows: Awaited<ReturnType<typeof loadSupplierIntegrationsForUser>>["rows"] = []
  let schemaMode: "live" | "legacy" = "live"
  let loadError: string | null = null

  try {
    const loaded = await loadSupplierIntegrationsForUser(session.user.id)
    rows = loaded.rows
    schemaMode = loaded.schemaMode
  } catch (e) {
    loadError =
      e instanceof Error
        ? e.message
        : "Could not load integrations — check database connection and retry."
    console.error("[supplier-integrations/page]", {
      userId: session.user.id,
      result: "page_degraded",
      error: loadError,
    })
  }

  const initialIntegrations = rows.map((r) => {
    const config = maskIntegrationConfig(r.config)
    return {
      id: r.id,
      platform: r.platform,
      name: r.name,
      enabled: r.enabled,
      config,
      shopDomain: "shopDomain" in r ? r.shopDomain : null,
      status: "status" in r ? r.status : null,
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      lastSyncError: r.lastSyncError,
      syncStats: parseIntegrationSyncSummary(r.lastSyncSummary),
      inboundUrl:
        r.platform === "webhook" && base ? `${base}/api/integrations/inbound/${r.id}` : null,
      liveConnected: integrationLiveConnected({
        platform: r.platform,
        enabled: r.enabled,
        status: "status" in r ? r.status : null,
        config: r.config,
        shopDomain: "shopDomain" in r ? r.shopDomain : null,
      }),
    }
  })

  return (
    <SupplierIntegrationsHub
      initialIntegrations={initialIntegrations}
      schemaMode={schemaMode}
      loadError={loadError}
      shopifyOAuthConfigured={shopifyOAuthConfigured()}
      encryptionConfigured={hasEncryptionKey()}
    />
  )
}
