import Link from "next/link"

import type { AdminOrderDetail } from "@/lib/admin/orders/types"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

type Props = {
  order: AdminOrderDetail
  actions?: React.ReactNode
}

export function OrderHeader({ order, actions }: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link
          href="/admin/providers"
          className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Commande {order.id.slice(0, 10)}…
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {order.productName}
          {order.variantLabel ? ` · ${order.variantLabel}` : ""} × {order.quantity}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{order.status}</Badge>
          <Badge variant="accent">{order.fulfillmentStatus}</Badge>
        </div>
        <dl className="mt-4 grid gap-1 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
          <div>
            <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">Client :</dt>{" "}
            {order.customerEmail}
          </div>
          <div>
            <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">Montant :</dt>{" "}
            {money(order.sellingPriceCents)}
          </div>
          <div>
            <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">Fournisseur :</dt>{" "}
            {order.supplierName}
          </div>
          {order.affiliateName ? (
            <div>
              <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">Affilié :</dt>{" "}
              {order.affiliateName}
            </div>
          ) : null}
        </dl>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
