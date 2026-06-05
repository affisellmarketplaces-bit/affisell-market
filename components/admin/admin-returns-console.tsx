"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useMemo, useState, useTransition } from "react"
import { ExternalLink, Package, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import type {
  AdminReturnListRow,
  AdminReturnsQueueResponse,
  AdminReturnsStats,
} from "@/lib/admin/returns/load-returns-queue"
import { RETURN_REASON_LABELS, type OrderReturnStatus } from "@/lib/order-return-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StatusFilter = "active" | OrderReturnStatus | "all"

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "active", label: "Actifs" },
  { id: "REQUESTED", label: "Demandés" },
  { id: "AWAITING_SHIPMENT", label: "Expédition" },
  { id: "IN_TRANSIT", label: "Transit" },
  { id: "RECEIVED", label: "Reçus" },
  { id: "REFUNDED", label: "Remboursés" },
  { id: "REJECTED", label: "Refusés" },
  { id: "all", label: "Tous" },
]

const STATUS_BADGE: Record<string, string> = {
  REQUESTED: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  AWAITING_SHIPMENT: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  IN_TRANSIT: "border-violet-500/40 bg-violet-500/15 text-violet-100",
  RECEIVED: "border-indigo-500/40 bg-indigo-500/15 text-indigo-100",
  REFUNDED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  REJECTED: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  CANCELLED: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
}

type Props = {
  initial: AdminReturnsQueueResponse
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function formatEur(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </div>
  )
}

function reasonLabel(code: string) {
  const entry = RETURN_REASON_LABELS[code as keyof typeof RETURN_REASON_LABELS]
  return entry?.fr ?? code
}

export function AdminReturnsConsole({ initial }: Props) {
  const [stats, setStats] = useState<AdminReturnsStats>(initial.stats)
  const [rows, setRows] = useState<AdminReturnListRow[]>(initial.rows)
  const [filter, setFilter] = useState<StatusFilter>("active")
  const [selectedId, setSelectedId] = useState<string | null>(initial.rows[0]?.id ?? null)
  const [pending, startTransition] = useTransition()

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])

  const loadQueue = useCallback(async (status: StatusFilter) => {
    const res = await fetch(`/api/admin/returns?status=${status}`, { credentials: "include" })
    const data = (await res.json()) as AdminReturnsQueueResponse & { error?: string }
    if (!res.ok) throw new Error(data.error ?? "load_failed")
    setStats(data.stats)
    setRows(data.rows)
    if (data.rows.length > 0 && !data.rows.some((r) => r.id === selectedId)) {
      setSelectedId(data.rows[0]?.id ?? null)
    }
  }, [selectedId])

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        await loadQueue(filter)
        toast.success("File retours actualisée")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      }
    })
  }, [filter, loadQueue])

  const changeFilter = useCallback(
    (next: StatusFilter) => {
      setFilter(next)
      startTransition(async () => {
        try {
          await loadQueue(next)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erreur")
        }
      })
    },
    [loadQueue]
  )

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.14),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400/90">
              <Package className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">Returns Ops</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Retours acheteurs</h1>
            <p className="mt-1 text-sm text-zinc-400">Vue cross-supplier — traitement côté marchand.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={pending}
            className="border-white/15 bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", pending && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          <StatTile label="Demandés" value={stats.requested} tone="text-amber-300" />
          <StatTile label="Expédition" value={stats.awaitingShipment} tone="text-sky-300" />
          <StatTile label="Transit" value={stats.inTransit} tone="text-violet-300" />
          <StatTile label="Reçus" value={stats.received} tone="text-indigo-300" />
          <StatTile label="Clôturés" value={stats.terminal} tone="text-emerald-300" />
        </div>

        <div className="mt-6 flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeFilter(tab.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                filter === tab.id
                  ? "bg-amber-500/20 text-amber-100"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="max-h-[calc(100dvh-18rem)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02]">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">Aucun retour dans cette file.</p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "w-full border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.04]",
                    selectedId === row.id && "bg-amber-500/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{row.order.productName}</p>
                    <Badge className={cn("shrink-0 text-[10px]", STATUS_BADGE[row.status] ?? "")}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">{row.order.customerEmail ?? "—"}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{formatWhen(row.createdAt)}</p>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md">
            {!selected ? (
              <p className="text-sm text-zinc-500">Sélectionnez un retour.</p>
            ) : (
              <>
                <div className="flex gap-4">
                  {selected.order.productImageUrl ? (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10">
                      <Image
                        src={selected.order.productImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{selected.order.productName}</h2>
                    <Badge className={cn("mt-1", STATUS_BADGE[selected.status])}>{selected.status}</Badge>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-600">Acheteur</dt>
                    <dd className="text-zinc-200">{selected.order.customerEmail ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-600">Fournisseur</dt>
                    <dd className="text-zinc-200">{selected.order.supplierEmail ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-600">Motif</dt>
                    <dd className="text-zinc-200">{reasonLabel(selected.reasonCode)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-600">Montant demandé</dt>
                    <dd className="font-medium text-amber-200">{formatEur(selected.requestedRefundCents)}</dd>
                  </div>
                  {selected.sellerRespondByAt ? (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-zinc-600">SLA vendeur</dt>
                      <dd className="text-zinc-200">{formatWhen(selected.sellerRespondByAt)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-600">Créé</dt>
                    <dd className="text-zinc-200">{formatWhen(selected.createdAt)}</dd>
                  </div>
                </dl>

                {selected.reasonDetail ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Détail</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{selected.reasonDetail}</p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/orders/${selected.order.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-500"
                  >
                    Commande admin <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                  <p className="w-full text-xs text-zinc-600">
                    Actions vendeur (approuver / refuser) restent dans le dashboard fournisseur.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
