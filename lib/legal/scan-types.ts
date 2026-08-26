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
}

export type LegalScanStats = {
  productsScanned: number
  suppliersScanned: number
  scansWritten: number
  highRiskCount: number
  openAiUsed: boolean
}
