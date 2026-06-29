"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { Loader2, Search, Zap } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import type {
  AdminLightningSupplierRow,
  AdminLightningSuppliersResponse,
} from "@/lib/admin/suppliers/lightning-types"
import { DataTable } from "@/components/admin/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  initial: AdminLightningSuppliersResponse
}

function LightningSwitch({
  on,
  busy,
  onChange,
}: {
  on: boolean
  busy: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Lightning Payout"
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "border-violet-500/50 bg-violet-600"
          : "border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}

export function AdminLightningSuppliersClient({ initial }: Props) {
  const [rows, setRows] = useState(initial.rows)
  const [counts, setCounts] = useState(initial.counts)
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const haystack = [
        row.storeName,
        row.email,
        row.name,
        row.partnerListingCode,
        row.storeSlug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  async function refresh() {
    const res = await fetch("/api/admin/suppliers/lightning", { credentials: "include" })
    const data = (await res.json()) as AdminLightningSuppliersResponse & { error?: string }
    if (!res.ok) throw new Error(data.error ?? "refresh_failed")
    setRows(data.rows)
    setCounts(data.counts)
  }

  async function toggleLightning(row: AdminLightningSupplierRow, next: boolean) {
    setBusyId(row.userId)
    try {
      const res = await fetch(`/api/admin/suppliers/${row.userId}/lightning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lightningEnabled: next }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        lightningEnabled?: boolean
        lightningAdminOverride?: boolean
        trustScore?: number
      }
      if (!res.ok) {
        toast.error(data.error ?? "Mise à jour impossible")
        return
      }

      setRows((prev) =>
        prev.map((item) =>
          item.userId === row.userId
            ? {
                ...item,
                lightningEnabled: data.lightningEnabled ?? next,
                lightningAdminOverride: data.lightningAdminOverride ?? next,
                trustScore: data.trustScore ?? item.trustScore,
              }
            : item
        )
      )
      startTransition(() => {
        void refresh().catch(() => undefined)
      })
      toast.success(
        next
          ? `Lightning activé — ${row.storeName ?? row.email}`
          : `Lightning désactivé — ${row.storeName ?? row.email}`
      )
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<AdminLightningSupplierRow, unknown>[]>(
    () => [
      {
        id: "store",
        header: "Boutique",
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.original.storeName ?? "—"}
            </p>
            <p className="text-xs text-zinc-500">{row.original.email}</p>
            {row.original.partnerListingCode ? (
              <p className="mt-0.5 font-mono text-[10px] text-violet-600 dark:text-violet-400">
                {row.original.partnerListingCode}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "trustScore",
        header: "Score",
        cell: ({ row }) => (
          <span
            className={cn(
              "tabular-nums font-semibold",
              row.original.trustScore >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : row.original.trustScore >= 50
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-rose-600 dark:text-rose-400"
            )}
          >
            {row.original.trustScore}/100
          </span>
        ),
      },
      {
        id: "stripe",
        header: "Stripe",
        cell: ({ row }) =>
          row.original.stripeAccountId ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              {row.original.stripeAccountId.slice(0, 14)}…
            </Badge>
          ) : (
            <span className="text-xs text-zinc-400">Non connecté</span>
          ),
      },
      {
        id: "status",
        header: "Statut",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.lightningEnabled ? (
              <Badge className="gap-1 bg-violet-600 text-white hover:bg-violet-600">
                <Zap className="size-3" aria-hidden />
                ON
              </Badge>
            ) : (
              <Badge variant="secondary">OFF</Badge>
            )}
            {row.original.lightningAdminOverride ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                Admin
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Lightning",
        cell: ({ row }) => {
          const busy = busyId === row.original.userId
          return (
            <div className="flex items-center gap-2">
              {busy ? <Loader2 className="size-4 animate-spin text-zinc-400" aria-hidden /> : null}
              <LightningSwitch
                on={row.original.lightningEnabled}
                busy={busy}
                onChange={(next) => void toggleLightning(row.original, next)}
              />
            </div>
          )
        },
      },
      {
        id: "shop",
        header: "",
        cell: ({ row }) =>
          row.original.storeSlug ? (
            <Link
              href={`/shops/${row.original.storeSlug}`}
              className="text-xs text-violet-700 hover:underline dark:text-violet-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Voir boutique →
            </Link>
          ) : null,
      },
    ],
    [busyId]
  )

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            Admin · Payouts
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Lightning Payout — boutiques fournisseur
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Activez Lightning pour une boutique sans attendre le score de confiance. Le badge
            storefront (score ≥ 80) et les payouts Stripe Connect restent soumis aux comptes
            connectés.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Fournisseurs" value={counts.total} />
          <StatCard label="Lightning ON" value={counts.lightningOn} tone="violet" />
          <StatCard label="Override admin" value={counts.adminOverride} tone="amber" />
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher boutique, email, AFS-…"
            className="pl-9"
          />
        </div>

        <DataTable columns={columns} data={filtered} emptyMessage="Aucun fournisseur trouvé." />
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "violet" | "amber"
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "violet"
            ? "text-violet-700 dark:text-violet-300"
            : tone === "amber"
              ? "text-amber-700 dark:text-amber-300"
              : "text-zinc-900 dark:text-white"
        )}
      >
        {value}
      </p>
    </div>
  )
}
