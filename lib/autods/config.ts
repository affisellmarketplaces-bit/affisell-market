export type AutoDsConfig = {
  apiKey: string
  createOrderUrl: string
  storeId: number
  storeName: string
  buySiteId: string
  supplier: number
  region: number
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

/** True when AutoDS order API can be called. */
export function isAutoDsConfigured(): boolean {
  return Boolean(process.env.AUTODS_API_KEY?.trim())
}

export function getAutoDsConfig(): AutoDsConfig | null {
  const apiKey = process.env.AUTODS_API_KEY?.trim()
  if (!apiKey) return null

  const base = (process.env.AUTODS_API_BASE_URL?.trim() || "https://gw.autods.com").replace(/\/$/, "")
  const path =
    process.env.AUTODS_CREATE_ORDER_PATH?.trim() || "/auto-order/order/create-external"
  const legacyPath = process.env.AUTODS_ORDERS_PATH?.trim()
  const createOrderUrl = legacyPath
    ? `${(process.env.AUTODS_API_BASE_URL?.trim() || "https://api.autods.com/v1").replace(/\/$/, "")}${legacyPath.startsWith("/") ? legacyPath : `/${legacyPath}`}`
    : `${base}${path.startsWith("/") ? path : `/${path}`}`

  return {
    apiKey,
    createOrderUrl,
    storeId: readInt("AUTODS_STORE_ID", 0),
    storeName: process.env.AUTODS_STORE_NAME?.trim() || "Affisell",
    buySiteId: process.env.AUTODS_BUY_SITE_ID?.trim() || "Amazon",
    supplier: readInt("AUTODS_SUPPLIER", 23),
    region: readInt("AUTODS_REGION", 4),
  }
}

export function assertAutoDsStoreConfigured(config: AutoDsConfig): void {
  if (config.storeId <= 0) {
    throw new Error("AUTODS_STORE_ID is required for AutoDS order creation")
  }
}
