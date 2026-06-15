"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import useSWR from "swr"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Link2,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react"

import {
  AutoFulfillMetricTile,
  AutoFulfillSectionShell,
} from "@/components/admin/auto-fulfill/auto-fulfill-metric-tile"
import {
  AffisellFeeModeBadge,
  AffisellPlatformFeesExplainer,
} from "@/components/shared/affisell-platform-fees-explainer"
import { DataTable } from "@/components/admin/data-table"
import { affisellBrand } from "@/lib/affisell-brand"
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

const LOG_STATUS_LABEL: Record<AdminAutoFulfillLogRow["status"], string> = {
  PENDING: "En attente",
  BUYING: "Achat en cours",
  BOUGHT: "Acheté",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
}

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
        className="h-7 gap-1 rounded-full border-violet-300 text-[10px] hover:bg-violet-50 dark:border-violet-800"
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
        <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} aria-hidden />
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
          "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm transition",
          enabled
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white ring-2 ring-emerald-400/30"
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
        <span className="text-[9px] font-medium text-amber-700 dark:text-amber-300">Sans lien AE</span>
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
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {row.original.name}
            </p>
            <p className="font-mono text-[10px] text-zinc-500">{row.original.id}</p>
          </div>
        ),
      },
      {
        id: "supplier",
        header: "Fournisseur",
        cell: ({ row }) => (
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <p className="font-medium">{row.original.supplierStoreName ?? "—"}</p>
            <p className="truncate opacity-80">{row.original.supplierEmail}</p>
          </div>
        ),
      },
      {
        id: "link",
        header: "Lien AE",
        cell: ({ row }) =>
          row.original.hasSupplierLink ? (
            <Badge variant="live" className="rounded-full text-[10px]">
              Configuré
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full text-[10px]">
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
          <span className="text-sm font-bold tabular-nums text-brand dark:text-brand-light">
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
            className={cn(
              buttonVariants({ size: "sm" }),
              "gap-1.5 rounded-full bg-violet-600 shadow-sm hover:bg-violet-700"
            )}
          >
            Configurer
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
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
          <Badge variant={LOG_BADGE[row.original.status]} className="rounded-full text-[10px] font-bold">
            {LOG_STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
      {
        id: "product",
        header: "Produit",
        cell: ({ row }) => (
          <span className="max-w-[140px] truncate text-xs font-medium">{row.original.productName}</span>
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
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-2 py-1.5 text-[10px] tabular-nums leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            <p>Client {centsToEur(row.original.clientTotalCents)}</p>
            <p>Wholesale AE {centsToEur(row.original.aeWholesaleCents)}</p>
            <p className="flex flex-wrap items-center gap-1">
              <span>Fee supplier {centsToEur(row.original.supplierFeeCents)}</span>
              <AffisellFeeModeBadge usesAffisellAutoBuy={row.original.usesAffisellAutoBuy} />
              <span className="text-zinc-400">
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
        cell: ({ row }) => <span className="text-xs tabular-nums font-semibold">{row.original.attempts}</span>,
      },
      {
        id: "aeOrder",
        header: "Commande AE",
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-violet-800 dark:text-violet-200">
            {row.original.aeOrderId ?? "—"}
          </span>
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
  const logTotal = stats
    ? stats.logsPending +
      stats.logsBuying +
      stats.logsBought +
      stats.logsFailed +
      stats.logsRefunded
    : 0
  const logPct = (n: number) => (logTotal > 0 ? (n / logTotal) * 100 : 0)

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className={cn(affisellBrand.epoxyAtmosphere, "pointer-events-none fixed inset-0 opacity-90")} aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        {/* Hero */}
        <header
          className={cn(
            affisellBrand.epoxySurfaceLight,
            "relative mb-8 overflow-hidden rounded-3xl border border-brand/20 p-6 shadow-xl shadow-brand/10 md:p-8"
          )}
        >
          <div className={cn(affisellBrand.gradientBar, "absolute inset-x-0 top-0 h-1.5")} aria-hidden />
          <div className={cn(affisellBrand.headerMesh, "!opacity-50")} aria-hidden />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(affisellBrand.badgeBrand, "gap-1.5")}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Command Center
                </span>
                {!killSwitch ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Auto-buy actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    Kill switch
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-cyan-500 text-white shadow-lg shadow-brand/30">
                  <Bot className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white md:text-3xl">
                    Auto-Fulfill
                  </h1>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Worker · carte Issuing · mapping SKU · settlement Phase 1
                  </p>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Achat automatique côté Affisell après paiement client. Configurez le lien fournisseur par produit,
                puis pilotez le pipeline ci-dessous.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xs lg:flex-col">
              <Link
                href="/admin/queues"
                className={cn(
                  affisellBrand.epoxyChip,
                  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-brand hover:text-brand-hover dark:text-brand-light"
                )}
              >
                <Activity className="h-4 w-4" aria-hidden />
                Bull Board
              </Link>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Worker : <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run worker:auto-order</code>
              </p>
            </div>
          </div>
          {killSwitch ? (
            <p className="relative mt-4 rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Kill switch actif : <code>DISABLE_AUTO_BUY=true</code> sur le serveur.
            </p>
          ) : null}
        </header>

        <AffisellPlatformFeesExplainer className="mb-8" variant="admin" highlightAutoBuy />

        {stats ? (
          <div className="mb-8 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Couverture catalogue</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <AutoFulfillMetricTile
                label="Liens AE actifs"
                value={stats.productsWithLink}
                tone="brand"
                icon={Link2}
                hint="Produits avec SupplierLink configuré"
              />
              <AutoFulfillMetricTile
                label="Auto-Buy ON"
                value={stats.productsAutoBuyOn}
                tone="ai"
                icon={Zap}
                hint="Prêts pour achat automatique post-paiement"
              />
            </div>
            <p className="pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Pipeline fulfillment
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <AutoFulfillMetricTile
                label="En attente"
                value={stats.logsPending}
                tone="zinc"
                icon={Clock}
                barPct={logPct(stats.logsPending)}
              />
              <AutoFulfillMetricTile
                label="Achat en cours"
                value={stats.logsBuying}
                tone="ai"
                icon={ShoppingCart}
                barPct={logPct(stats.logsBuying)}
              />
              <AutoFulfillMetricTile
                label="Achetés"
                value={stats.logsBought}
                tone="emerald"
                icon={CheckCircle2}
                barPct={logPct(stats.logsBought)}
              />
              <AutoFulfillMetricTile
                label="Échecs"
                value={stats.logsFailed}
                tone="rose"
                icon={XCircle}
                barPct={logPct(stats.logsFailed)}
              />
              <AutoFulfillMetricTile
                label="Remboursés"
                value={stats.logsRefunded}
                tone="amber"
                icon={RefreshCw}
                barPct={logPct(stats.logsRefunded)}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-8">
          <AutoFulfillSectionShell
            eyebrow="Catalogue"
            title="Produits"
            description="Collez l’URL AliExpress et activez l’auto-achat par fiche produit."
            action={
              <div className="relative w-full max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <Input
                  className="rounded-full border-violet-200/80 bg-white pl-9 shadow-sm dark:border-violet-900/50 dark:bg-zinc-950"
                  placeholder="Recherche nom, id, email fournisseur…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            }
          >
            {error ? (
              <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Erreur chargement"}</p>
            ) : isLoading && !data?.products.length ? (
              <div className="flex items-center gap-3 py-12 text-sm text-zinc-500">
                <RefreshCw className="h-5 w-5 animate-spin text-brand" aria-hidden />
                Chargement du catalogue…
              </div>
            ) : (
              <DataTable
                  embedded
                  columns={productColumns}
                  data={data?.products ?? []}
                  emptyMessage="Aucun produit trouvé."
                />
            )}
          </AutoFulfillSectionShell>

          <AutoFulfillSectionShell
            eyebrow="Telemetry"
            title="Derniers logs auto-achat"
            description="FulfillmentLog en temps réel — relance manuelle si PENDING / FAILED."
          >
            {isLoading && !data?.recentLogs.length ? (
              <div className="flex items-center gap-3 py-12 text-sm text-zinc-500">
                <RefreshCw className="h-5 w-5 animate-spin text-brand" aria-hidden />
                Chargement des logs…
              </div>
            ) : (
              <DataTable
                  embedded
                  columns={logColumns}
                  data={data?.recentLogs ?? []}
                  emptyMessage="Aucun FulfillmentLog pour l’instant."
                />
            )}
          </AutoFulfillSectionShell>
        </div>
      </div>
    </div>
  )
}
