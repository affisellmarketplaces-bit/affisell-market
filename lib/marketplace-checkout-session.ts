import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

export function extractMarketplaceCheckoutCustomer(session: Stripe.Checkout.Session): {
  customerEmail: string
  shippingAddress: Prisma.InputJsonValue
} {
  const customerEmail =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    ""

  const ship = session as Stripe.Checkout.Session & {
    shipping_details?: {
      name?: string | null
      address?: Stripe.Address | null
    } | null
  }

  const address = ship.shipping_details?.address ?? session.customer_details?.address ?? null
  const name =
    ship.shipping_details?.name?.trim() || session.customer_details?.name?.trim() || ""

  const shippingAddress: Prisma.InputJsonValue = {
    name,
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postal_code: address?.postal_code ?? "",
    country: address?.country ?? "",
  }

  return { customerEmail, shippingAddress }
}
