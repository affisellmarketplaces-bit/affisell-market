/** Client-safe store public URL shape (matches GET /api/store/me → storeUrls). */

export type StorePublicUrls = {
  primaryUrl: string
  subdomainUrl: string
  platformPathUrl: string
  customDomainUrl: string | null
  subdomainSslActive: boolean
  /**
   * Why the auto subdomain is (not) the primary address: "active" = a visitor can open it over HTTPS;
   * "unreachable" = it is configured but a real TLS handshake fails (see store-subdomain-reachability);
   * "pending" = still being set up.
   */
  subdomainState: "active" | "unreachable" | "pending"
}
