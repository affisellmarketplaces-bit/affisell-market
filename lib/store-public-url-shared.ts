/** Client-safe store public URL shape (matches GET /api/store/me → storeUrls). */

export type StorePublicUrls = {
  primaryUrl: string
  subdomainUrl: string
  platformPathUrl: string
  customDomainUrl: string | null
  subdomainSslActive: boolean
}
