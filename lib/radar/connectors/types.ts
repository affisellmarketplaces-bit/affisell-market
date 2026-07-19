export type Region =
  | "EU"
  | "NA"
  | "SA"
  | "MENA"
  | "AFRICA"
  | "SEA"
  | "EAST_ASIA"
  | "SOUTH_ASIA"
  | "OCEANIA"
  | "GLOBAL"

export type Category = "marketplace" | "google"

export type AuthType = "oauth" | "api_key" | "sp_api"

export type RadarConnectorProduct = {
  id: string
  title: string
  price?: number
  currency?: string
  imageUrl?: string
  url?: string
  marketplaceId: string
}

export interface BaseConnector {
  id: string
  name: string
  logo: string
  category: Category
  region: Region
  authType: AuthType
  scopes?: string[]
  /** Live connectors implement this; stubs throw or return coming-soon path. */
  getAuthUrl(userId: string): string
}

export interface MarketplaceConnector extends BaseConnector {
  category: "marketplace"
  /** Optional — live connectors (Amazon SP-API, …) fetch catalog/listings. */
  getProducts?(
    accessToken: string,
    opts?: { marketplaceIds?: string[]; keywords?: string; sellerId?: string }
  ): Promise<RadarConnectorProduct[]>
}

export interface GoogleConnector extends BaseConnector {
  category: "google"
  region: "GLOBAL"
  getProducts?(
    accessToken: string,
    opts?: { merchantId?: string }
  ): Promise<RadarConnectorProduct[]>
}
