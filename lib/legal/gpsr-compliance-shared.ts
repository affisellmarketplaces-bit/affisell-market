export type GpsrManufacturerInput = {
  manufacturerName: string
  manufacturerAddress: string
  manufacturerEmail: string
  safetyWarning?: string
  notice?: string
}

export type GpsrComplianceResult = {
  compliant: boolean
  missing: string[]
}

/** Sprint 6B — EU GPSR publish gate (client-safe, no Prisma). */
export function isGpsrCompliant(input: GpsrManufacturerInput): GpsrComplianceResult {
  const missing: string[] = []
  if (!input.manufacturerName.trim()) missing.push("manufacturerName")
  if (!input.manufacturerAddress.trim()) missing.push("manufacturerAddress")
  const email = input.manufacturerEmail.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    missing.push("manufacturerEmail")
  }
  return { compliant: missing.length === 0, missing }
}

export const isCompliant = isGpsrCompliant
