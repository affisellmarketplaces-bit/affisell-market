"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DataTable } from "@/components/admin/data-table"
import type { AdminSplitRow, SplitDisplayStatus } from "@/lib/admin/splits/types"
import { SPLIT_DISPLAY_STATUSES } from "@/lib/admin/splits/types"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  rows: AdminSplitRow[]
  summary: {
    SUCCESS: number
    PARTIAL: number
    FAILED: number
    PENDING: number
    blocked: number
  }
  initialFilters: {
    status: SplitDisplayStatus | "all"
    from: string
    to: string
  }
}

const STATUS_VARIANT: Record<
  SplitDisplayStatus,
  "default" | "secondary" | "outline" | "accent" | "live"
> = {
  SUCCESS: "live",
  PARTIAL: "accent",
  FAILED: "accent",
  PENDING: "secondary",
}

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function cellTransfer(
  label: string,
  cell: AdminSplitRow["supplier"]
) {
  if (!cell) return `${label}: —`
  return `${label}: ${money(cell.amountCents)} · ${cell.status}${cell.errorCode ? ` (${cell.errorCode})` : ""}`
}

export function SplitsPageClient({ rows, summary, initialFilters }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialFilters.status)
  const [from, setFrom] = useState(initialFilters.from)
  const [to, setTo] = useState(initialFilters.to)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const columns = useMemo<ColumnDef<AdminSplitRow, unknown>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold">{row.original.orderNumber}</span>
            <Link
              href={`/admin/orders/${row.original.orderId}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {row.original.orderId.slice(0, 14)}…
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {new Date(row.original.createdAt).toLocaleString("fr-FR")}
          </span>
        ),
      },
      {
        accessorKey: "totalCents",
        header: "Total",
        cell: ({ row }) => <span className="tabular-nums text-sm">{money(row.original.totalCents)}</span>,
      },
      {
        id: "supplier",
        header: "Supplier",
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {cellTransfer("S", row.original.supplier)}
          </span>
        ),
      },
      {
        id: "affiliate",
        header: "Affiliate",
        cell: ({ row }) => (
          <div className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {cellTransfer("A", row.original.affiliate)}
            </span>
            {row.original.needsOnboarding ? (
              <Badge variant="accent" className="text-[10px]">
                Onboarding required
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "affisellFeeCents",
        header: "Affisell",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{money(row.original.affisellFeeCents)}</span>
        ),
      },
      {
        accessorKey: "splitStatus",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.splitStatus]} className="w-fit text-xs">
            {row.original.splitStatus}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const o = row.original
          const busy = pendingId === o.orderId
          const canResettle = o.splitStatus === "PARTIAL" || o.splitStatus === "FAILED"
          const onboardingAcct = o.onboardingAccountId

          return (
            <div className="flex flex-wrap gap-1">
              {canResettle ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setPendingId(o.orderId)
                    startTransition(async () => {
                      try {
                        const res = await fetch("/api/admin/resettle", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ orderId: o.orderId }),
                        })
                        const data = (await res.json()) as { error?: string }
                        if (!res.ok) throw new Error(data.error ?? "Resettle failed")
                        toast.success("Resettle lancé")
                        router.refresh()
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
              {o.needsOnboarding && onboardingAcct ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setPendingId(o.orderId)
                    startTransition(async () => {
                      try {
                        const res = await fetch("/api/admin/stripe-health/send-onboarding", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ accountId: onboardingAcct }),
                        })
                        const data = (await res.json()) as { url?: string; error?: string }
                        if (!res.ok) throw new Error(data.error ?? "Link failed")
                        if (data.url) window.open(data.url, "_blank")
                        toast.success("Account link ouvert")
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erreur")
                      } finally {
                        setPendingId(null)
                      }
                    })
                  }}
                >
                  AccountLink
                </Button>
              ) : null}
            </div>
          )
        },
      },
    ],
    [pendingId, router, startTransition]
  )

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const qs = params.toString()
    router.push(qs ? `/admin/splits?${qs}` : "/admin/splits")
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Splits Stripe</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {summary.blocked > 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {summary.blocked} commande(s) avec fonds potentiellement bloqués
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-300">Aucun split bloqué sur la période</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Orders
          </Link>
          <Link
            href="/admin/stripe-health"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Stripe health
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {SPLIT_DISPLAY_STATUSES.map((s) => (
          <Badge key={s} variant={STATUS_VARIANT[s]}>
            {s}: {summary[s]}
          </Badge>
        ))}
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4"
      >
        <div>
          <label htmlFor="split-status" className="mb-1 block text-xs font-medium text-zinc-600">
            Status
          </label>
          <select
            id="split-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SplitDisplayStatus | "all")}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="all">Tous</option>
            {SPLIT_DISPLAY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="split-from" className="mb-1 block text-xs font-medium text-zinc-600">
            Du
          </label>
          <Input id="split-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="split-to" className="mb-1 block text-xs font-medium text-zinc-600">
            Au
          </label>
          <Input id="split-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm">
            Filtrer
          </Button>
        </div>
      </form>

      <DataTable data={rows} columns={columns} emptyMessage="Aucun split sur cette période." />
    </div>
  )
}
