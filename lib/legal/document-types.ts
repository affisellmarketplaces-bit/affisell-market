export type LegalDocumentType =
  | "cgv"
  | "cgu"
  | "mentions"
  | "contrat_fournisseur"
  | "cgv_supplier"

export type GeneratedLegalDocument = {
  markdown: string
  html: string
  title: string
}

export type CgvInput = {
  companyName: string
  marketplaceName: string
}

export type MentionsInput = {
  companyName: string
  siret: string
  adresse: string
}

export type ContratFournisseurInput = {
  supplierName: string
  commission: number
  companyName?: string
}
