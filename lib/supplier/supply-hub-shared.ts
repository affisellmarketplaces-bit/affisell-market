import type { SupplierChannelType } from "@prisma/client"

/** UI status for a supply connector (read-only Supply Hub). */
export type SupplyConnectorUiStatus =
  | "live"
  | "connected"
  | "setup"
  | "roadmap"
  | "native"

export type SupplyCapabilityKey = "catalog" | "orders" | "negotiate" | "packaging"

export type SupplyCapabilityState = "live" | "beta" | "soon" | "off"

/** Display-only channels without a Prisma enum value (no DB rows). */
export type SupplyHubVirtualChannel = "ALIBABA_1688"

export type SupplyHubChannelDef = {
  channelType: SupplierChannelType | SupplyHubVirtualChannel
  /** i18n key under supplierDashboard.supplyHub.channels.{key} */
  labelKey: string
  phase: 1 | 2 | 3
  capabilities: Record<SupplyCapabilityKey, SupplyCapabilityState>
  /** Primary CTA route when applicable */
  href?: string
}

export const SUPPLY_HUB_CHANNEL_DEFS: SupplyHubChannelDef[] = [
  {
    channelType: "AFFISELL_NATIVE",
    labelKey: "native",
    phase: 1,
    capabilities: {
      catalog: "live",
      orders: "live",
      negotiate: "off",
      packaging: "beta",
    },
    href: "/dashboard/supplier/products/new",
  },
  {
    channelType: "ALIEXPRESS",
    labelKey: "aliexpress",
    phase: 1,
    capabilities: {
      catalog: "live",
      orders: "beta",
      negotiate: "off",
      packaging: "soon",
    },
    href: "/dashboard/supplier/import",
  },
  {
    channelType: "ALIBABA_1688",
    labelKey: "alibaba1688",
    phase: 1,
    capabilities: {
      catalog: "live",
      orders: "off",
      negotiate: "off",
      packaging: "off",
    },
    // assist=1 affiche les panneaux d’import (dont « Import depuis URL » / 1688)
    href: "/dashboard/supplier/products/new?assist=1&compose=1#add-product-shortcuts",
  },
  {
    channelType: "BLIND_REST",
    labelKey: "factory",
    phase: 1,
    capabilities: {
      catalog: "beta",
      orders: "beta",
      negotiate: "beta",
      packaging: "beta",
    },
    href: "/dashboard/supplier/integrations",
  },
  {
    channelType: "BIGBUY",
    labelKey: "bigbuy",
    phase: 2,
    capabilities: {
      catalog: "soon",
      orders: "soon",
      negotiate: "off",
      packaging: "soon",
    },
  },
  {
    channelType: "CJ_DROPSHIPPING",
    labelKey: "cj",
    phase: 2,
    capabilities: {
      catalog: "soon",
      orders: "soon",
      negotiate: "off",
      packaging: "off",
    },
  },
  {
    channelType: "AMAZON",
    labelKey: "amazon",
    phase: 3,
    capabilities: {
      catalog: "soon",
      orders: "off",
      negotiate: "off",
      packaging: "off",
    },
  },
  {
    channelType: "MANUAL",
    labelKey: "manual",
    phase: 1,
    capabilities: {
      catalog: "live",
      orders: "live",
      negotiate: "off",
      packaging: "off",
    },
    href: "/dashboard/supplier/orders",
  },
]

export type SupplyHubConnectorSnapshot = {
  channelType: SupplierChannelType | SupplyHubVirtualChannel
  labelKey: string
  uiStatus: SupplyConnectorUiStatus
  phase: 1 | 2 | 3
  capabilities: Record<SupplyCapabilityKey, SupplyCapabilityState>
  href?: string
  stats?: {
    linkedSkus?: number
    autoBuySkus?: number
    webhookIntegrations?: number
    hasRestEndpoint?: boolean
  }
  hintKey?: string
}

export type SupplyHubSnapshot = {
  connectors: SupplyHubConnectorSnapshot[]
  totals: {
    catalogSkus: number
    autoBuySkus: number
    platformSyncEnabled: number
  }
  platformAliExpressConfigured: boolean
}

export function resolveAliExpressUiStatus(args: {
  platformConfigured: boolean
  linkedSkus: number
  autoBuySkus: number
}): SupplyConnectorUiStatus {
  if (!args.platformConfigured) {
    return args.linkedSkus > 0 ? "setup" : "roadmap"
  }
  if (args.autoBuySkus > 0) return "connected"
  if (args.linkedSkus > 0) return "connected"
  return "setup"
}

export function resolveBlindRestUiStatus(args: {
  hasRestEndpoint: boolean
  linkedSkus: number
}): SupplyConnectorUiStatus {
  if (args.hasRestEndpoint && args.linkedSkus > 0) return "connected"
  if (args.hasRestEndpoint) return "setup"
  return "roadmap"
}
