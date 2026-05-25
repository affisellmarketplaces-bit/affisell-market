"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageCircle, Timer } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { SHIP_EXTENSION_DEFAULT_EXTRA_DAYS } from "@/lib/supplier-ship-sla-shared"
import type { FulfillmentThreadPublic } from "@/lib/orders/ship-fulfillment-shared"
import { cn } from "@/lib/utils"

type Props = {
  orderId: string
  className?: string
  onUpdated?: () => void
}

export function SupplierOrderFulfillmentPanel({ orderId, className, onUpdated }: Props) {
  const t = useTranslations("supplierOrders.fulfillment")
  const [thread, setThread] = useState<FulfillmentThreadPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [reason, setReason] = useState("")
  const [extraDays, setExtraDays] = useState(SHIP_EXTENSION_DEFAULT_EXTRA_DAYS)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}/fulfillment`, { cache: "no-store" })
      const j = (await res.json()) as { thread?: FulfillmentThreadPublic; error?: string }
      if (!res.ok) throw new Error(j.error ?? "load_failed")
      setThread(j.thread ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = (await res.json()) as { thread?: FulfillmentThreadPublic; error?: string }
      if (!res.ok) throw new Error(j.error ?? "failed")
      setThread(j.thread ?? null)
      setMessage("")
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <p className={cn("flex items-center gap-2 text-xs text-zinc-500", className)}>
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    )
  }

  if (!thread) return null

  const ext = thread.extension
  const showExtensionForm =
    ext?.canSupplierRequest && thread.pastInitialDeadline && ext.status !== "PENDING"

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-violet-200/80 bg-violet-50/30 p-3 dark:border-violet-900/50 dark:bg-violet-950/20",
        className
      )}
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
        <MessageCircle className="size-3.5" aria-hidden />
        {t("title")}
      </p>

      {thread.messages.length > 0 ? (
        <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
          {thread.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-lg px-2.5 py-2",
                m.authorRole === "SUPPLIER"
                  ? "bg-white/80 text-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100"
                  : "bg-cyan-100/80 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100"
              )}
            >
              <span className="text-[10px] font-bold uppercase opacity-70">
                {m.authorRole === "SUPPLIER" ? t("seller") : t("buyer")}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("noMessages")}</p>
      )}

      <div className="space-y-2">
        <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{t("messageLabel")}</label>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || message.trim().length < 8}
          onClick={() => void post({ action: "message", body: message.trim() })}
        >
          {t("sendMessage")}
        </Button>
      </div>

      {ext?.status === "PENDING" ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <Timer className="size-3.5 shrink-0" aria-hidden />
          {t("pendingBuyer", { days: ext.extraDays })}
        </p>
      ) : null}

      {ext?.status === "ACCEPTED" && ext.newDeadlineAt ? (
        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
          {t("accepted", { date: new Date(ext.newDeadlineAt).toLocaleDateString() })}
        </p>
      ) : null}

      {ext?.status === "REJECTED" ? (
        <p className="text-xs font-medium text-red-800 dark:text-red-200">{t("rejected")}</p>
      ) : null}

      {showExtensionForm ? (
        <div className="space-y-2 border-t border-violet-200/60 pt-3 dark:border-violet-800">
          <p className="text-xs font-medium text-violet-900 dark:text-violet-100">{t("extensionIntro")}</p>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            {t("extraDaysLabel")}
            <input
              type="number"
              min={3}
              max={14}
              value={extraDays}
              onChange={(e) => setExtraDays(Number(e.target.value))}
              className="w-16 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={busy || reason.trim().length < 20}
            className="bg-violet-600 text-white hover:bg-violet-700"
            onClick={() =>
              void post({
                action: "request_extension",
                reason: reason.trim(),
                extraDays,
              })
            }
          >
            {t("requestExtension")}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}
