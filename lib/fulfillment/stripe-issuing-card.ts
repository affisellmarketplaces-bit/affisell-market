import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe"

export type VirtualCardResult =
  | { ok: true; cardId: string; last4: string; number: string; expMonth: number; expYear: number; cvc: string }
  | { ok: false; error: string }

const MARGIN_CENTS = 100

export function autoBuyCardAmountCents(aePriceCents: number, aeShippingCents: number): number {
  return Math.max(100, aePriceCents + aeShippingCents + MARGIN_CENTS)
}

/** Create a single-use virtual card for AliExpress checkout (Stripe Issuing). */
export async function createAutoBuyVirtualCard(amountCents: number): Promise<VirtualCardResult> {
  const cardholderId = process.env.STRIPE_ISSUING_CARDHOLDER_ID?.trim()
  if (!cardholderId) {
    return { ok: false, error: "STRIPE_ISSUING_CARDHOLDER_ID not configured" }
  }

  try {
    const stripe = getStripeClient()
    const card = await stripe.issuing.cards.create({
      cardholder: cardholderId,
      currency: "eur",
      type: "virtual",
      status: "active",
      spending_controls: {
        spending_limits: [
          {
            amount: amountCents,
            interval: "all_time",
          },
        ],
      },
    })

    const details = await stripe.issuing.cards.retrieve(card.id, {
      expand: ["number", "cvc"],
    })

    const number = typeof details.number === "string" ? details.number : ""
    const cvc = typeof details.cvc === "string" ? details.cvc : ""
    if (!number || !cvc) {
      return { ok: false, error: "issuing_card_details_unavailable" }
    }

    return {
      ok: true,
      cardId: card.id,
      last4: card.last4,
      number,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      cvc,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "issuing_card_create_failed" }
  }
}

export async function loadAutoBuyVirtualCardSecrets(
  cardId: string
): Promise<
  | { ok: true; number: string; expMonth: number; expYear: number; cvc: string }
  | { ok: false; error: string }
> {
  try {
    const stripe = getStripeClient()
    const details = await stripe.issuing.cards.retrieve(cardId, {
      expand: ["number", "cvc"],
    })
    const number = typeof details.number === "string" ? details.number : ""
    const cvc = typeof details.cvc === "string" ? details.cvc : ""
    if (!number || !cvc) {
      return { ok: false, error: "issuing_card_details_unavailable" }
    }
    return {
      ok: true,
      number,
      cvc,
      expMonth: details.exp_month,
      expYear: details.exp_year,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "issuing_card_load_failed" }
  }
}

export async function freezeAutoBuyVirtualCard(cardId: string): Promise<void> {
  if (!cardId.trim()) return
  try {
    const stripe = getStripeClient()
    await stripe.issuing.cards.update(cardId, { status: "inactive" })
  } catch (e) {
    console.error("[auto-buy] freeze_virtual_card_failed", {
      cardId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
