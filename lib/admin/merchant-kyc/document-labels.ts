import type { MerchantDocumentType } from "@/lib/merchant-legal/merchant-legal-status-shared"

/** Labels admin — pièces officielles attendues. */
export const KYC_DOCUMENT_LABELS: Record<MerchantDocumentType, string> = {
  IDENTITY_FRONT: "Pièce d'identité — recto",
  IDENTITY_BACK: "Pièce d'identité — verso",
  KBIS_OR_INSEE: "Kbis / avis INSEE",
  SIRET_ATTESTATION: "Attestation SIRET / URSSAF",
  VAT_CERTIFICATE: "Attestation TVA",
  COMPANY_STATUTES: "Statuts / PV nomination",
  PROOF_OF_ADDRESS: "Justificatif de domicile",
  FOREIGN_REGISTRATION: "Immatriculation étrangère",
  RNA_RECEIPT: "Récepissé RNA",
  ASSOCIATION_STATUTES: "Statuts association",
}

export function kycDocumentLabel(type: MerchantDocumentType): string {
  return KYC_DOCUMENT_LABELS[type] ?? type
}
