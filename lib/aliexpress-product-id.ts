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
 * Handles trailing junk after paste (e.g. "...html e").
 */
export function parseAliExpressProductId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const fromItemPath = raw.match(/item\/(\d{13,})/i)?.[1]
  if (fromItemPath) return fromItemPath

  const compact = raw.replace(/\s/g, "")
  if (/^\d{13,}$/.test(compact)) return compact

  if (isAliExpressImportInput(raw)) {
    const embedded = raw.match(/(\d{13,})/)?.[1]
    if (embedded) return embedded
  }

  return null
}
