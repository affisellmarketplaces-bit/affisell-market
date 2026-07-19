import type { GoogleConnector, MarketplaceConnector, Region } from "@/lib/radar/connectors/types"

function stubAuthUrl(connectorId: string): (userId: string) => string {
  return () => `/radar/connect?error=coming_soon&connectorId=${encodeURIComponent(connectorId)}`
}

function stubMarketplace(
  partial: Omit<MarketplaceConnector, "category" | "getAuthUrl" | "authType"> & {
    authType?: MarketplaceConnector["authType"]
  }
): MarketplaceConnector {
  return {
    ...partial,
    category: "marketplace",
    authType: partial.authType ?? "oauth",
    getAuthUrl: stubAuthUrl(partial.id),
  }
}

/**
 * Affisell Radar marketplace registry — live OAuth first, then major world markets (stubs).
 * UI groups by region on /radar/connect.
 */
export const MARKETPLACE_CONNECTORS: MarketplaceConnector[] = [
  // —— Global ——
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
  stubMarketplace({ id: "shopify", name: "Shopify", logo: "🟩", region: "GLOBAL", authType: "api_key" }),
  stubMarketplace({ id: "ebay", name: "eBay", logo: "🏷️", region: "GLOBAL" }),
  stubMarketplace({ id: "aliexpress", name: "AliExpress", logo: "🧡", region: "GLOBAL" }),
  stubMarketplace({ id: "temu", name: "Temu", logo: "🟧", region: "GLOBAL" }),
  stubMarketplace({ id: "etsy", name: "Etsy", logo: "🧶", region: "GLOBAL" }),

  // —— Europe ——
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
  stubMarketplace({ id: "allegro", name: "Allegro", logo: "🟠", region: "EU" }),
  stubMarketplace({ id: "zalando", name: "Zalando", logo: "🟧", region: "EU" }),
  stubMarketplace({ id: "otto", name: "OTTO", logo: "🟤", region: "EU" }),
  stubMarketplace({ id: "bol", name: "Bol.com", logo: "🔵", region: "EU" }),
  stubMarketplace({ id: "cdiscount", name: "Cdiscount", logo: "🟡", region: "EU" }),
  stubMarketplace({ id: "fnac", name: "Fnac", logo: "🟨", region: "EU" }),
  stubMarketplace({ id: "vinted", name: "Vinted", logo: "💚", region: "EU" }),
  stubMarketplace({ id: "manomano", name: "ManoMano", logo: "🔧", region: "EU" }),
  stubMarketplace({ id: "wildberries", name: "Wildberries", logo: "🟣", region: "EU" }),
  stubMarketplace({ id: "ozon", name: "Ozon", logo: "🔵", region: "EU" }),

  // —— North America ——
  stubMarketplace({ id: "amazon_na", name: "Amazon US", logo: "🅰️", region: "NA", authType: "sp_api" }),
  stubMarketplace({ id: "walmart", name: "Walmart", logo: "🔵", region: "NA", authType: "api_key" }),
  stubMarketplace({ id: "target", name: "Target", logo: "🔴", region: "NA", authType: "api_key" }),
  stubMarketplace({ id: "bestbuy", name: "Best Buy", logo: "⬛", region: "NA", authType: "api_key" }),
  stubMarketplace({ id: "wayfair", name: "Wayfair", logo: "🪑", region: "NA" }),
  stubMarketplace({ id: "newegg", name: "Newegg", logo: "🥚", region: "NA" }),
  stubMarketplace({ id: "ebay_na", name: "eBay US", logo: "🏷️", region: "NA" }),

  // —— Latin America ——
  stubMarketplace({ id: "mercadolibre", name: "Mercado Libre", logo: "🟡", region: "SA" }),
  stubMarketplace({ id: "magalu", name: "Magazine Luiza", logo: "💙", region: "SA" }),
  stubMarketplace({ id: "americanas", name: "Americanas", logo: "❤️", region: "SA" }),
  stubMarketplace({ id: "falabella", name: "Falabella", logo: "🟩", region: "SA" }),
  stubMarketplace({ id: "linio", name: "Linio", logo: "🟠", region: "SA" }),
  stubMarketplace({ id: "amazon_br", name: "Amazon BR", logo: "🅰️", region: "SA", authType: "sp_api" }),
  stubMarketplace({ id: "amazon_mx", name: "Amazon MX", logo: "🅰️", region: "SA", authType: "sp_api" }),
  stubMarketplace({ id: "shopee_br", name: "Shopee BR", logo: "🟠", region: "SA" }),

  // —— MENA ——
  stubMarketplace({ id: "noon", name: "Noon", logo: "🟡", region: "MENA", authType: "api_key" }),
  stubMarketplace({ id: "trendyol", name: "Trendyol", logo: "🟧", region: "MENA" }),
  stubMarketplace({ id: "amazon_ae", name: "Amazon.ae", logo: "🅰️", region: "MENA", authType: "sp_api" }),
  stubMarketplace({ id: "amazon_sa", name: "Amazon.sa", logo: "🅰️", region: "MENA", authType: "sp_api" }),
  stubMarketplace({ id: "namshi", name: "Namshi", logo: "👗", region: "MENA" }),
  stubMarketplace({ id: "jarir", name: "Jarir", logo: "📘", region: "MENA", authType: "api_key" }),

  // —— Africa ——
  stubMarketplace({ id: "jumia", name: "Jumia", logo: "⚫", region: "AFRICA", authType: "api_key" }),
  stubMarketplace({ id: "konga", name: "Konga", logo: "🟢", region: "AFRICA", authType: "api_key" }),
  stubMarketplace({ id: "takealot", name: "Takealot", logo: "🔵", region: "AFRICA", authType: "api_key" }),
  stubMarketplace({ id: "kilimall", name: "Kilimall", logo: "🟧", region: "AFRICA" }),
  stubMarketplace({ id: "amazon_eg", name: "Amazon Egypt", logo: "🅰️", region: "AFRICA", authType: "sp_api" }),

  // —— South Asia ——
  stubMarketplace({ id: "flipkart", name: "Flipkart", logo: "🔵", region: "SOUTH_ASIA" }),
  stubMarketplace({ id: "amazon_in", name: "Amazon IN", logo: "🅰️", region: "SOUTH_ASIA", authType: "sp_api" }),
  stubMarketplace({ id: "meesho", name: "Meesho", logo: "🩷", region: "SOUTH_ASIA" }),
  stubMarketplace({ id: "myntra", name: "Myntra", logo: "👗", region: "SOUTH_ASIA" }),
  stubMarketplace({ id: "snapdeal", name: "Snapdeal", logo: "🟠", region: "SOUTH_ASIA" }),

  // —— Southeast Asia ——
  stubMarketplace({ id: "shopee", name: "Shopee", logo: "🟠", region: "SEA" }),
  stubMarketplace({ id: "lazada", name: "Lazada", logo: "🔴", region: "SEA" }),
  stubMarketplace({ id: "tokopedia", name: "Tokopedia", logo: "🟢", region: "SEA" }),
  stubMarketplace({ id: "bukalapak", name: "Bukalapak", logo: "❤️", region: "SEA" }),
  stubMarketplace({ id: "tiki", name: "Tiki", logo: "🟦", region: "SEA" }),
  stubMarketplace({ id: "qoo10", name: "Qoo10", logo: "🔟", region: "SEA" }),

  // —— East Asia ——
  stubMarketplace({ id: "rakuten", name: "Rakuten", logo: "🟥", region: "EAST_ASIA" }),
  stubMarketplace({ id: "yahoo_shopping_jp", name: "Yahoo Shopping JP", logo: "🟣", region: "EAST_ASIA" }),
  stubMarketplace({ id: "coupang", name: "Coupang", logo: "🔵", region: "EAST_ASIA" }),
  stubMarketplace({ id: "gmarket", name: "Gmarket", logo: "🟢", region: "EAST_ASIA" }),
  stubMarketplace({ id: "tmall", name: "Tmall", logo: "🐱", region: "EAST_ASIA" }),
  stubMarketplace({ id: "jd", name: "JD.com", logo: "🐕", region: "EAST_ASIA" }),
  stubMarketplace({ id: "taobao", name: "Taobao", logo: "🧡", region: "EAST_ASIA" }),
  stubMarketplace({ id: "pinduoduo", name: "Pinduoduo", logo: "🔴", region: "EAST_ASIA" }),

  // —— Oceania ——
  stubMarketplace({ id: "amazon_au", name: "Amazon AU", logo: "🅰️", region: "OCEANIA", authType: "sp_api" }),
  stubMarketplace({ id: "catch", name: "Catch", logo: "🎣", region: "OCEANIA" }),
  stubMarketplace({ id: "kogan", name: "Kogan", logo: "🟪", region: "OCEANIA" }),
  stubMarketplace({ id: "the_market", name: "The Market", logo: "🥝", region: "OCEANIA" }),
  stubMarketplace({ id: "trademe", name: "Trade Me", logo: "🟢", region: "OCEANIA" }),
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

/** Stable continent order for /radar/connect. */
export const REGION_ORDER: Region[] = [
  "GLOBAL",
  "EU",
  "NA",
  "SA",
  "MENA",
  "AFRICA",
  "SOUTH_ASIA",
  "SEA",
  "EAST_ASIA",
  "OCEANIA",
]

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
  MENA: "Moyen-Orient & Afrique du Nord",
  AFRICA: "Afrique",
  SOUTH_ASIA: "Asie du Sud",
  SEA: "Asie du Sud-Est",
  EAST_ASIA: "Asie de l'Est",
  OCEANIA: "Océanie",
}

export const REGION_FLAGS: Record<Region, string> = {
  GLOBAL: "🌍",
  EU: "🇪🇺",
  NA: "🇺🇸",
  SA: "🇧🇷",
  MENA: "🇦🇪",
  AFRICA: "🌍",
  SOUTH_ASIA: "🇮🇳",
  SEA: "🇸🇬",
  EAST_ASIA: "🇯🇵",
  OCEANIA: "🇦🇺",
}

export function groupMarketplacesByRegion(): Map<Region, MarketplaceConnector[]> {
  const byRegion = new Map<Region, MarketplaceConnector[]>()
  for (const c of MARKETPLACE_CONNECTORS) {
    const list = byRegion.get(c.region) ?? []
    list.push(c)
    byRegion.set(c.region, list)
  }

  const ordered = new Map<Region, MarketplaceConnector[]>()
  for (const region of REGION_ORDER) {
    const list = byRegion.get(region)
    if (list && list.length > 0) ordered.set(region, list)
  }
  return ordered
}
