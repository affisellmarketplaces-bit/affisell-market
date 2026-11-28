import type { FulfillmentPaymentMethod } from "@prisma/client"
import Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import type { SupplierGroup } from "@/lib/auto-order/types"
import { appClaimStore, type ClaimStore, type HeldClaim } from "@/lib/supplier-purchase/guard.server"
import { supplierPurchaseDecision } from "@/lib/supplier-purchase/policy"

export type PaymentResult = {
  ok: boolean
  reference?: string
  error?: string
  /**
   * False when it is CERTAIN that no money moved (refused before any money call, insufficient balance…). True when
   * money moved or may have moved (Stripe error after the request): the claim must then never be retried
   * automatically.
   */
  moneyMayHaveMoved: boolean
}

export const MONEY_PAYMENT_METHODS: ReadonlySet<FulfillmentPaymentMethod> = new Set([
  "WALLET_PREPAID",
  "STRIPE_CONNECT",
])

/**
 * Pays a supplier for one group — ONLY under a held supplier-purchase claim (lib/supplier-purchase/guard.server.ts),
 * so one purchase can never be paid twice:
 *   - wallet: the debit and the claim's `paidCents` stamp happen in ONE transaction, and the stamp only succeeds if the
 *     claim is still held by this token and not paid yet (a retry, a concurrent run or a resumed run debits nothing);
 *   - Stripe Connect: idempotency key bound to the claim token (Stripe returns the same transfer on a retry), then
 *     the transfer id is stamped on the claim.
 */
export async function executeSupplierPayment(args: {
  method: FulfillmentPaymentMethod
  providerId: string
  batchId: string
  group: SupplierGroup
  held: HeldClaim | null
  store?: ClaimStore
}): Promise<PaymentResult> {
  if (MONEY_PAYMENT_METHODS.has(args.method)) {
    const decision = supplierPurchaseDecision(process.env, "supplier_payment")
    if (!decision.allowed) {
      return { ok: false, error: `supplier_purchase_blocked:${decision.reason}`, moneyMayHaveMoved: false }
    }
    if (!args.held) return { ok: false, error: "supplier_payment_without_claim", moneyMayHaveMoved: false }
  }
  switch (args.method) {
    case "NONE":
    case "INVOICE_NET30":
      return { ok: true, reference: "no_payment_required", moneyMayHaveMoved: false }
    case "WALLET_PREPAID":
      return payFromWallet({ ...args, held: args.held! })
    case "STRIPE_CONNECT":
      return payStripeConnect({ ...args, held: args.held! })
    case "STRIPE_ISSUING":
      return { ok: false, error: "STRIPE_ISSUING not configured — enable in v1.1", moneyMayHaveMoved: false }
    default:
      return { ok: true, reference: "skipped", moneyMayHaveMoved: false }
  }
}

async function payFromWallet(args: {
  providerId: string
  group: SupplierGroup
  held: HeldClaim
  store?: ClaimStore
}): Promise<PaymentResult> {
  const cost = args.group.totalCostCents
  if (cost < 1) return { ok: true, reference: "zero_cost", moneyMayHaveMoved: false }
  const store = args.store ?? (await appClaimStore())
  const r = await store.debitWalletForClaim(args.held.keys, args.held.token, args.providerId, cost)
  if (r === "debited") return { ok: true, reference: `wallet-${args.providerId}-${cost}`, moneyMayHaveMoved: true }
  // Nothing was debited in either case (the transaction rolled back).
  return { ok: false, error: r, moneyMayHaveMoved: false }
}

async function payStripeConnect(args: {
  providerId: string
  batchId: string
  group: SupplierGroup
  held: HeldClaim
  store?: ClaimStore
}): Promise<PaymentResult> {
  if (process.env.AUTO_ORDER_ENABLE_STRIPE_TRANSFERS !== "true") {
    return { ok: false, error: "stripe_transfers_disabled", moneyMayHaveMoved: false }
  }

  const provider = await prisma.fulfillmentProvider.findUnique({
    where: { id: args.providerId },
    select: { stripeConnectAccountId: true },
  })
  const dest = provider?.stripeConnectAccountId?.trim()
  if (!dest) return { ok: false, error: "missing_stripe_connect_account", moneyMayHaveMoved: false }

  const amount = args.group.totalCostCents
  if (amount < 1) return { ok: true, reference: "zero_transfer", moneyMayHaveMoved: false }

  let transfer: Stripe.Transfer
  try {
    const stripe = getStripeClient()
    transfer = await stripe.transfers.create(
      {
        amount,
        currency: "eur",
        destination: dest,
        metadata: {
          autoFulfillmentBatchId: args.batchId,
          providerId: args.providerId,
          purchaseClaimToken: args.held.token,
        },
      } as Stripe.TransferCreateParams,
      // Bound to the claim: a retry of the same claim gets the same transfer back, never a second one.
      { idempotencyKey: `supplier_pay_${args.held.token}` },
    )
  } catch (e) {
    // The request may have reached Stripe: never treat as "nothing moved".
    return { ok: false, error: e instanceof Error ? e.message : "transfer_failed", moneyMayHaveMoved: true }
  }
  const store = args.store ?? (await appClaimStore())
  await store.recordPayment(args.held.keys, args.held.token, transfer.id, amount).catch(() => false)
  return { ok: true, reference: transfer.id, moneyMayHaveMoved: true }
}
