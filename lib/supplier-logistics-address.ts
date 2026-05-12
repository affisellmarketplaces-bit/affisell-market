/** Structured warehouse / return address stored on `Store.shipFromAddress` & `Store.returnAddress` (JSON). */
export type SupplierLogisticsAddress = {
  company?: string
  line1: string
  line2?: string
  city: string
  region?: string
  postalCode: string
  /** ISO 3166-1 alpha-2, uppercased */
  countryCode: string
  phone?: string
}

export function parseSupplierLogisticsAddress(raw: unknown): SupplierLogisticsAddress | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const line1 = typeof o.line1 === "string" ? o.line1.trim() : ""
  const city = typeof o.city === "string" ? o.city.trim() : ""
  const postalCode = typeof o.postalCode === "string" ? o.postalCode.trim() : ""
  const ccRaw = typeof o.countryCode === "string" ? o.countryCode.trim().toUpperCase() : ""
  const countryCode = ccRaw.slice(0, 2)
  if (!line1 || !city || !postalCode || countryCode.length !== 2) return null
  const company = typeof o.company === "string" ? o.company.trim().slice(0, 120) : ""
  const line2 = typeof o.line2 === "string" ? o.line2.trim().slice(0, 120) : ""
  const region = typeof o.region === "string" ? o.region.trim().slice(0, 80) : ""
  const phone = typeof o.phone === "string" ? o.phone.trim().slice(0, 40) : ""
  return {
    ...(company ? { company } : {}),
    line1: line1.slice(0, 200),
    ...(line2 ? { line2 } : {}),
    city: city.slice(0, 120),
    ...(region ? { region } : {}),
    postalCode: postalCode.slice(0, 32),
    countryCode,
    ...(phone ? { phone } : {}),
  }
}

export function logisticsAddressFromFormBody(
  raw: unknown
): Partial<Record<keyof SupplierLogisticsAddress, string>> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const pick = (k: keyof SupplierLogisticsAddress) =>
    typeof o[k] === "string" ? (o[k] as string).trim() : ""
  return {
    company: pick("company"),
    line1: pick("line1"),
    line2: pick("line2"),
    city: pick("city"),
    region: pick("region"),
    postalCode: pick("postalCode"),
    countryCode: pick("countryCode").toUpperCase().slice(0, 2),
    phone: pick("phone"),
  }
}

export function buildLogisticsAddressFromPartial(
  p: Partial<Record<keyof SupplierLogisticsAddress, string>>
): SupplierLogisticsAddress | null {
  return parseSupplierLogisticsAddress({
    company: p.company,
    line1: p.line1,
    line2: p.line2,
    city: p.city,
    region: p.region,
    postalCode: p.postalCode,
    countryCode: p.countryCode,
    phone: p.phone,
  })
}

/** Multi-line label / email block */
export function formatSupplierLogisticsAddress(a: SupplierLogisticsAddress): string {
  const lines: string[] = []
  if (a.company) lines.push(a.company)
  lines.push(a.line1)
  if (a.line2) lines.push(a.line2)
  const cityLine = [a.postalCode, a.city].filter(Boolean).join(" ")
  const tail = [cityLine, a.region].filter(Boolean).join(", ")
  if (tail) lines.push(tail)
  lines.push(a.countryCode)
  if (a.phone) lines.push(`Tel: ${a.phone}`)
  return lines.join("\n")
}

export function effectiveReturnAddress(
  shipFrom: SupplierLogisticsAddress | null,
  returnOnly: SupplierLogisticsAddress | null
): SupplierLogisticsAddress | null {
  return returnOnly ?? shipFrom
}
