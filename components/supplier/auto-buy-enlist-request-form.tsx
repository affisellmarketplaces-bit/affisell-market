"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Inbox, Loader2, Send, X } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import type { AutoBuyEnlistRequestDto } from "@/lib/auto-buy-enlist-request-types"
import { blockIfHoneypot } from "@/lib/security/honeypot-client"
import { cn } from "@/lib/utils"

import { HoneypotField } from "@/components/security/honeypot-field"

const STATUS_TONE: Record<string, string> = {
  PENDING_REVIEW: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  APPROVED: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  REJECTED: "border-red-400/40 bg-red-500/15 text-red-200",
  CANCELLED: "border-zinc-400/30 bg-zinc-500/10 text-zinc-400",
}

export function AutoBuyEnlistRequestForm() {
  const t = useTranslations("supplierDashboard.autoBuyPilot.enlistRequest")
  const [aeUrl, setAeUrl] = useState("")
  const [nameHint, setNameHint] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [requests, setRequests] = useState<AutoBuyEnlistRequestDto[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/supplier/auto-buy-enlist-requests", {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await res.json()) as {
        ok?: boolean
        requests?: AutoBuyEnlistRequestDto[]
      }
      if (res.ok && data.ok && Array.isArray(data.requests)) {
        setRequests(data.requests)
      }
    } catch {
      /* keep previous */
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (blockIfHoneypot(formData)) {
      toast.error("Bot detected")
      return
    }
    const url = aeUrl.trim()
    if (!url) {
      toast.error(t("urlRequired"))
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/supplier/auto-buy-enlist-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          aeUrl: url,
          nameHint: nameHint.trim() || null,
          note: note.trim() || null,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; created?: boolean }
      if (!res.ok || !data.ok) {
        const code = data.error ?? "submit_failed"
        if (code === "invalid_aliexpress_url") toast.error(t("invalidUrl"))
        else if (code === "already_approved") toast.error(t("alreadyApproved"))
        else toast.error(t("submitError"))
        return
      }
      toast.success(data.created ? t("submitOk") : t("alreadyPending"))
      setAeUrl("")
      setNameHint("")
      setNote("")
      await refresh()
    } catch {
      toast.error(t("submitError"))
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/supplier/auto-buy-enlist-requests/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(t("cancelError"))
        return
      }
      toast.success(t("cancelOk"))
      await refresh()
    } catch {
      toast.error(t("cancelError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15">
          <Inbox className="h-4 w-4 text-cyan-300" aria-hidden />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold tracking-tight text-white">{t("title")}</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{t("subtitle")}</p>
        </div>
      </div>

      <form onSubmit={(e) => void submit(e)} className="relative space-y-3">
        <HoneypotField />
        <div>
          <label htmlFor="ae-enlist-url" className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("urlLabel")}
          </label>
          <input
            id="ae-enlist-url"
            type="url"
            value={aeUrl}
            onChange={(e) => setAeUrl(e.target.value)}
            placeholder={t("urlPlaceholder")}
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
            disabled={busy}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ae-enlist-name" className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("nameLabel")}
            </label>
            <input
              id="ae-enlist-name"
              type="text"
              value={nameHint}
              onChange={(e) => setNameHint(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="ae-enlist-note" className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("noteLabel")}
            </label>
            <input
              id="ae-enlist-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              disabled={busy}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-95 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden />
          )}
          {t("submit")}
        </button>
      </form>

      <div className="border-t border-white/10 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {t("historyTitle")}
        </p>
        {loadingList ? (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            …
          </p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-zinc-500">{t("historyEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {requests.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {row.nameHint || row.aeProductId}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500">{row.aeProductId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      STATUS_TONE[row.status] ?? STATUS_TONE.CANCELLED
                    )}
                  >
                    {t(`status.${row.status}`)}
                  </span>
                  {row.status === "PENDING_REVIEW" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void cancel(row.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                      aria-label={t("cancel")}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
