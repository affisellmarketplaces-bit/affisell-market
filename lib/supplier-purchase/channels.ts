import type { SupplierChannelType } from "@prisma/client"

import type { SupplierPurchaseChannel } from "@/lib/supplier-purchase/policy"

/**
 * Which purchase channel a fulfilment provider's adapter buys through. null = the adapter places no external,
 * paying order (Affisell native suppliers fulfil themselves, MANUAL is an e-mail, stub channels only log) — those
 * are not supplier purchases and stay outside the policy, unless the engine also PAYS them (supplier_payment).
 */
export function purchaseChannelForProviderType(
  type: SupplierChannelType | string | null | undefined,
): SupplierPurchaseChannel | null {
  switch (type) {
    case "ALIEXPRESS":
      return "aliexpress"
    case "CJ_DROPSHIPPING":
      return "cj"
    case "BLIND_REST":
      return "partner_rest"
    default:
      return null
  }
}
