"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { FulfillmentThreadPublic } from "@/lib/orders/ship-fulfillment-shared"
import { cn } from "@/lib/utils"

type Props = {
  orderId: string
  lang: "en" | "fr"
  className?: string
}

const copy = {
  en: {
    loading: "Loading…",
    title: "Shipping update",
    seller: "Seller",
    buyer: "You",
    extensionAsk: "The seller requests {days} extra days to ship:",
    accept: "Accept extra time",
    reject: "Refuse (order may be cancelled)",
    notePlaceholder: "Optional note to the seller",
    reply: "Reply to seller",
    send: "Send",
    messagePlaceholder: "Your message…",
    accepted: "You accepted the extension.",
    rejected: "You refused the extension.",
  },
  fr: {
    loading: "Chargement…",
    title: "Suivi expédition",
    seller: "Vendeur",
    buyer: "Vous",
    extensionAsk: "Le vendeur demande {days} jours supplémentaires :",
    accept: "Accepter le délai",
    reject: "Refuser (la commande peut être annulée)",
    notePlaceholder: "Note optionnelle au vendeur",
    reply: "Répondre au vendeur",
    send: "Envoyer",
    messagePlaceholder: "Votre message…",
    accepted: "Vous avez accepté le délai.",
    rejected: "Vous avez refusé le délai.",
  },
} as const

export function AccountOrderFulfillmentPanel({ orderId, lang, className }: Props) {
  const t = copy[lang]
  const [thread, setThread] = useState<FulfillmentThreadPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/account/orders/${orderId}/fulfillment`, { cache: "no-store" })
      if (!res.ok) return
      const j = (await res.json()) as { thread?: FulfillmentThreadPublic }
      setThread(j.thread ?? null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/account/orders/${orderId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <p className={cn("flex items-center gap-2 text-xs text-zinc-500", className)}>
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t.loading}
      </p>
    )
  }

  if (!thread) return null
  const ext = thread.extension
  const show =
    ext?.canBuyerRespond ||
    (ext?.status === "PENDING" && ext.reason) ||
    thread.messages.length > 0 ||
    (thread.pastInitialDeadline && !thread.hasTracking)

  if (!show) return null

  return (
    <div
      className={cn(
        "mt-4 space-y-3 rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/25",
        className
      )}
    >
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>

      {thread.messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            m.authorRole === "SUPPLIER"
              ? "bg-white dark:bg-zinc-900"
              : "bg-cyan-100/80 dark:bg-cyan-950/40"
          )}
        >
          <span className="text-[10px] font-bold uppercase opacity-70">
            {m.authorRole === "SUPPLIER" ? t.seller : t.buyer}
          </span>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}

      {ext?.status === "PENDING" && ext.reason ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-950 dark:text-amber-100">
            {t.extensionAsk.replace("{days}", String(ext.extraDays))}
          </p>
          <p className="text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{ext.reason}</p>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void post({ action: "accept_extension", note: note.trim() || undefined })}
            >
              {t.accept}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void post({ action: "reject_extension", note: note.trim() || undefined })}
            >
              {t.reject}
            </Button>
          </div>
        </div>
      ) : null}

      {ext?.status === "ACCEPTED" ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">{t.accepted}</p>
      ) : null}
      {ext?.status === "REJECTED" ? (
        <p className="text-xs text-red-700 dark:text-red-300">{t.rejected}</p>
      ) : null}

      {!ext?.canBuyerRespond && thread.pastInitialDeadline ? (
        <div className="space-y-2 border-t border-violet-200/60 pt-2 dark:border-violet-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{t.reply}</p>
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.messagePlaceholder}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || message.trim().length < 8}
            onClick={() => void post({ action: "message", body: message.trim() })}
          >
            {t.send}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
