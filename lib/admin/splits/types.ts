import type { TransferRole, TransferStatus } from "@prisma/client"

export const SPLIT_DISPLAY_STATUSES = ["SUCCESS", "PARTIAL", "FAILED", "PENDING"] as const
export type SplitDisplayStatus = (typeof SPLIT_DISPLAY_STATUSES)[number]

export type SplitTransferCell = {
  role: TransferRole
  amountCents: number
  status: TransferStatus
  errorCode: string | null
  destination: string
  stripeTransferId: string | null
  attempts: number
}

export type AdminSplitRow = {
  orderId: string
  orderNumber: string
  createdAt: string
  totalCents: number
  affisellFeeCents: number
  splitStatus: SplitDisplayStatus
  supplier: SplitTransferCell | null
  affiliate: SplitTransferCell | null
  needsOnboarding: boolean
  onboardingAccountId: string | null
}

export type LoadAdminSplitsOptions = {
  from?: Date
  to?: Date
  status?: SplitDisplayStatus | "all"
  take?: number
}
