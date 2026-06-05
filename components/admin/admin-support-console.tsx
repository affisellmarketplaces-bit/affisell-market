"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { ExternalLink, Headphones, Mail, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import type {
  AdminSupportQueueResponse,
  AdminSupportStats,
  AdminSupportTicketRow,
} from "@/lib/admin/support/load-support-queue"
import type { SupportTicketStatus } from "@/lib/admin/support-ticket-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StatusFilter = "active" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "SPAM" | "all"

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "active", label: "Actifs" },
  { id: "OPEN", label: "Ouverts" },
  { id: "IN_PROGRESS", label: "En cours" },
  { id: "RESOLVED", label: "Résolus" },
  { id: "SPAM", label: "Spam" },
  { id: "all", label: "Tous" },
]

const STATUS_BADGE: Record<SupportTicketStatus, string> = {
  OPEN: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  IN_PROGRESS: "border-violet-500/40 bg-violet-500/15 text-violet-100",
  RESOLVED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  SPAM: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
}

type Props = {
  initial: AdminSupportQueueResponse
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

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </div>
  )
}

export function AdminSupportConsole({ initial }: Props) {
  const [stats, setStats] = useState<AdminSupportStats>(initial.stats)
  const [rows, setRows] = useState<AdminSupportTicketRow[]>(initial.rows)
  const [filter, setFilter] = useState<StatusFilter>("active")
  const [selectedId, setSelectedId] = useState<string | null>(initial.rows[0]?.id ?? null)
  const [adminNote, setAdminNote] = useState("")
  const [pending, startTransition] = useTransition()
  const [acting, setActing] = useState(false)

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const loadQueue = useCallback(async (status: StatusFilter) => {
    const res = await fetch(`/api/admin/support-tickets?status=${status}`, { credentials: "include" })
    const data = (await res.json()) as AdminSupportQueueResponse & { error?: string }
    if (!res.ok) throw new Error(data.error ?? "load_failed")
    setStats(data.stats)
    setRows(data.rows)
    if (data.rows.length > 0 && !data.rows.some((r) => r.id === selectedId)) {
      setSelectedId(data.rows[0]?.id ?? null)
    }
  }, [selectedId])

  useEffect(() => {
    if (selected) setAdminNote(selected.adminNote ?? "")
  }, [selected?.id, selected?.adminNote])

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        await loadQueue(filter)
        toast.success("Inbox actualisée")
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

  const patchTicket = useCallback(
    async (status: SupportTicketStatus) => {
      if (!selectedId) return
      setActing(true)
      try {
        const res = await fetch(`/api/admin/support-tickets/${selectedId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, adminNote: adminNote.trim() || undefined }),
        })
        const body = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(body.error ?? "update_failed")
        toast.success("Ticket mis à jour")
        await loadQueue(filter)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible")
      } finally {
        setActing(false)
      }
    },
    [selectedId, adminNote, loadQueue, filter]
  )

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.18),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sky-400/90">
              <Headphones className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">Support Inbox</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Tickets contact</h1>
            <p className="mt-1 text-sm text-zinc-400">Formulaire /contact persisté + email Resend.</p>
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

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatTile label="Ouverts" value={stats.open} tone="text-sky-300" />
          <StatTile label="En cours" value={stats.inProgress} tone="text-violet-300" />
          <StatTile label="Résolus" value={stats.resolved} tone="text-emerald-300" />
          <StatTile label="Spam" value={stats.spam} tone="text-zinc-400" />
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
                  ? "bg-sky-500/20 text-sky-100"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="max-h-[calc(100dvh-18rem)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02]">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">Aucun ticket dans cette file.</p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "w-full border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.04]",
                    selectedId === row.id && "bg-sky-500/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">#{row.ticketRef}</p>
                    <Badge className={cn("shrink-0 text-[10px]", STATUS_BADGE[row.status])}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">{row.subject}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{formatWhen(row.createdAt)}</p>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md">
            {!selected ? (
              <p className="text-sm text-zinc-500">Sélectionnez un ticket.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">#{selected.ticketRef}</h2>
                    <p className="text-sm text-zinc-400">{selected.subject}</p>
                  </div>
                  <Badge className={STATUS_BADGE[selected.status]}>{selected.status}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    <a href={`mailto:${selected.email}`} className="hover:text-sky-300">
                      {selected.email}
                    </a>
                  </span>
                  <span className="text-zinc-500">· {selected.name}</span>
                  <span className="text-zinc-600">{formatWhen(selected.createdAt)}</span>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{selected.message}</p>
                </div>

                <label className="mt-5 block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Note interne
                  </span>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
                    placeholder="Contexte, actions prises…"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.status !== "IN_PROGRESS" && selected.status !== "RESOLVED" && (
                    <Button
                      size="sm"
                      disabled={acting}
                      onClick={() => void patchTicket("IN_PROGRESS")}
                      className="bg-violet-600 hover:bg-violet-500"
                    >
                      Prendre en charge
                    </Button>
                  )}
                  {selected.status !== "RESOLVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() => void patchTicket("RESOLVED")}
                      className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                    >
                      Résolu
                    </Button>
                  )}
                  {selected.status !== "SPAM" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={acting}
                      onClick={() => void patchTicket("SPAM")}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      Marquer spam
                    </Button>
                  )}
                  <Link
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                  >
                    Répondre <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
