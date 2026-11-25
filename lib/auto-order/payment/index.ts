import type { FulfillmentPaymentMethod } from "@prisma/client"
import { autoOrderLegKey, isLegPaid } from "@/lib/payouts/leg-model"
import { executeLegTransfer } from "@/lib/payouts/leg-transfer.server"
import { prisma } from "@/lib/prisma"
import type { SupplierGroup } from "@/lib/auto-order/types"

export type PaymentResult = {
  ok: boolean
  reference?: string
  error?: string
}

export async function executeSupplierPayment(args: {
  method: FulfillmentPaymentMethod
  providerId: string
  batchId: string
  group: SupplierGroup
}): Promise<PaymentResult> {
  switch (args.method) {
    case "NONE":
    case "INVOICE_NET30":
      return { ok: true, reference: "no_payment_required" }
    case "WALLET_PREPAID":
      return payFromWallet(args)
    case "STRIPE_CONNECT":
      return payStripeConnect(args)
    case "STRIPE_ISSUING":
      return {
        ok: false,
        error: "STRIPE_ISSUING not configured — enable in v1.1",
      }
    default:
      return { ok: true, reference: "skipped" }
  }
}

async function payFromWallet(args: {
  providerId: string
  group: SupplierGroup
}): Promise<PaymentResult> {
  const cost = args.group.totalCostCents
  if (cost < 1) return { ok: true, reference: "zero_cost" }

  const updated = await prisma.fulfillmentProvider.updateMany({
    where: { id: args.providerId, walletBalanceCents: { gte: cost } },
    data: { walletBalanceCents: { decrement: cost } },
  })
  if (updated.count !== 1) {
    return { ok: false, error: "insufficient_wallet_balance" }
  }
  return { ok: true, reference: `wallet-${args.providerId}-${cost}` }
}

async function payStripeConnect(args: {
  providerId: string
  batchId: string
  group: SupplierGroup
}): Promise<PaymentResult> {
  if (process.env.AUTO_ORDER_ENABLE_STRIPE_TRANSFERS !== "true") {
    return { ok: false, error: "stripe_transfers_disabled" }
  }

  const provider = await prisma.fulfillmentProvider.findUnique({
    where: { id: args.providerId },
    select: { stripeConnectAccountId: true },
  })
  const dest = provider?.stripeConnectAccountId?.trim()
  if (!dest) return { ok: false, error: "missing_stripe_connect_account" }

  const amount = args.group.totalCostCents
  if (amount < 1) return { ok: true, reference: "zero_transfer" }

  // One leg of the payout leg registry per (batch × provider): a retried batch never pays the provider twice.
  const leg = await executeLegTransfer({
    legKey: autoOrderLegKey(args.batchId, args.providerId),
    kind: "auto_order",
    role: "AUTO_ORDER_PROVIDER",
    rail: "auto_order",
    orderId: null,
    transferGroup: `auto_order_${args.batchId}`,
    params: { amountCents: amount, currency: "eur", destination: dest, sourceTransaction: null },
    extraMetadata: { autoFulfillmentBatchId: args.batchId, providerId: args.providerId },
  })
  if (isLegPaid(leg)) return { ok: true, reference: leg.stripeTransferId }
  return {
    ok: false,
    error: leg.outcome === "in_doubt" ? `transfer_in_doubt:${leg.reason}` : `transfer_${leg.outcome}`,
  }
}
