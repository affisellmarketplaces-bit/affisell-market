import { CreditCard, PackageCheck, ShoppingCart, Truck } from "lucide-react"

import { KpiTile } from "@/components/dashboard/kpi-tile"

export type BuyerKpiLabels = {
  inProgress: string
  delivered: string
  credit: string
  cart: string
  inProgressSub: string
  deliveredSub: string
  creditSub: string
  cartSub: string
}

/** Four headline numbers of the customer area; each opens the page where it can be acted on. */
export function BuyerKpiStrip({
  labels,
  inProgressCount,
  deliveredCount,
  walletLabel,
  walletCents,
  cartItemCount,
}: {
  labels: BuyerKpiLabels
  inProgressCount: number
  deliveredCount: number
  walletLabel: string
  walletCents: number
  cartItemCount: number
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <KpiTile
        href="/marketplace/account/orders"
        Icon={Truck}
        label={labels.inProgress}
        value={String(inProgressCount)}
        sub={labels.inProgressSub}
        tone={inProgressCount > 0 ? "good" : "neutral"}
      />
      <KpiTile
        href="/marketplace/account/orders"
        Icon={PackageCheck}
        label={labels.delivered}
        value={String(deliveredCount)}
        sub={labels.deliveredSub}
      />
      <KpiTile
        href="/marketplace/account/wallet"
        Icon={CreditCard}
        label={labels.credit}
        value={walletLabel}
        sub={labels.creditSub}
        tone={walletCents > 0 ? "good" : "neutral"}
      />
      <KpiTile
        href="/cart"
        Icon={ShoppingCart}
        label={labels.cart}
        value={String(cartItemCount)}
        sub={labels.cartSub}
        tone={cartItemCount > 0 ? "warn" : "neutral"}
      />
    </div>
  )
}
