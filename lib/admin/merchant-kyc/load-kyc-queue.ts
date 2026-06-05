import {
  MERCHANT_LEGAL_STATUS_CATALOG,
  requiredDocumentsForStatus,
  type MerchantDocumentType,
  type MerchantLegalStatus,
  type MerchantLegalVerificationStatus,
} from "@/lib/merchant-legal/merchant-legal-status-shared"
import { kycDocumentLabel } from "@/lib/admin/merchant-kyc/document-labels"
import type {
  AdminKycDetail,
  AdminKycDocument,
  AdminKycListItem,
  AdminKycQueueResponse,
  AdminKycStats,
} from "@/lib/admin/merchant-kyc/types"
import { prisma } from "@/lib/prisma"

const STATUSES: MerchantLegalVerificationStatus[] = [
  "PENDING_REVIEW",
  "NEEDS_MORE_INFO",
  "REJECTED",
  "APPROVED",
]

function isVerificationStatus(value: string): value is MerchantLegalVerificationStatus {
  return (STATUSES as readonly string[]).includes(value)
}

function serializeDocument(row: {
  id: string
  documentType: string
  fileUrl: string
  fileName: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedAt: Date
}): AdminKycDocument {
  const mime = row.mimeType ?? ""
  const type = row.documentType as MerchantDocumentType
  return {
    id: row.id,
    documentType: type,
    label: kycDocumentLabel(type),
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
    isImage: mime.startsWith("image/"),
    isPdf: mime === "application/pdf" || row.fileUrl.toLowerCase().endsWith(".pdf"),
  }
}

type ProfileRow = {
  id: string
  userId: string
  legalStatus: string
  verificationStatus: string
  legalEntityName: string | null
  tradeName: string | null
  siret: string | null
  vatNumber: string | null
  rnaNumber: string | null
  countryCode: string
  submittedAt: Date
  reviewedAt: Date | null
  rejectionReason: string | null
  user: { email: string; name: string | null; role: string }
  documents: Array<{
    id: string
    documentType: string
    fileUrl: string
    fileName: string | null
    mimeType: string | null
    fileSizeBytes: number | null
    uploadedAt: Date
  }>
  _count?: { documents: number }
}

function serializeListItem(row: ProfileRow): AdminKycListItem {
  return {
    userId: row.userId,
    profileId: row.id,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role,
    legalStatus: row.legalStatus,
    verificationStatus: row.verificationStatus as MerchantLegalVerificationStatus,
    legalEntityName: row.legalEntityName,
    siret: row.siret,
    countryCode: row.countryCode,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    documentCount: row._count?.documents ?? row.documents.length,
  }
}

export async function loadAdminKycStats(): Promise<AdminKycStats> {
  const grouped = await prisma.merchantLegalProfile.groupBy({
    by: ["verificationStatus"],
    _count: { _all: true },
  })
  const map = Object.fromEntries(grouped.map((g) => [g.verificationStatus, g._count._all]))
  return {
    pending: map.PENDING_REVIEW ?? 0,
    needsInfo: map.NEEDS_MORE_INFO ?? 0,
    rejected: map.REJECTED ?? 0,
    approved: map.APPROVED ?? 0,
  }
}

export async function loadAdminKycQueue(
  statusFilter: MerchantLegalVerificationStatus | "all" = "PENDING_REVIEW"
): Promise<AdminKycQueueResponse> {
  const [stats, rows] = await Promise.all([
    loadAdminKycStats(),
    prisma.merchantLegalProfile.findMany({
      where: statusFilter === "all" ? undefined : { verificationStatus: statusFilter },
      orderBy: [{ verificationStatus: "asc" }, { submittedAt: "desc" }],
      take: 80,
      include: {
        user: { select: { email: true, name: true, role: true } },
        _count: { select: { documents: true } },
      },
    }),
  ])

  return {
    stats,
    rows: rows.map((r) => serializeListItem({ ...r, documents: [] })),
  }
}

export async function loadAdminKycDetail(userId: string): Promise<AdminKycDetail | null> {
  const row = await prisma.merchantLegalProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { email: true, name: true, role: true } },
      documents: { orderBy: { uploadedAt: "asc" } },
    },
  })
  if (!row) return null

  const legalStatus = row.legalStatus as MerchantLegalStatus
  const role = row.user.role === "AFFILIATE" ? "AFFILIATE" : "SUPPLIER"
  const required = requiredDocumentsForStatus(legalStatus, role).map((d) => d.type)
  const catalog = MERCHANT_LEGAL_STATUS_CATALOG[legalStatus]

  return {
    ...serializeListItem(row),
    tradeName: row.tradeName,
    vatNumber: row.vatNumber,
    rnaNumber: row.rnaNumber,
    documents: row.documents.map(serializeDocument),
    requiredDocumentTypes: required.length > 0 ? required : catalog.documents.map((d) => d.type),
  }
}

export function parseKycStatusFilter(raw: string | null): MerchantLegalVerificationStatus | "all" {
  if (!raw || raw === "all") return "all"
  return isVerificationStatus(raw) ? raw : "PENDING_REVIEW"
}
