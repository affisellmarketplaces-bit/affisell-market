export type LegalIssueSeverity = "low" | "medium" | "high" | "critical"

export type LegalIssue = {
  code: string
  severity: LegalIssueSeverity
  message: string
}

export type LegalScanRow = {
  id: string
  type: string
  targetId: string
  targetName: string
  riskScore: number
  issues: LegalIssue[]
  status: string
  createdAt: string
  updatedAt: string
  /** Fournisseur lié pour génération de lettre */
  supplierIdForLetter?: string | null
}

export type LegalScanStats = {
  productsScanned: number
  suppliersScanned: number
  scansWritten: number
  highRiskCount: number
  openAiUsed: boolean
}

export type LegalFixChange = {
  field: string
  before: string
  after: string
  reason: string
}

export type LegalFixPreview = {
  ok: boolean
  original: {
    title: string
    description: string
    descriptionBullets: string[]
    tags: string[]
    compareAt: number | null
    isOnSale: boolean
  }
  fixed: {
    title: string
    description: string
    descriptionBullets: string[]
    tags: string[]
    clearCompareAt: boolean
  }
  changes: LegalFixChange[]
}

export type LegalLetterSummary = {
  id: string
  supplierId: string
  supplierName: string
  scanId: string | null
  type: string
  status: string
  createdAt: string
  preview: string
  viewUrl: string
}
