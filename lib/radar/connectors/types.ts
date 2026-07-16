export type Region =
  | "EU"
  | "NA"
  | "SA"
  | "MENA"
  | "AFRICA"
  | "SEA"
  | "EAST_ASIA"
  | "GLOBAL"

export type Category = "marketplace" | "google"

export type AuthType = "oauth" | "api_key" | "sp_api"

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
}

export interface GoogleConnector extends BaseConnector {
  category: "google"
  region: "GLOBAL"
}
