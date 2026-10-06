/**
 * Which kind of storefront a merchant has — one pure function, no React, no network.
 *
 *   • "vitrine" — hosted on Affisell (`{slug}.shops.affisell.com`, `/shops/{slug}`): ready with zero setup.
 *   • "brand"   — served on the merchant's OWN domain, with HTTPS, under their name.
 *
 * "brand" means the domain is actually serving buyers, not merely typed in: the routing layer only rewrites a custom host
 * once its DNS is verified, and a verified host without a certificate cannot be opened over HTTPS. Everything before that
 * is still a vitrine — with the progress toward brand made explicit, so the merchant knows exactly where they are.
 */

export type StorefrontMode = "vitrine" | "brand"

/** Where the custom domain is in its lifecycle. `live` is the only stage that makes the store a brand store. */
export type BrandDomainStage = "none" | "dns_pending" | "ssl_pending" | "ssl_failed" | "live"

export type BrandStepId = "domain" | "dns" | "https"

export type StorefrontModeInput = {
  customDomain?: string | null
  /** The CNAME has been checked and points at Affisell. */
  domainVerified?: boolean | null
  /** Vercel registration / certificate state: registered | pending | active | failed | skipped. */
  vercelDomainStatus?: string | null
  /** false when certificates are not managed automatically (then DNS verification is all there is). */
  vercelAutoProvision?: boolean | null
}

export type StorefrontModeInfo = {
  mode: StorefrontMode
  stage: BrandDomainStage
  domain: string | null
  steps: { id: BrandStepId; done: boolean; current: boolean }[]
}

/** Window event the domain card fires after a save / verify, so every status display refreshes without a reload. */
export const STORE_DOMAIN_CHANGED_EVENT = "affisell:store-domain-changed"

function cleanDomain(raw: string | null | undefined): string | null {
  const d = (raw ?? "").trim().toLowerCase()
  return d.length > 0 ? d : null
}

export function deriveBrandDomainStage(input: StorefrontModeInput): BrandDomainStage {
  if (!cleanDomain(input.customDomain)) return "none"
  if (!input.domainVerified) return "dns_pending"
  if (input.vercelAutoProvision === false) return "live"

  const status = (input.vercelDomainStatus ?? "").toLowerCase()
  if (status === "active" || status === "skipped") return "live"
  if (status === "failed") return "ssl_failed"
  return "ssl_pending"
}

export function deriveStorefrontMode(input: StorefrontModeInput): StorefrontModeInfo {
  const stage = deriveBrandDomainStage(input)
  const done: Record<BrandStepId, boolean> = {
    domain: stage !== "none",
    dns: stage === "ssl_pending" || stage === "ssl_failed" || stage === "live",
    https: stage === "live",
  }
  const order: BrandStepId[] = ["domain", "dns", "https"]
  const firstOpen = order.find((id) => !done[id])
  return {
    mode: stage === "live" ? "brand" : "vitrine",
    stage,
    domain: cleanDomain(input.customDomain),
    steps: order.map((id) => ({ id, done: done[id], current: id === firstOpen })),
  }
}

/** `https://shop.example.com/` → `shop.example.com`; keeps a path for platform URLs (`affisell.com/shops/slug`). */
export function displayStoreAddress(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, "")
    return `${u.host}${path}`
  } catch {
    return url
  }
}
