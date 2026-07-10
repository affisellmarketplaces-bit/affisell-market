export type SupplierIntegrationRow = {
  platform: string
  shopDomain?: string | null
  name?: string | null
}

/** True when supplier has an active Shopify integration (banner « Import 10 sec »). */
export function hasShopifyIntegration(integrations: SupplierIntegrationRow[]): boolean {
  return integrations.some(
    (row) =>
      row.platform === "shopify" &&
      Boolean(row.shopDomain?.trim() || row.name?.toLowerCase().includes("shopify"))
  )
}

export function shopifyDomainFromIntegrations(integrations: SupplierIntegrationRow[]): string | null {
  const row = integrations.find((r) => r.platform === "shopify")
  const domain = row?.shopDomain?.trim()
  return domain || null
}
