import {
  isMerchantDocumentType,
  isMerchantLegalStatus,
  MERCHANT_LEGAL_STATUS_CATALOG,
  requiredDocumentsForStatus,
  type MerchantDocumentType,
  type MerchantLegalStatus,
} from "@/lib/merchant-legal/merchant-legal-status-shared"

export type SignupDraftDocument = {
  documentType: string
  fileUrl: string
}

export type MerchantSignupFields = {
  legalStatus: string
  legalEntityName?: string | null
  tradeName?: string | null
  siret?: string | null
  vatNumber?: string | null
  rnaNumber?: string | null
  countryCode?: string | null
}

function normalizeSiret(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const digits = raw.replace(/\D/g, "")
  if (digits.length !== 14) return null
  return digits
}

function normalizeRna(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const cleaned = raw.replace(/\s/g, "").toUpperCase()
  if (cleaned.length < 8) return null
  return cleaned.slice(0, 20)
}

export function validateMerchantSignupPayload(
  role: "SUPPLIER" | "AFFILIATE",
  fields: MerchantSignupFields,
  drafts: SignupDraftDocument[]
): { ok: true; data: {
  legalStatus: MerchantLegalStatus
  legalEntityName: string | null
  tradeName: string | null
  siret: string | null
  vatNumber: string | null
  rnaNumber: string | null
  countryCode: string
  documents: Array<{ documentType: MerchantDocumentType; fileUrl: string }>
} } | { ok: false; error: string } {
  const statusRaw = fields.legalStatus?.trim() ?? ""
  if (!isMerchantLegalStatus(statusRaw)) {
    return { ok: false, error: "invalid_legal_status" }
  }
  const legalStatus = statusRaw
  const meta = MERCHANT_LEGAL_STATUS_CATALOG[legalStatus]

  const legalEntityName = fields.legalEntityName?.trim().slice(0, 160) || null
  const tradeName = fields.tradeName?.trim().slice(0, 160) || null
  const siret = normalizeSiret(fields.siret)
  const vatNumber = fields.vatNumber?.trim().slice(0, 32) || null
  const rnaNumber = normalizeRna(fields.rnaNumber)
  const countryCode = (fields.countryCode?.trim().toUpperCase().slice(0, 2) || "FR") as string

  if (meta.fields.includes("legalEntityName") && !legalEntityName) {
    return { ok: false, error: "legal_entity_name_required" }
  }
  if (meta.fields.includes("siret") && !siret) {
    return { ok: false, error: "siret_required" }
  }
  if (meta.fields.includes("rnaNumber") && !rnaNumber) {
    return { ok: false, error: "rna_required" }
  }

  const required = requiredDocumentsForStatus(legalStatus, role)
  const uploaded = new Map<string, string>()
  for (const d of drafts) {
    if (!isMerchantDocumentType(d.documentType)) continue
    if (!d.fileUrl?.trim()) continue
    uploaded.set(d.documentType, d.fileUrl.trim())
  }

  for (const req of required) {
    if (!uploaded.has(req.type)) {
      return { ok: false, error: `missing_document:${req.type}` }
    }
  }

  const documents = [...uploaded.entries()].map(([documentType, fileUrl]) => ({
    documentType: documentType as MerchantDocumentType,
    fileUrl,
  }))

  return {
    ok: true,
    data: {
      legalStatus,
      legalEntityName,
      tradeName,
      siret,
      vatNumber,
      rnaNumber,
      countryCode,
      documents,
    },
  }
}
