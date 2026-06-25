/** Client-safe merchant legal statuses (supplier / affiliate signup). */
export const MERCHANT_LEGAL_STATUSES = [
  "PARTICULIER",
  "AUTO_ENTREPRENEUR",
  "EI_PROFESSIONAL",
  "COMPANY",
  "ASSOCIATION",
  "FOREIGN",
] as const

export type MerchantLegalStatus = (typeof MERCHANT_LEGAL_STATUSES)[number]

export const MERCHANT_LEGAL_VERIFICATION_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "NEEDS_MORE_INFO",
] as const

export type MerchantLegalVerificationStatus = (typeof MERCHANT_LEGAL_VERIFICATION_STATUSES)[number]

export const MERCHANT_DOCUMENT_TYPES = [
  "IDENTITY_FRONT",
  "IDENTITY_BACK",
  "KBIS_OR_INSEE",
  "SIRET_ATTESTATION",
  "VAT_CERTIFICATE",
  "COMPANY_STATUTES",
  "PROOF_OF_ADDRESS",
  "FOREIGN_REGISTRATION",
  "RNA_RECEIPT",
  "ASSOCIATION_STATUTES",
] as const

export type MerchantDocumentType = (typeof MERCHANT_DOCUMENT_TYPES)[number]

export type MerchantDocumentRequirement = {
  type: MerchantDocumentType
  required: boolean
  hintKey: string
}

export type MerchantLegalStatusMeta = {
  status: MerchantLegalStatus
  titleKey: string
  subtitleKey: string
  icon: "user" | "sparkles" | "briefcase" | "building" | "heart-handshake" | "globe"
  accentClass: string
  fields: Array<"legalEntityName" | "tradeName" | "siret" | "vatNumber" | "rnaNumber">
  documents: MerchantDocumentRequirement[]
}

const BASE_ID: MerchantDocumentRequirement[] = [
  { type: "IDENTITY_FRONT", required: true, hintKey: "docIdentityFront" },
  { type: "IDENTITY_BACK", required: true, hintKey: "docIdentityBack" },
]

/** Per-status KYC matrix (FR marketplace defaults). */
export const MERCHANT_LEGAL_STATUS_CATALOG: Record<MerchantLegalStatus, MerchantLegalStatusMeta> = {
  PARTICULIER: {
    status: "PARTICULIER",
    titleKey: "statusParticulierTitle",
    subtitleKey: "statusParticulierSub",
    icon: "user",
    accentClass: "from-violet-600 to-indigo-600",
    fields: ["legalEntityName"],
    documents: [
      ...BASE_ID,
      { type: "PROOF_OF_ADDRESS", required: true, hintKey: "docProofAddress" },
    ],
  },
  AUTO_ENTREPRENEUR: {
    status: "AUTO_ENTREPRENEUR",
    titleKey: "statusAutoEntrepreneurTitle",
    subtitleKey: "statusAutoEntrepreneurSub",
    icon: "sparkles",
    accentClass: "from-emerald-600 to-teal-600",
    fields: ["legalEntityName", "siret"],
    documents: [
      ...BASE_ID,
      { type: "SIRET_ATTESTATION", required: true, hintKey: "docSiretAttestation" },
      { type: "KBIS_OR_INSEE", required: false, hintKey: "docKbis" },
    ],
  },
  EI_PROFESSIONAL: {
    status: "EI_PROFESSIONAL",
    titleKey: "statusEiTitle",
    subtitleKey: "statusEiSub",
    icon: "briefcase",
    accentClass: "from-sky-600 to-cyan-600",
    fields: ["legalEntityName", "siret", "vatNumber"],
    documents: [
      ...BASE_ID,
      { type: "KBIS_OR_INSEE", required: true, hintKey: "docKbis" },
      { type: "VAT_CERTIFICATE", required: false, hintKey: "docVat" },
    ],
  },
  COMPANY: {
    status: "COMPANY",
    titleKey: "statusCompanyTitle",
    subtitleKey: "statusCompanySub",
    icon: "building",
    accentClass: "from-amber-600 to-orange-600",
    fields: ["legalEntityName", "tradeName", "siret", "vatNumber"],
    documents: [
      { type: "KBIS_OR_INSEE", required: true, hintKey: "docKbis" },
      { type: "COMPANY_STATUTES", required: false, hintKey: "docStatutes" },
      ...BASE_ID,
      { type: "VAT_CERTIFICATE", required: false, hintKey: "docVat" },
    ],
  },
  ASSOCIATION: {
    status: "ASSOCIATION",
    titleKey: "statusAssociationTitle",
    subtitleKey: "statusAssociationSub",
    icon: "heart-handshake",
    accentClass: "from-fuchsia-600 to-pink-600",
    fields: ["legalEntityName", "rnaNumber"],
    documents: [
      { type: "RNA_RECEIPT", required: true, hintKey: "docRna" },
      { type: "ASSOCIATION_STATUTES", required: true, hintKey: "docStatutes" },
      ...BASE_ID,
    ],
  },
  FOREIGN: {
    status: "FOREIGN",
    titleKey: "statusForeignTitle",
    subtitleKey: "statusForeignSub",
    icon: "globe",
    accentClass: "from-rose-600 to-red-600",
    fields: ["legalEntityName", "vatNumber"],
    documents: [
      { type: "FOREIGN_REGISTRATION", required: true, hintKey: "docForeignReg" },
      ...BASE_ID,
      { type: "VAT_CERTIFICATE", required: false, hintKey: "docVat" },
    ],
  },
}

