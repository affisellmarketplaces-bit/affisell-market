import type { MerchantDocumentType, MerchantLegalVerificationStatus } from "@/lib/merchant-legal/merchant-legal-status-shared"

export type AdminKycListItem = {
  userId: string
  profileId: string
  email: string
  name: string | null
  role: string
  legalStatus: string
  verificationStatus: MerchantLegalVerificationStatus
  legalEntityName: string | null
  siret: string | null
  countryCode: string
  submittedAt: string
  reviewedAt: string | null
  rejectionReason: string | null
  documentCount: number
}

export type AdminKycDocument = {
  id: string
  documentType: MerchantDocumentType
  label: string
  fileUrl: string
  fileName: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedAt: string
  isImage: boolean
  isPdf: boolean
}

export type AdminKycDetail = AdminKycListItem & {
  tradeName: string | null
  vatNumber: string | null
  rnaNumber: string | null
  documents: AdminKycDocument[]
  requiredDocumentTypes: MerchantDocumentType[]
}

export type AdminKycStats = {
  pending: number
  needsInfo: number
  rejected: number
  approved: number
}

export type AdminKycQueueResponse = {
  stats: AdminKycStats
  rows: AdminKycListItem[]
}
