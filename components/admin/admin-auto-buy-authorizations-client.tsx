"use client"

import { useMemo, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import type { SupplierChannelType } from "@prisma/client"

import type {
  AdminAutoBuyAuthorizationsResponse,
  AdminAutoBuySupplierRow,
} from "@/lib/admin/suppliers/load-auto-buy-authorizations"
import { hasLiveAutoBuyIntegration } from "@/lib/auto-buy-sourcing-channels"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const CHANNEL_LABEL: Record<string, string> = {
  ALIEXPRESS: "AliExpress",
  CJ_DROPSHIPPING: "CJ Dropshipping",
  BIGBUY: "BigBuy",
  ZENDROP: "Zendrop",
  TEMU: "Temu",
  AMAZON: "Amazon",
  TIKTOK_SHOP: "TikTok Shop",
}

async function fetcher(url: string): Promise<AdminAutoBuyAuthorizationsResponse> {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error("load_failed")
  return res.json()
}

function GrantCell({
  supplierId,
  channel,
  granted,
  live,
  busy,
  onToggle,
}: {
  supplierId: string
  channel: SupplierChannelType
  granted: boolean
  live: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={granted}
      aria-label={`${CHANNEL_LABEL[channel] ?? channel} — ${supplierId}`}
      disabled={busy}
      onClick={onToggle}
      title={live ? undefined : "Pas encore d'intégration réelle — bascule sur le mode manuel"}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        granted
          ? live
            ? "border-emerald-500/60 bg-emerald-600"
            : "border-amber-500/60 bg-amber-500"
          : "border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          granted ? "translate-x-4.5" : "translate-x-0.5"
        )}
        aria-hidden
      />
    </button>
  )
}

export function AdminAutoBuyAuthorizationsClient({
  initial,
}: {
  initial: AdminAutoBuyAuthorizationsResponse
}) {
  const { mutate } = useSWRConfig()
  const [query, setQuery] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const { data } = useSWR("/api/admin/suppliers/auto-buy-authorizations", fetcher, {
    fallbackData: initial,
    revalidateOnFocus: true,
  })

  const channels = data?.channels ?? initial.channels

  const filtered = useMemo(() => {
    const rows = data?.rows ?? []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r: AdminAutoBuySupplierRow) =>
        r.email.toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.storeName ?? "").toLowerCase().includes(q)
    )
  }, [data, query])

  async function toggle(supplierId: string, channelType: SupplierChannelType, next: boolean) {
    const key = `${supplierId}:${channelType}`
    setBusyKey(key)
    try {
      const res = await fetch("/api/admin/suppliers/auto-buy-authorizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ supplierId, channelType, enabled: next }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error ?? "failed")
      toast.success(
        next
          ? `${CHANNEL_LABEL[channelType] ?? channelType} autorisé.`
          : `${CHANNEL_LABEL[channelType] ?? channelType} révoqué.`
      )
      await mutate("/api/admin/suppliers/auto-buy-authorizations")
    } catch {
      toast.error("Échec de la mise à jour.")
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Autorisations d&apos;auto-achat
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Chaque interrupteur autorise ce fournisseur à activer l&apos;auto-achat sur ce canal — Affisell
            dépense alors de l&apos;argent réel en son nom. Les canaux en orange n&apos;ont pas encore
            d&apos;intégration réelle (le job tombe en mode manuel).
          </p>
        </div>
        <Input
          placeholder="Rechercher un fournisseur…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Fournisseur</th>
              <th className="px-3 py-2.5 font-semibold">SKU liés</th>
              {channels.map((c) => (
                <th key={c} className="px-3 py-2.5 text-center font-semibold">
                  {CHANNEL_LABEL[c] ?? c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2 + channels.length} className="px-4 py-8 text-center text-zinc-500">
                  Aucun fournisseur.
                </td>
              </tr>
            ) : (
              filtered.map((row: AdminAutoBuySupplierRow) => (
                <tr key={row.userId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {row.storeName ?? row.name ?? row.email}
                    </p>
                    <p className="text-xs text-zinc-500">{row.email}</p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {row.linkedSkuCount}
                  </td>
                  {channels.map((channel) => (
                    <td key={channel} className="px-3 py-2.5 text-center">
                      <GrantCell
                        supplierId={row.userId}
                        channel={channel}
                        granted={Boolean(row.authorized[channel])}
                        live={hasLiveAutoBuyIntegration(channel)}
                        busy={busyKey === `${row.userId}:${channel}`}
                        onToggle={() =>
                          void toggle(row.userId, channel, !row.authorized[channel])
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
