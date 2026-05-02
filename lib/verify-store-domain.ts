import * as dns from "node:dns/promises"

function normalizeHostname(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.replace(/\.$/, "")
  if (!s || !/^[a-z0-9.-]+$/.test(s) || s.length > 253) return null
  return s
}

/**
 * Checks if host has a CNAME chain pointing at `expectedTarget`
 * (e.g. shopper's domain → cname.affisell.com).
 */
export async function customDomainPointsToAffisell(
  customDomainRaw: string,
  expectedTarget: string
): Promise<boolean> {
  const host = normalizeHostname(customDomainRaw)
  const target = normalizeHostname(expectedTarget)
  if (!host || !target) return false
  try {
    const chain = await dns.resolveCname(host)
    const norm = chain.map((c) => normalizeHostname(c) ?? "").filter(Boolean)
    return norm.some((c) => c === target || c.endsWith(`.${target}`))
  } catch {
    return false
  }
}

export function normalizeCustomDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const host = normalizeHostname(raw)
  return host ?? null
}
