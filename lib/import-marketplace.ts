import type { ImportPlatform } from "@/lib/import-url-scrape"

/** User-facing marketplace id (paste any supported product URL). */
export type MarketplaceId =
  | "aliexpress"
  | "alibaba"
  | "amazon"
  | "ebay"
  | "etsy"
  | "cdiscount"
  | "temu"
  | "shein"
  | "tiktok"
  | "shopify"
  | "woocommerce"
  | "walmart"
  | "1688"
  | "cj"
  | "bigbuy"
  | "other"

export type DetectedMarketplace = {
  id: MarketplaceId
  label: string
  host: string
  /** Scraper routing (existing import-url pipeline). */
  scrapePlatform: ImportPlatform
  /** Prefer official AliExpress API when configured. */
  preferAliExpressApi: boolean
}

const HOST_RULES: Array<{ id: MarketplaceId; label: string; test: RegExp }> = [
  { id: "aliexpress", label: "AliExpress", test: /aliexpress\.(com|us)/i },
  { id: "alibaba", label: "Alibaba", test: /alibaba\.com/i },
  { id: "amazon", label: "Amazon", test: /amazon\.|amzn\.to/i },
  { id: "ebay", label: "eBay", test: /ebay\.|ebaydesc\./i },
  { id: "etsy", label: "Etsy", test: /etsy\.com/i },
  { id: "cdiscount", label: "Cdiscount", test: /cdiscount\.com/i },
  { id: "temu", label: "Temu", test: /temu\.com/i },
  { id: "shein", label: "SHEIN", test: /shein\.com/i },
  { id: "tiktok", label: "TikTok Shop", test: /tiktok\.com|shop\.tiktok/i },
  { id: "walmart", label: "Walmart", test: /walmart\.com/i },
  /**
   * Domain-specific rules before shopify/woocommerce below: both of those match on a generic
   * `/product(s)?/` path fragment, which cjdropshipping.com and bigbuy.eu URLs also contain —
   * checked first here so they aren't misdetected as a generic Shopify/WooCommerce store.
   */
  { id: "1688", label: "1688", test: /1688\.com/i },
  { id: "cj", label: "CJ Dropshipping", test: /cjdropshipping\.com/i },
  { id: "bigbuy", label: "BigBuy", test: /bigbuy\.eu/i },
  { id: "shopify", label: "Shopify", test: /myshopify\.com|\/products\//i },
  { id: "woocommerce", label: "WooCommerce", test: /\/product\//i },
]

function scrapePlatformFor(id: MarketplaceId): ImportPlatform {
  switch (id) {
    case "aliexpress":
      return "aliexpress"
    case "amazon":
      return "amazon"
    case "shopify":
      return "shopify"
    case "shein":
      return "shein"
    case "temu":
      return "temu"
    case "1688":
      return "1688"
    case "cj":
      return "cj"
    case "bigbuy":
      return "bigbuy"
    default:
      return "universal"
  }
}

/** Detect marketplace from a pasted product URL (no network). */
export function detectMarketplaceFromUrl(rawUrl: string): DetectedMarketplace {
  const url = rawUrl.trim()
  let host = ""
  try {
    host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    host = url.toLowerCase()
  }

  for (const rule of HOST_RULES) {
    if (rule.test.test(host) || rule.test.test(url)) {
      return {
        id: rule.id,
        label: rule.label,
        host,
        scrapePlatform: scrapePlatformFor(rule.id),
        preferAliExpressApi: rule.id === "aliexpress",
      }
    }
  }

  return {
    id: "other",
    label: "Boutique en ligne",
    host: host || "unknown",
    scrapePlatform: "universal",
    preferAliExpressApi: false,
  }
}

export const SUPPORTED_MARKETPLACE_LABELS = HOST_RULES.map((r) => r.label).join(", ")
