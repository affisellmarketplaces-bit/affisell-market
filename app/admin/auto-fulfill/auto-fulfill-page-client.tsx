"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import useSWR from "swr"
import type { ColumnDef } from "@tanstack/react-table"

import {
  AffisellFeeModeBadge,
  AffisellPlatformFeesExplainer,
} from "@/components/shared/affisell-platform-fees-explainer"
import { DataTable } from "@/components/admin/data-table"
import { formatFeeBpsPercent } from "@/lib/marketplace-fee-display"
import {
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"
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

function centsToEur(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—"
  return `${(cents / 100).toFixed(2)} €`
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
    </div>
  )
}

function RetryAutoBuyButton({
  fulfillmentLogId,
  status,
  attempts,
  onDone,
}: {
  fulfillmentLogId: string
  status: AdminAutoFulfillLogRow["status"]
  attempts: number
  onDone: () => void
}) {
  const canRetry =
    status === "PENDING" ||
    status === "BUYING" ||
    (status === "FAILED" && attempts < 3)

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!canRetry) return null

  const errorLabel: Record<string, string> = {
    auto_buy_in_progress: "En cours (< 10 min)",
    no_supplier_link_or_auto_buy_off: "Lien AE / auto-buy OFF",
    queue_enqueue_failed: "Redis / file KO",
    auto_buy_disabled: "Kill switch actif",
    max_attempts_reached: "3 tentatives max",
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        className="h-7 text-[10px]"
        onClick={() => {
          setBusy(true)
          setErr(null)
          void fetch(`/api/admin/auto-fulfill/logs/${fulfillmentLogId}/retry`, {
            method: "POST",
          })
            .then(async (res) => {
              const body = (await res.json()) as { error?: string }
              if (!res.ok) {
                const code = body.error ?? "retry_failed"
                setErr(errorLabel[code] ?? code)
                return
              }
              onDone()
            })
            .catch(() => setErr("network_error"))
            .finally(() => setBusy(false))
        }}
      >
        {busy ? "…" : "Relancer"}
      </Button>
      {err ? <span className="max-w-[72px] truncate text-[9px] text-red-600">{err}</span> : null}
    </div>
  )
}

function AutoBuyToggle({
  productId,
  enabled,
  hasLink,
  onToggled,
}: {
  productId: string
  enabled: boolean
  hasLink: boolean
  onToggled: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition",
          enabled
            ? "bg-emerald-600 text-white"
            : "border border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800"
        )}
        onClick={() => {
          setBusy(true)
          void fetch(`/api/admin/products/${productId}/auto-buy-toggle`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !enabled }),
          })
            .then(() => onToggled())
            .finally(() => setBusy(false))
        }}
      >
        {busy ? "…" : enabled ? "ON" : "OFF"}
      </button>
      {!hasLink ? (
        <span className="text-[9px] text-amber-700 dark:text-amber-300">Sans lien AE</span>
      ) : null}
    </div>
  )
}

export function AutoFulfillPageClient({ killSwitch = false }: { killSwitch?: boolean }) {
  const [q, setQ] = useState("")
  const deferredQ = useDeferredValue(q)

  const swrKey = useMemo(() => ["admin-auto-fulfill", deferredQ] as const, [deferredQ])
  const { data, isLoading, error, mutate } = useSWR(swrKey, () => fetchAdminAutoFulfillDashboard(deferredQ), {
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
        cell: ({ row }) => (
          <AutoBuyToggle
            productId={row.original.id}
            enabled={row.original.autoBuyEnabled}
            hasLink={row.original.hasSupplierLink}
            onToggled={() => void mutate()}
          />
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
    [mutate]
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
        id: "economics",
        header: "Économie",
        cell: ({ row }) => (
          <div className="text-[10px] tabular-nums leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>Client {centsToEur(row.original.clientTotalCents)}</p>
            <p>Wholesale AE {centsToEur(row.original.aeWholesaleCents)}</p>
            <p className="flex flex-wrap items-center gap-1">
              <span>Fee supplier {centsToEur(row.original.supplierFeeCents)}</span>
              <AffisellFeeModeBadge usesAffisellAutoBuy={row.original.usesAffisellAutoBuy} />
              <span className="tabular-nums text-zinc-400">
                {formatFeeBpsPercent(
                  row.original.usesAffisellAutoBuy
                    ? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY
                    : DEFAULT_SUPPLIER_FEE_BPS_CATALOG
                )}
              </span>
            </p>
            <p>Fee affiliate {centsToEur(row.original.affiliateFeeCents)}</p>
          </div>
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
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-col items-end gap-1">
            <RetryAutoBuyButton
              fulfillmentLogId={row.original.id}
              status={row.original.status}
              attempts={row.original.attempts}
              onDone={() => void mutate()}
            />
            <Link
              href={`/admin/orders/${row.original.orderId}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-[10px]")}
            >
              Commande
            </Link>
          </div>
        ),
      },
    ],
    [mutate]
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

      <AffisellPlatformFeesExplainer className="mb-8" variant="admin" highlightAutoBuy />

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
