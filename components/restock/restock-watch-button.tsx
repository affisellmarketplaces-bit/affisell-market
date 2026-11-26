"use client"

import { BellRing, Check } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { requestPriceAlertPushSubscription } from "@/components/push/request-price-alert-push"

type Choice = { listingId: string; color: string | null; size: string | null; storage: string | null }
type Status = { mode: "off" | "observe" | "enforce"; watching: boolean; watchId: string | null; signedIn: boolean }

function query(c: Choice): string {
  const p = new URLSearchParams({ listingId: c.listingId })
  if (c.color) p.set("color", c.color)
  if (c.size) p.set("size", c.size)
  if (c.storage) p.set("storage", c.storage)
  return p.toString()
}

/**
 * « Prévenez-moi au retour de cette taille » — shown only for ONE exact variant that is sold out now, and only when the
 * feature is not `off`. Explicit opt-in: the click asks the browser's notification permission first, and the request is
 * recorded only once it is granted (no request without a way to tell the buyer). Never promises a date. A second click
 * cancels it.
 */
export function RestockWatchButton({ choice }: { choice: Choice }) {
  const t = useTranslations("restockWatch")
  const locale = useLocale()
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const key = query(choice)

  useEffect(() => {
    let alive = true
    setNote(null)
    fetch(`/api/restock-watch?${key}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && typeof j.mode === "string") setStatus({ mode: j.mode, watching: Boolean(j.watching), watchId: j.watchId ?? null, signedIn: Boolean(j.signedIn) })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [key])

  const toggle = useCallback(async () => {
    if (!status || busy) return
    setBusy(true)
    setNote(null)
    try {
      if (status.watching && status.watchId) {
        const r = await fetch("/api/restock-watch", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watchId: status.watchId }),
        })
        if (r.ok) {
          setStatus({ ...status, watching: false, watchId: null })
          setNote(t("cancelled"))
        } else setNote(t("error"))
        return
      }
      const permission = await requestPriceAlertPushSubscription()
      if (permission !== "granted") {
        setNote(permission === "denied" ? t("pushDenied") : t("pushUnsupported"))
        return
      }
      const r = await fetch("/api/restock-watch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...choice, locale }),
      })
      const j = (await r.json().catch(() => null)) as { ok?: boolean; watchId?: string; error?: string } | null
      if (r.ok && j?.watchId) {
        setStatus({ ...status, watching: true, watchId: j.watchId })
        setNote(status.mode === "enforce" ? t("saved") : t("savedNotActive"))
      } else if (j?.error === "available_now") setNote(t("availableNow"))
      else if (j?.error === "too_many") setNote(t("tooMany"))
      else setNote(t("error"))
    } catch {
      setNote(t("error"))
    } finally {
      setBusy(false)
    }
  }, [status, busy, choice, locale, t])

  if (!status || status.mode === "off") return null
  if (!status.signedIn) {
    const back = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
        {t("signInPrompt")}{" "}
        <a className="font-semibold underline" href={`/login?callbackUrl=${encodeURIComponent(back)}`}>
          {t("signIn")}
        </a>
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={status.watching}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        {status.watching ? <Check className="h-4 w-4" aria-hidden /> : <BellRing className="h-4 w-4" aria-hidden />}
        {status.watching ? t("watching") : t("cta")}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{note ?? (status.mode === "enforce" ? t("hint") : t("hintNotActive"))}</p>
    </div>
  )
}
