import Link from "next/link"

import { CommissionExplainer } from "@/components/legal/commission-explainer"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { OrderAccessRole } from "@/lib/order-access"

function buyerOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    paid: "Confirmée",
    preparing: "Préparation en cours",
    shipped: "Expédiée",
    refunded: "Remboursée",
    cancelled: "Annulée",
    CANCELLED: "Annulée",
  }
  return map[status] ?? status
}

type OrderDetail = {
  id: string
  status: string
  createdAt: Date
  basePriceCents: number
  supplierPriceCents: number | null
  sellingPriceCents: number
  subtotalCents: number | null
  taxCents: number | null
  totalCents: number | null
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affisellFeeCents: number
  supplierPayoutCents: number | null
  marginCents: number
  product: { name: string }
}

type Props = {
  order: OrderDetail
  role: OrderAccessRole
  backHref: string
  backLabel?: string
  showRevenueToAffiliate?: boolean
}

export function OrderDetailPanel({
  order,
  role,
  backHref,
  backLabel = "← Retour aux commandes",
  showRevenueToAffiliate = false,
}: Props) {
  return (
    <div className="space-y-6">
      <Link href={backHref} className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
        {backLabel}
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Commande {order.id.slice(0, 8)}…
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{order.product.name}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Statut : {role === "CUSTOMER" ? buyerOrderStatusLabel(order.status) : order.status} ·{" "}
          {new Date(order.createdAt).toLocaleString("fr-FR")}
        </p>
      </header>

      <CommissionExplainer role={role} order={order} showRevenueToAffiliate={showRevenueToAffiliate} />

      <div className="flex flex-wrap gap-2 text-sm">
        {role === "SUPPLIER" ? (
          <a
            href={`/api/orders/${order.id}/invoice?type=SUPPLIER`}
            className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Télécharger facture wholesale
          </a>
        ) : null}
        {role === "AFFILIATE" ? (
          <a
            href={`/api/orders/${order.id}/invoice?type=AFFILIATE`}
            className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Note de commission
          </a>
        ) : null}
        {role === "CUSTOMER" ? (
          <a
            href={`/api/orders/${order.id}/invoice?type=CUSTOMER`}
            className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Facture TTC {formatStoreCurrencyFromCents(order.totalCents ?? 0)}
          </a>
        ) : null}
        <Link
          href={role === "CUSTOMER" ? "/marketplace/account/gdpr" : "/dashboard/account/gdpr"}
          className="rounded-full px-4 py-2 font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Données personnelles
        </Link>
      </div>
    </div>
  )
}
