import Link from "next/link"

import { CommissionExplainer } from "@/components/legal/commission-explainer"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { OrderCommissionView } from "@/lib/order-commission-breakdown"
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

type OrderHeader = {
  id: string
  status: string
  createdAt: Date
  productName: string
  customerTotalCents?: number
}

type Props = {
  order: OrderHeader
  role: OrderAccessRole
  commissionView: OrderCommissionView
  backHref: string
  backLabel?: string
}

export function OrderDetailPanel({
  order,
  role,
  commissionView,
  backHref,
  backLabel = "← Retour aux commandes",
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
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{order.productName}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Statut : {role === "CUSTOMER" ? buyerOrderStatusLabel(order.status) : order.status} ·{" "}
          {new Date(order.createdAt).toLocaleString("fr-FR")}
        </p>
      </header>

      <CommissionExplainer view={commissionView} />

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
        {role === "CUSTOMER" && order.customerTotalCents != null ? (
          <a
            href={`/api/orders/${order.id}/invoice?type=CUSTOMER`}
            className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Facture TTC {formatStoreCurrencyFromCents(order.customerTotalCents)}
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
