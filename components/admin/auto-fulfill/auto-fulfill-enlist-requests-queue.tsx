"use client"

import { useState } from "react"
import { Check, ExternalLink, Loader2, X } from "lucide-react"

import type { AutoBuyEnlistRequestDto } from "@/lib/auto-buy-enlist-request-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  requests: AutoBuyEnlistRequestDto[]
  onChanged: () => void
}

function eur(cents: number | null): string {
  if (cents == null) return "—"
  return `${(cents / 100).toFixed(2)} €`
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return "< 1 h"
  if (h < 48) return `${h} h`
  return `${Math.floor(h / 24)} j`
}

export function AutoFulfillEnlistRequestsQueue({ requests, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errById, setErrById] = useState<Record<string, string>>({})

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id)
    setErrById((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    try {
      const res = await fetch(`/api/admin/auto-fulfill/enlist-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: action === "reject" ? JSON.stringify({ reason: "rejected_by_admin" }) : undefined,
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErrById((prev) => ({ ...prev, [id]: body.error ?? `HTTP ${res.status}` }))
        return
      }
      onChanged()
    } catch {
      setErrById((prev) => ({ ...prev, [id]: "network_error" }))
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
        Aucune demande fournisseur en attente. Les Instant Enlist manuels restent disponibles.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {requests.map((row) => {
        const busy = busyId === row.id
        return (
          <li
            key={row.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {row.nameHint || `AE ${row.aeProductId}`}
                </p>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                  {relativeAge(row.createdAt)}
                </span>
              </div>
              <p className="truncate text-xs text-zinc-500">
                {row.supplierName || row.supplierEmail || row.supplierId}
                {row.wholesalePriceCents != null
                  ? ` · wholesale ${eur(row.wholesalePriceCents)}`
                  : null}
              </p>
              <a
                href={row.aeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-brand hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{row.aeProductId}</span>
              </a>
              {row.note ? (
                <p className="line-clamp-2 text-[11px] text-zinc-500">{row.note}</p>
              ) : null}
              {errById[row.id] ? (
                <p className="text-[11px] font-medium text-red-600">{errById[row.id]}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-8 gap-1 rounded-full text-xs"
                onClick={() => void act(row.id, "reject")}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5" aria-hidden />
                )}
                Refuser
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className={cn(
                  "h-8 gap-1 rounded-full bg-gradient-to-r from-brand to-cyan-500 text-xs text-white hover:opacity-95"
                )}
                onClick={() => void act(row.id, "approve")}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
                Approuver & enlist
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
