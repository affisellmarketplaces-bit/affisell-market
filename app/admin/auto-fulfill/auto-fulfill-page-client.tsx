"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import useSWR from "swr"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/admin/data-table"
import { fetchAdminAutoFulfillDashboard } from "@/lib/admin/auto-fulfill/fetch"
import type {
  AdminAutoFulfillLogRow,
  AdminAutoFulfillProductRow,
} from "@/lib/admin/auto-fulfill/load-dashboard"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const LOG_BADGE: Record<
  AdminAutoFulfillLogRow["status"],
  "default" | "secondary" | "outline" | "accent" | "live"
> = {
  PENDING: "secondary",
  BUYING: "accent",
  BOUGHT: "live",
  FAILED: "accent",
  REFUNDED: "outline",
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
    </div>
  )
}

export function AutoFulfillPageClient({ killSwitch = false }: { killSwitch?: boolean }) {
  const [q, setQ] = useState("")
  const deferredQ = useDeferredValue(q)

  const swrKey = useMemo(() => ["admin-auto-fulfill", deferredQ] as const, [deferredQ])
  const { data, isLoading, error } = useSWR(swrKey, () => fetchAdminAutoFulfillDashboard(deferredQ), {
    keepPreviousData: true,
  })

  const productColumns = useMemo<ColumnDef<AdminAutoFulfillProductRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Produit",
        cell: ({ row }) => (
          <div className="max-w-xs">
            <p className="truncate text-sm font-medium">{row.original.name}</p>
            <p className="font-mono text-[10px] text-zinc-500">{row.original.id}</p>
          </div>
        ),
      },
      {
        id: "supplier",
        header: "Fournisseur",
        cell: ({ row }) => (
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <p>{row.original.supplierStoreName ?? "—"}</p>
            <p className="truncate">{row.original.supplierEmail}</p>
          </div>
        ),
      },
      {
        id: "link",
        header: "Lien AE",
        cell: ({ row }) =>
          row.original.hasSupplierLink ? (
            <Badge variant="live" className="text-[10px]">
              Configuré
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Manquant
            </Badge>
          ),
      },
      {
        id: "autoBuy",
        header: "Auto-Buy",
        cell: ({ row }) =>
          row.original.autoBuyEnabled ? (
            <Badge variant="default" className="text-[10px]">
              ON
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              OFF
            </Badge>
          ),
      },
      {
        id: "ae",
        header: "Prix achat",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {row.original.aePriceCents != null
              ? `${(row.original.aePriceCents / 100).toFixed(2)} €`
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/admin/products/${row.original.id}`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            Configurer
          </Link>
        ),
      },
    ],
    []
  )

  const logColumns = useMemo<ColumnDef<AdminAutoFulfillLogRow, unknown>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => (
          <Badge variant={LOG_BADGE[row.original.status]} className="text-[10px]">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "product",
        header: "Produit",
        cell: ({ row }) => (
          <span className="max-w-[140px] truncate text-xs">{row.original.productName}</span>
        ),
      },
      {
        accessorKey: "customerEmail",
        header: "Client",
        cell: ({ row }) => (
          <span className="max-w-[160px] truncate text-xs text-zinc-600">{row.original.customerEmail}</span>
        ),
      },
      {
        accessorKey: "attempts",
        header: "Tent.",
        cell: ({ row }) => <span className="text-xs tabular-nums">{row.original.attempts}</span>,
      },
      {
        id: "aeOrder",
        header: "Commande AE",
        cell: ({ row }) => (
          <span className="font-mono text-[10px]">{row.original.aeOrderId ?? "—"}</span>
        ),
      },
      {
        id: "tracking",
        header: "Suivi",
        cell: ({ row }) => (
          <span className="font-mono text-[10px]">{row.original.aeTracking ?? "—"}</span>
        ),
      },
      {
        id: "error",
        header: "Erreur",
        cell: ({ row }) => (
          <span className="max-w-[120px] truncate text-[10px] text-red-600">
            {row.original.errorMsg ?? ""}
          </span>
        ),
      },
      {
        id: "order",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.orderId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Commande
          </Link>
        ),
      },
    ],
    []
  )

  const stats = data?.stats
  return (
    <div className="p-8 md:p-10">
      <div className="mb-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Auto-Fulfill AliExpress</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Achat automatique côté Affisell après paiement client. Configurez le lien fournisseur par produit,
          puis suivez les logs ci-dessous.
        </p>
        {killSwitch ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Kill switch actif : DISABLE_AUTO_BUY=true sur le serveur.
          </p>
        ) : null}
      </div>

      {stats ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Liens AE actifs" value={stats.productsWithLink} />
          <StatCard label="Auto-Buy ON" value={stats.productsAutoBuyOn} />
          <StatCard label="PENDING" value={stats.logsPending} />
          <StatCard label="BUYING" value={stats.logsBuying} />
          <StatCard label="BOUGHT" value={stats.logsBought} />
          <StatCard label="FAILED" value={stats.logsFailed} />
          <StatCard label="REFUNDED" value={stats.logsRefunded} />
        </div>
      ) : null}

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Produits</h2>
            <p className="text-xs text-zinc-500">Cliquez Configurer pour coller l’URL AliExpress et activer l’auto-achat.</p>
          </div>
          <div className="w-full max-w-sm">
            <Input
              placeholder="Recherche nom, id, email fournisseur…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Erreur chargement"}</p>
        ) : isLoading && !data?.products.length ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : (
          <DataTable
            columns={productColumns}
            data={data?.products ?? []}
            emptyMessage="Aucun produit trouvé."
          />
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Derniers logs auto-achat
        </h2>
        {isLoading && !data?.recentLogs.length ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : (
          <DataTable
            columns={logColumns}
            data={data?.recentLogs ?? []}
            emptyMessage="Aucun FulfillmentLog pour l’instant."
          />
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-2 text-xs text-zinc-500">
        <span>Worker : REDIS_URL + npm run worker:auto-order</span>
        <span>·</span>
        <Link href="/admin/queues" className="text-violet-600 hover:underline">
          Bull Board
        </Link>
      </div>
    </div>
  )
}
