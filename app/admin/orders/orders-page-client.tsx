"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState, useTransition } from "react"
import useSWR from "swr"
import type { ColumnDef } from "@tanstack/react-table"
import type { FulfillmentStatus, SplitStatus } from "@prisma/client"
import { toast } from "sonner"

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

const SPLIT_BADGE: Record<
  SplitStatus,
  "default" | "secondary" | "outline" | "accent" | "live"
> = {
  PENDING: "secondary",
  PARTIAL: "accent",
  SUCCESS: "live",
  FAILED: "accent",
}

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function transferLabel(
  label: string,
  t: { amountCents: number; status: string; errorCode: string | null } | null
) {
  if (!t) return `${label}: —`
  return `${label}: ${money(t.amountCents)} · ${t.status}${t.errorCode ? ` (${t.errorCode})` : ""}`
}

export function OrdersPageClient() {
  const [q, setQ] = useState("")
  const [fulfillmentStatus, setFulfillmentStatus] = useState<"" | FulfillmentStatus>("")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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

  const { data: orders, isLoading, error, mutate } = useSWR(swrKey, () => fetchAdminOrders(listQuery), {
    keepPreviousData: true,
  })

  const rows = orders ?? []

  const columns = useMemo<ColumnDef<AdminOrderListRow, unknown>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order ID",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-medium">{row.original.orderNumber}</span>
            <Link
              href={`/admin/orders/${row.original.id}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Détail
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "amountCents",
        header: "Total",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{money(row.original.amountCents)}</span>
        ),
      },
      {
        id: "supplier",
        header: "Supplier",
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {transferLabel("S", row.original.supplierTransfer)}
          </span>
        ),
      },
      {
        id: "affiliate",
        header: "Affiliate",
        cell: ({ row }) => {
          const a = row.original.affiliateTransfer
          return (
            <div className="space-y-1 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">
                {transferLabel("A", a)}
              </span>
              {a?.errorCode === "AFFILIATE_ONBOARDING_REQUIRED" ? (
                <Badge variant="accent" className="text-[10px]">
                  AFFILIATE_ONBOARDING_REQUIRED
                </Badge>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: "splitStatus",
        header: "SplitStatus",
        cell: ({ row }) => (
          <Badge variant={SPLIT_BADGE[row.original.splitStatus]} className="w-fit text-xs">
            {row.original.splitStatus}
          </Badge>
        ),
      },
      {
        id: "transfers",
        header: "Transfers",
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-zinc-500">
            {row.original.supplierTransfer?.status ?? "—"} /{" "}
            {row.original.affiliateTransfer?.status ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const o = row.original
          const busy = pendingId === o.id
          const canResettle =
            o.splitStatus === "PARTIAL" || o.splitStatus === "FAILED" || o.splitStatus === "PENDING"
          const affiliateAcct = o.affiliateTransfer?.destination
          const needsOnboarding =
            o.affiliateTransfer?.errorCode === "AFFILIATE_ONBOARDING_REQUIRED"

          return (
            <div className="flex flex-wrap gap-1">
              {canResettle ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setPendingId(o.id)
                    startTransition(async () => {
                      try {
                        const res = await fetch(`/api/admin/orders/${o.id}/resettle`, {
                          method: "POST",
                          credentials: "include",
                        })
                        const data = (await res.json()) as { ok?: boolean; error?: string }
                        if (!res.ok) throw new Error(data.error ?? "Resettle failed")
                        toast.success("Resettle terminé", { description: o.orderNumber })
                        await mutate()
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erreur")
                      } finally {
                        setPendingId(null)
                      }
                    })
                  }}
                >
                  Resettle
                </Button>
              ) : null}
              {needsOnboarding && affiliateAcct ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setPendingId(o.id)
                    startTransition(async () => {
                      try {
                        const res = await fetch("/api/admin/stripe-health/send-onboarding", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ accountId: affiliateAcct }),
                        })
                        const data = (await res.json()) as { url?: string; error?: string }
                        if (!res.ok) throw new Error(data.error ?? "Link failed")
                        if (data.url) window.open(data.url, "_blank")
                        toast.success("Lien onboarding généré")
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erreur")
                      } finally {
                        setPendingId(null)
                      }
                    })
                  }}
                >
                  Onboarding
                </Button>
              ) : null}
              {o.affiliateTransfer?.onboardingUrl ? (
                <a
                  href={o.affiliateTransfer.onboardingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Stripe
                </a>
              ) : null}
            </div>
          )
        },
      },
    ],
    [mutate, pendingId, startTransition]
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
            Split Connect, transfers et resettle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/stripe-health"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Stripe health
          </Link>
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
