import type { GoogleConnector, MarketplaceConnector, Region } from "@/lib/radar/connectors/types"

function stubAuthUrl(connectorId: string): (userId: string) => string {
  return () => `/radar/connect?error=coming_soon&connectorId=${encodeURIComponent(connectorId)}`
}

export const MARKETPLACE_CONNECTORS: MarketplaceConnector[] = [
  {
    id: "tiktok_shop",
    name: "TikTok Shop",
    logo: "🛍️",
    category: "marketplace",
    region: "GLOBAL",
    authType: "oauth",
    getAuthUrl: (userId: string) =>
      `/api/radar/tiktok/start?userId=${encodeURIComponent(userId)}`,
  },
  {
    id: "amazon",
    name: "Amazon",
    logo: "🅰️",
    category: "marketplace",
    region: "EU",
    authType: "sp_api",
    getAuthUrl: (userId: string) =>
      `/api/radar/amazon/start?userId=${encodeURIComponent(userId)}`,
  },
  {
    id: "mercadolibre",
    name: "MercadoLibre",
    logo: "🟡",
    category: "marketplace",
    region: "SA",
    authType: "oauth",
    getAuthUrl: stubAuthUrl("mercadolibre"),
  },
  {
    id: "walmart",
    name: "Walmart",
    logo: "🔵",
    category: "marketplace",
    region: "NA",
    authType: "api_key",
    getAuthUrl: stubAuthUrl("walmart"),
  },
  {
    id: "shopee",
    name: "Shopee",
    logo: "🟠",
    category: "marketplace",
    region: "SEA",
    authType: "oauth",
    getAuthUrl: stubAuthUrl("shopee"),
  },
  {
    id: "jumia",
    name: "Jumia",
    logo: "⚫",
    category: "marketplace",
    region: "AFRICA",
    authType: "api_key",
    getAuthUrl: stubAuthUrl("jumia"),
  },
  {
    id: "noon",
    name: "Noon",
    logo: "🟡",
    category: "marketplace",
    region: "MENA",
    authType: "api_key",
    getAuthUrl: stubAuthUrl("noon"),
  },
  {
    id: "allegro",
    name: "Allegro",
    logo: "🟠",
    category: "marketplace",
    region: "EU",
    authType: "oauth",
    getAuthUrl: stubAuthUrl("allegro"),
  },
]

export const GOOGLE_CONNECTORS: GoogleConnector[] = [
  {
    id: "google_merchant",
    name: "Google Merchant Center",
    logo: "🛒",
    category: "google",
    region: "GLOBAL",
    authType: "oauth",
    scopes: ["https://www.googleapis.com/auth/content"],
    getAuthUrl: (userId: string) =>
      `/api/radar/google/merchant/start?userId=${encodeURIComponent(userId)}`,
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    logo: "🔍",
    category: "google",
    region: "GLOBAL",
    authType: "oauth",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    getAuthUrl: stubAuthUrl("google_search_console"),
  },
  {
    id: "google_trends",
    name: "Google Trends",
    logo: "📈",
    category: "google",
    region: "GLOBAL",
    authType: "oauth",
    getAuthUrl: stubAuthUrl("google_trends"),
  },
]

/** Client-safe list — keep server-only connectors out of this module. */
export const LIVE_CONNECTOR_IDS = new Set(["tiktok_shop", "amazon", "google_merchant"])

export function getConnectorById(id: string) {
  return (
    MARKETPLACE_CONNECTORS.find((c) => c.id === id) ??
    GOOGLE_CONNECTORS.find((c) => c.id === id) ??
    null
  )
}

export function isConnectorLive(id: string): boolean {
  return LIVE_CONNECTOR_IDS.has(id)
}

export const REGION_LABELS: Record<Region, string> = {
  GLOBAL: "Global",
  EU: "Europe",
  NA: "Amérique du Nord",
  SA: "Amérique latine",
  MENA: "MENA",
  AFRICA: "Afrique",
  SEA: "Asie du Sud-Est",
  EAST_ASIA: "Asie de l'Est",
}

export const REGION_FLAGS: Partial<Record<Region, string>> = {
  GLOBAL: "🌍",
  EU: "🇪🇺",
  NA: "🇺🇸",
  SA: "🇧🇷",
  MENA: "🇦🇪",
  AFRICA: "🌍",
  SEA: "🇸🇬",
  EAST_ASIA: "🇯🇵",
}

export function groupMarketplacesByRegion(): Map<Region, typeof MARKETPLACE_CONNECTORS> {
  const map = new Map<Region, typeof MARKETPLACE_CONNECTORS>()
  for (const c of MARKETPLACE_CONNECTORS) {
    const list = map.get(c.region) ?? []
    list.push(c)
    map.set(c.region, list)
  }
  return map
}
