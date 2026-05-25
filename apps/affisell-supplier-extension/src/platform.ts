export type ImportPlatform =
  | "aliexpress"
  | "amazon"
  | "shopify"
  | "shein"
  | "temu"
  | "universal"
  | "unsupported"

export function detectPlatform(url: string): ImportPlatform {
  const u = url.toLowerCase()
  if (!u.startsWith("http")) return "unsupported"
  if (u.includes("aliexpress.com") || u.includes("aliexpress.us")) return "aliexpress"
  if (u.includes("amazon.")) return "amazon"
  if (u.includes("/products/") || u.includes("myshopify.com")) return "shopify"
  if (u.includes("shein.com")) return "shein"
  if (u.includes("temu.com")) return "temu"
  if (u.startsWith("http")) return "universal"
  return "unsupported"
}

/** Extract AliExpress product id from URL or bare id. */
export function parseAliExpressProductId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const fromItemPath = raw.match(/item\/(\d{13,})/i)?.[1]
  if (fromItemPath) return fromItemPath
  const compact = raw.replace(/\s/g, "")
  if (/^\d{13,}$/.test(compact)) return compact
  if (raw.includes("aliexpress")) {
    const embedded = raw.match(/(\d{13,})/)?.[1]
    if (embedded) return embedded
  }
  return null
}

export function platformLabel(p: ImportPlatform): string {
  switch (p) {
    case "aliexpress":
      return "AliExpress (API)"
    case "amazon":
      return "Amazon"
    case "shopify":
      return "Shopify"
    case "shein":
      return "Shein"
    case "temu":
      return "Temu"
    case "universal":
      return "Boutique web"
    default:
      return "Page non supportée"
  }
}
