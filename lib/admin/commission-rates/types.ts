export type CategoryCommissionRow = {
  id: string
  name: string
  fullPath: string
  isLeaf: boolean
  affisellCommissionRateBps: number | null
  effectiveBps: number
  effectivePercent: number
  supplierCommissionRateBps: number | null
  supplierEffectiveBps: number
  supplierEffectivePercent: number
  productCount: number
}
