export type AdminTermsLogRow = {
  id: string
  userId: string
  email: string
  type: string
  version: string
  ip: string
  userAgent: string
  createdAt: string
}

export const TERMS_LOGS_CSV_COLUMNS = [
  "userId",
  "email",
  "type",
  "version",
  "ip",
  "userAgent",
  "createdAt",
] as const

export const TERMS_LOGS_CSV_FILENAME = "affisell-terms-acceptance-logs.csv"
