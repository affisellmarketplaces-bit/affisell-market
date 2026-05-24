"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DataTable } from "@/components/admin/data-table"
import {
  STRIPE_HEALTH_STATUSES,
  type StripeHealthOrderRow,
  type StripeHealthStatus,
} from "@/lib/admin/stripe-health/types"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  initialOrders: StripeHealthOrderRow[]
  counts: Record<StripeHealthStatus, number>
}

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

const STATUS_LABEL: Record<StripeHealthStatus, string> = {
  paid: "Paid (split pending)",
  split_ok: "Split OK",
  split_failed: "Split failed",
  onboarding_required: "Onboarding required",
}

const STATUS_VARIANT: Record<StripeHealthStatus, "default" | "secondary" | "outline" | "accent" | "live"> = {
  paid: "secondary",
  split_ok: "live",
  split_failed: "accent",
  onboarding_required: "outline",
}

async function postJson<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

export function StripeHealthPageClient({ initialOrders, counts }: Props) {
  const [statusFilter, setStatusFilter] = useState<StripeHealthStatus | "all">("all")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const rows = useMemo(() => {
    if (statusFilter === "all") return initialOrders
    return initialOrders.filter((o) => o.stripeHealthStatus === statusFilter)
  }, [initialOrders, statusFilter])

  const columns = useMemo<ColumnDef<StripeHealthOrderRow, unknown>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-medium">{row.original.orderNumber}</span>
            <Link
              href={`/admin/orders/${row.original.id}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {row.original.id.slice(0, 12)}…
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "stripeHealthStatus",
        header: "Stripe health",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.stripeHealthStatus]} className="w-fit text-xs">
            {STATUS_LABEL[row.original.stripeHealthStatus]}
          </Badge>
        ),
      },
      {
        accessorKey: "totalCents",
        header: "Total",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{money(row.original.totalCents)}</span>
        ),
      },
      {
        id: "accounts",
        header: "Connect",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              S: {row.original.supplierAccountId?.slice(0, 12) ?? "—"}
              {row.original.supplierOnboarded ? " ✓" : " ✗"}
            </span>
            <span>
              A: {row.original.affiliateAccountId?.slice(0, 12) ?? "—"}
              {row.original.affiliateOnboarded ? " ✓" : " ✗"}
            </span>
          </div>
        ),
      },
      {
        id: "failure",
        header: "Error",
        cell: ({ row }) => {
          const f = row.original.failure
          if (!f) return <span className="text-xs text-zinc-400">—</span>
          return (
            <div className="max-w-xs space-y-1 text-xs">
              {f.errorCode ? (
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">{f.errorCode}</code>
              ) : null}
              {f.accountId ? (
                <div className="font-mono text-zinc-600 dark:text-zinc-400">{f.accountId}</div>
              ) : null}
              {f.stripeDashboardUrl ? (
                <a
                  href={f.stripeDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Stripe Dashboard →
                </a>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const o = row.original
          const accountForOnboarding = o.failure?.accountId ?? o.affiliateAccountId
          const busy = pendingId === o.id

          return (
            <div className="flex flex-wrap gap-2">
              {(o.stripeHealthStatus === "split_failed" ||
                o.stripeHealthStatus === "onboarding_required" ||
                o.stripeHealthStatus === "paid") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setPendingId(o.id)
                    startTransition(async () => {
                      try {
                        await postJson("/api/admin/resettle-order", { orderId: o.id })
                        toast.success("Resettle lancé", { description: o.orderNumber })
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Resettle failed")
                      } finally {
                        setPendingId(null)
                      }
                    })
                  }}
                >
                  Resettle
                </Button>
              )}
              {accountForOnboarding ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setPendingId(o.id)
                    startTransition(async () => {
                      try {
                        const res = await postJson<{ url: string }>(
                          "/api/admin/stripe-health/send-onboarding",
                          { accountId: accountForOnboarding }
                        )
                        toast.success("Lien onboarding", {
                          description: res.url,
                          action: {
                            label: "Ouvrir",
                            onClick: () => window.open(res.url, "_blank"),
                          },
                        })
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Onboarding link failed")
                      } finally {
                        setPendingId(null)
                      }
                    })
                  }}
                >
                  Send onboarding
                </Button>
              ) : null}
            </div>
          )
        },
      },
    ],
    [pendingId, startTransition]
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Stripe health
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Commandes des 7 derniers jours — split Connect & onboarding
          </p>
        </div>
        <Link href="/admin/orders" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Orders
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
        >
          Tous ({initialOrders.length})
        </Button>
        {STRIPE_HEALTH_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABEL[s]} ({counts[s]})
          </Button>
        ))}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        emptyMessage="Aucune commande sur cette période."
      />
    </div>
  )
}