export const BUYER_ACCOUNT_TYPES = ["INDIVIDUAL", "PROFESSIONAL"] as const
export type BuyerAccountType = (typeof BUYER_ACCOUNT_TYPES)[number]

export function isMerchantLegalStatus(value: string): value is MerchantLegalStatus {
  return (MERCHANT_LEGAL_STATUSES as readonly string[]).includes(value)
}

export function isMerchantDocumentType(value: string): value is MerchantDocumentType {
  return (MERCHANT_DOCUMENT_TYPES as readonly string[]).includes(value)
}

/** Identity-only KYC for affiliates (curator role — not seller of record). */
const AFFILIATE_BASE_ID: MerchantDocumentRequirement[] = [
  { type: "IDENTITY_FRONT", required: true, hintKey: "docIdentityFront" },
  { type: "IDENTITY_BACK", required: true, hintKey: "docIdentityBack" },
]

export function signupFieldsForStatus(
  status: MerchantLegalStatus,
  role: "SUPPLIER" | "AFFILIATE"
): MerchantLegalStatusMeta["fields"] {
  const meta = MERCHANT_LEGAL_STATUS_CATALOG[status]
  if (role === "SUPPLIER") return meta.fields
  return meta.fields.filter((f) => f === "legalEntityName" || f === "tradeName")
}

export function requiredDocumentsForStatus(
  status: MerchantLegalStatus,
  role: "SUPPLIER" | "AFFILIATE"
): MerchantDocumentRequirement[] {
  if (role === "AFFILIATE") {
    return AFFILIATE_BASE_ID
  }
  const meta = MERCHANT_LEGAL_STATUS_CATALOG[status]
  return meta.documents.filter((d) => d.required)
}

export function allDocumentsForStatus(status: MerchantLegalStatus): MerchantDocumentRequirement[] {
  return MERCHANT_LEGAL_STATUS_CATALOG[status].documents
}

/** Documents shown and validated at signup — lighter matrix for affiliates. */
export function documentsForSignup(
  status: MerchantLegalStatus,
  role: "SUPPLIER" | "AFFILIATE"
): MerchantDocumentRequirement[] {
  if (role === "AFFILIATE") {
    return AFFILIATE_BASE_ID
  }
  return allDocumentsForStatus(status)
}
