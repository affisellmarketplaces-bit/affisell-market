import { COMMISSION_RATE } from "@/lib/commission"
import { formatFeeBpsPercent } from "@/lib/marketplace-fee-display"
import {
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"
import { PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM } from "@/lib/order-payout-policy"

/** Libellés frais alignés sur `marketplace-phase1-fees` (source unique pour pages légales). */
export const legalPlatformFeeLabels = {
  supplierCatalog: formatFeeBpsPercent(DEFAULT_SUPPLIER_FEE_BPS_CATALOG),
  supplierAutoBuy: formatFeeBpsPercent(DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY),
  affiliateEarnings: formatFeeBpsPercent(DEFAULT_AFFILIATE_PLATFORM_FEE_BPS),
  legacyOrderHtPercent: `${Math.round(COMMISSION_RATE * 100)} %`,
  payoutDaysAfterBuyerConfirm: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
} as const
