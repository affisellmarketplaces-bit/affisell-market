export const AUTO_BUY_ENLIST_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const

export type AutoBuyEnlistStatus = (typeof AUTO_BUY_ENLIST_STATUSES)[number]

export type AutoBuyEnlistRequestDto = {
  id: string
  supplierId: string
  supplierEmail: string | null
  supplierName: string | null
  aeUrl: string
  aeProductId: string
  nameHint: string | null
  note: string | null
  wholesalePriceCents: number | null
  status: AutoBuyEnlistStatus
  rejectionReason: string | null
  productId: string | null
  reviewedAt: string | null
  createdAt: string
}
