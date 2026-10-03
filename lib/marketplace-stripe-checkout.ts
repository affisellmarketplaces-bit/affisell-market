import type Stripe from "stripe"

import { appBaseUrl } from "@/lib/app-base-url"
import { isPlatformHost } from "@/lib/custom-domain-host"
import { isAffisellVatFranchise } from "@/lib/legal/company-env"

/**
 * Stripe Tax on marketplace Checkout.
 * Default OFF under art. 293 B (no COMPANY_VAT / AFFISELL_TVA).
 * Set STRIPE_AUTOMATIC_TAX=1 after exiting franchise / VAT registration.
 */
export function isStripeAutomaticTaxEnabled(): boolean {
  const override = process.env.STRIPE_AUTOMATIC_TAX?.trim().toLowerCase()
  if (override === "1" || override === "true" || override === "on" || override === "yes") {
    return true
  }
  if (override === "0" || override === "false" || override === "off" || override === "no") {
    return false
  }
  return !isAffisellVatFranchise()
}

/** Shared Stripe Checkout options aligned with Affisell VAT regime. */
export function marketplaceCheckoutTaxOptions(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "automatic_tax" | "tax_id_collection"
> {
  const enabled = isStripeAutomaticTaxEnabled()
  console.log("[marketplace-stripe-checkout]", {
    result: enabled ? "automatic_tax_on" : "automatic_tax_off_293b",
  })
  if (!enabled) {
    return {
      automatic_tax: { enabled: false },
    }
  }
  return {
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
  }
}

/**
 * Pre-pay CGV gate on Stripe Checkout (Code de la conso).
 * Requires Stripe Dashboard → Settings → Public details → Terms of service URL
 * = `{APP_URL}/legal/cgv` (same path as footer).
 *
 * `origin` is the host the buyer is checking out from. On a reseller's own host the link stays on that host and the
 * acceptance text carries no platform brand ("les Conditions générales de vente" — the document itself names the
 * operator); on the platform it is unchanged.
 */
export function marketplaceCheckoutCgvConsentOptions(
  origin?: string
): Pick<Stripe.Checkout.SessionCreateParams, "consent_collection" | "custom_text"> {
  const storeHost = isStoreOrigin(origin)
  const base = storeHost && origin ? origin : appBaseUrl()
  const tosUrl = `${base.replace(/\/$/, "")}/legal/cgv`
  console.log("[marketplace-stripe-checkout]", { result: "cgv_consent_required", tosUrl, storeHost })
  return {
    consent_collection: {
      terms_of_service: "required",
    },
    custom_text: {
      terms_of_service_acceptance: {
        message: storeHost
          ? `J'accepte les Conditions générales de vente (${tosUrl}).`
          : `J'accepte les Conditions générales de vente Affisell (${tosUrl}).`,
      },
    },
  }
}

/** True when `origin` is a reseller's own host (custom domain / store subdomain), not the Affisell platform. */
function isStoreOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  try {
    return !isPlatformHost(new URL(origin).host)
  } catch {
    return false
  }
}

export type MarketplaceStripeLineItem = {
  price_data: {
    currency: "eur"
    unit_amount: number
    tax_behavior?: "exclusive" | "inclusive"
    product_data: { name: string; images: string[] }
  }
  quantity: number
}

export function buildHtLineItem(args: {
  name: string
  images: string[]
  linePaidCentsHt: number
  qty: number
}): MarketplaceStripeLineItem {
  const qty = Math.max(1, Math.round(args.qty))
  const lineTotalHt = Math.max(0, Math.round(args.linePaidCentsHt))
  const unitAmount = Math.max(0, Math.round(lineTotalHt / qty))
  const taxOn = isStripeAutomaticTaxEnabled()
  return {
    price_data: {
      currency: "eur",
      unit_amount: unitAmount,
      // Exclusive only when Stripe Tax may add VAT on top; franchise = listed price is charged as-is.
      ...(taxOn ? { tax_behavior: "exclusive" as const } : {}),
      product_data: { name: args.name, images: args.images },
    },
    quantity: qty,
  }
}
