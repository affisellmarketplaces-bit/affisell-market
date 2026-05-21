"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import useSWR from "swr"
import type { ColumnDef } from "@tanstack/react-table"
import type { FulfillmentStatus } from "@prisma/client"

import { DataTable } from "@/components/admin/data-table"
import { fetchAdminOrders } from "@/lib/admin/orders/fetch"
import type { AdminOrdersListQuery } from "@/lib/admin/orders/list-query"
import type { AdminOrderListRow } from "@/lib/admin/orders/serialize-list"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const FULFILLMENT_OPTIONS: { value: "" | FulfillmentStatus; label: string }[] = [
  { value: "", label: "Tous statuts fulfillment" },
  { value: "PENDING", label: "PENDING" },
  { value: "PROCESSING", label: "PROCESSING" },
  { value: "PARTIAL", label: "PARTIAL" },
  { value: "ORDERED", label: "ORDERED" },
  { value: "SHIPPED", label: "SHIPPED" },
  { value: "DELIVERED", label: "DELIVERED" },
  { value: "FAILED", label: "FAILED" },
  { value: "MANUAL_REQUIRED", label: "MANUAL_REQUIRED" },
]

const PAYMENT_OPTIONS = [
  { value: "", label: "Tous paiements" },
  { value: "paid", label: "paid" },
  { value: "preparing", label: "preparing" },
  { value: "shipped", label: "shipped" },
  { value: "refunded", label: "refunded" },
]

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

export function OrdersPageClient() {
  const [q, setQ] = useState("")
  const [fulfillmentStatus, setFulfillmentStatus] = useState<"" | FulfillmentStatus>("")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")

  const deferredQ = useDeferredValue(q)

  const listQuery = useMemo<AdminOrdersListQuery>(() => {
    const query: AdminOrdersListQuery = { take: 50 }
    const trimmed = deferredQ.trim()
    if (trimmed) query.q = trimmed
    if (fulfillmentStatus) query.fulfillmentStatus = fulfillmentStatus
    if (paymentStatus) query.paymentStatus = paymentStatus
    if (createdFrom) {
      const d = new Date(createdFrom)
      if (!Number.isNaN(d.getTime())) query.createdFrom = d
    }
    if (createdTo) {
      const d = new Date(createdTo)
      if (!Number.isNaN(d.getTime())) query.createdTo = d
    }
    return query
  }, [createdFrom, createdTo, deferredQ, fulfillmentStatus, paymentStatus])

  const swrKey = useMemo(() => ["admin-orders", listQuery] as const, [listQuery])

  const { data: orders, isLoading, error } = useSWR(swrKey, () => fetchAdminOrders(listQuery), {
    keepPreviousData: true,
  })

  const rows = orders ?? []

  const columns = useMemo<ColumnDef<AdminOrderListRow, unknown>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "#Order",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
            {row.original.orderNumber}
          </span>
        ),
      },
      {
        accessorKey: "customerEmail",
        header: "Client",
        cell: ({ row }) => (
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{row.original.customerEmail}</span>
        ),
      },
      {
        accessorKey: "amountCents",
        header: "Montant",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{money(row.original.amountCents)}</span>
        ),
      },
      {
        id: "status",
        header: "Statut",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="w-fit text-xs">
              {row.original.paymentStatus}
            </Badge>
            <Badge variant="accent" className="w-fit text-xs">
              {row.original.fulfillmentStatus}
            </Badge>
          </div>
        ),
      },
      {
        id: "suppliers",
        header: "Fournisseurs",
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {row.original.supplierNames.length > 0
              ? row.original.supplierNames.join(", ")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "trackingNumber",
        header: "Tracking",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
            {row.original.trackingNumber ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Détail
          </Link>
        ),
      },
    ],
    []
  )

  function clearFilters() {
    setQ("")
    setFulfillmentStatus("")
    setPaymentStatus("")
    setCreatedFrom("")
    setCreatedTo("")
  }

  const hasFilters =
    q.trim() || fulfillmentStatus || paymentStatus || createdFrom || createdTo

  return (
    <div className="p-8 md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Commandes</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Recherche serveur — SAV, tracking et annulations fournisseur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/providers"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Fournisseurs
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="orders-q" className="mb-1 block text-xs font-medium text-zinc-600">
            Recherche (n° commande, email, session Stripe)
          </label>
          <Input
            id="orders-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex. clxyz… ou client@email.com"
            className="max-w-xl"
          />
        </div>

        <div>
          <label htmlFor="orders-fulfillment" className="mb-1 block text-xs font-medium text-zinc-600">
            Fulfillment
          </label>
          <select
            id="orders-fulfillment"
            value={fulfillmentStatus}
            onChange={(e) => setFulfillmentStatus(e.target.value as "" | FulfillmentStatus)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {FULFILLMENT_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="orders-payment" className="mb-1 block text-xs font-medium text-zinc-600">
            Paiement
          </label>
          <select
            id="orders-payment"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {PAYMENT_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="orders-from" className="mb-1 block text-xs font-medium text-zinc-600">
            Créée depuis
          </label>
          <Input
            id="orders-from"
            type="date"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="orders-to" className="mb-1 block text-xs font-medium text-zinc-600">
            Créée jusqu&apos;au
          </label>
          <Input
            id="orders-to"
            type="date"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
          />
        </div>

        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasFilters}
            onClick={clearFilters}
          >
            Réinitialiser filtres
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-600">Impossible de charger les commandes.</p>
      ) : null}

      {isLoading && rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <DataTable data={rows} columns={columns} emptyMessage="Aucune commande trouvée." />
      )}
    </div>
  )
}
