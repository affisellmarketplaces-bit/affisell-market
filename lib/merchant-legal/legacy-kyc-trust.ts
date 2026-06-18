/** Grandfather merchants registered before mandatory admin KYC review for publish. */

const DEFAULT_MANDATORY_FROM = "2026-06-19T00:00:00.000Z"

export function resolveMerchantKycMandatoryFrom(): Date {
  const raw = process.env.MERCHANT_KYC_MANDATORY_FROM?.trim()
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date(DEFAULT_MANDATORY_FROM)
}

export function isMerchantKycTrustExistingEnabled(): boolean {
  const raw = process.env.MERCHANT_KYC_TRUST_EXISTING?.trim().toLowerCase()
  if (raw === "0" || raw === "false") return false
  if (raw === "1" || raw === "true") return true
  return true
}

export function isLegacyRegisteredMerchantForKyc(args: {
  role: string
  createdAt: Date
  verificationStatus: string | null
}): boolean {
  if (!isMerchantKycTrustExistingEnabled()) return false
  if (args.role !== "SUPPLIER" && args.role !== "AFFILIATE") return false
  if (args.verificationStatus === "REJECTED") return false
  return args.createdAt < resolveMerchantKycMandatoryFrom()
}
