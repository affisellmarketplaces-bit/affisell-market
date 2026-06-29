import { EU_WITHDRAWAL_DAYS } from "@/lib/buyer-withdrawal-window"
import { legalPlatformFeeLabels } from "@/lib/legal/fee-labels"
import { PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM } from "@/lib/order-payout-policy"

/** DAC7 / directive reporting thresholds (EU platform operators). */
export const SUPPLIER_DAC7_EUR_THRESHOLD = 2000
export const SUPPLIER_DAC7_TRANSACTION_THRESHOLD = 30

/** Rolling return-rate watch — contractual reserve on Connect balance. */
export const SUPPLIER_RETURN_RATE_PROVISION_THRESHOLD_PCT = 2
export const SUPPLIER_RETURN_RATE_PROVISION_RESERVE_PCT = 15

/** Illustrative payout walkthrough (pedagogical — not a quote). */
export const SUPPLIER_PAYOUT_EXAMPLE = {
  clientPaidTtcCents: 10_000,
  affisellKeepsCents: 1500,
  stripeFeeCents: 150,
  supplierNetBeforeVatTimingCents: 8500,
} as const

export const supplierBecomeFinanceFacts = {
  catalogPlatformFeeLabel: legalPlatformFeeLabels.supplierCatalog,
  payoutDaysAfterDelivery: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
  euWithdrawalDays: EU_WITHDRAWAL_DAYS,
  dac7EurThreshold: SUPPLIER_DAC7_EUR_THRESHOLD,
  dac7TxThreshold: SUPPLIER_DAC7_TRANSACTION_THRESHOLD,
  returnProvisionThresholdPct: SUPPLIER_RETURN_RATE_PROVISION_THRESHOLD_PCT,
  returnProvisionReservePct: SUPPLIER_RETURN_RATE_PROVISION_RESERVE_PCT,
} as const
