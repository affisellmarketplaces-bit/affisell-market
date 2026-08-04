/** True when input looks like an AliExpress product URL or numeric product id. */
export function isAliExpressImportInput(input: string): boolean {
  const raw = input.trim().toLowerCase()
  if (!raw) return false
  if (raw.includes("aliexpress.com") || raw.includes("aliexpress.us")) return true
  const compact = raw.replace(/\s/g, "")
  return /^\d{13,}$/.test(compact)
}

/**
 * Extract AliExpress product id (13+ digits) from URL or bare id.
 * Handles trailing junk after paste (e.g. "...html e") and tracking URLs
 * with `_p_origin_prod:…` / `productId=` embeds.
 */
export function parseAliExpressProductId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const fromItemPath = raw.match(/item\/(\d{13,})/i)?.[1]
  if (fromItemPath) return fromItemPath

  const fromQuery =
    raw.match(/[?&#](?:product[_-]?id|item[_-]?id)=(\d{13,})/i)?.[1] ||
    raw.match(/_p_origin_prod[=:](\d{13,})/i)?.[1] ||
    raw.match(/origin_prod[=:%3A]+(\d{13,})/i)?.[1]
  if (fromQuery) return fromQuery

  try {
    const decoded = decodeURIComponent(raw)
    if (decoded !== raw) {
      const nested = parseAliExpressProductId(decoded)
      if (nested) return nested
    }
  } catch {
    /* ignore malformed URI */
  }

  const compact = raw.replace(/\s/g, "")
  if (/^\d{13,}$/.test(compact)) return compact

  if (isAliExpressImportInput(raw)) {
    const embedded = raw.match(/(\d{13,})/)?.[1]
    if (embedded) return embedded
  }

  return null
}
