"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, Lock } from "lucide-react"

type State = "none" | "requested" | "mine" | "other"

const KNOWN_ERRORS = new Set([
  "already_exclusive",
  "already_requested",
  "no_store",
  "own_product",
  "product_not_found",
])

/**
 * Reseller side of per-product exclusivity, shown while adding a product to the store: ask the supplier for it,
 * withdraw the request, or release an exclusivity already held.
 */
export function AffiliateExclusivityPanel({ productId }: { productId: string }) {
  const t = useTranslations("productExclusivity.affiliate")
  const locale = useLocale()
  const [state, setState] = useState<State | null>(null)
  const [until, setUntil] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState("")
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const endpoint = `/api/affiliate/products/${encodeURIComponent(productId)}/exclusivity`

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { state: State; until: string | null }
      setState(data.state)
      setUntil(data.until)
    } catch {
      /* the panel is optional: stay hidden if the state cannot be read */
    }
  }, [endpoint])

  useEffect(() => {
    setState(null)
    setNotice(null)
    setComposing(false)
    void load()
  }, [load])

  async function run(method: "POST" | "DELETE", okKey: "sent" | "released" | "withdrawn") {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ message: message.trim() || undefined }) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; released?: boolean; cancelled?: boolean }
      if (res.ok) {
        setNotice({ tone: "ok", text: t(method === "DELETE" ? (data.cancelled ? "withdrawn" : "released") : okKey) })
        setComposing(false)
        setMessage("")
        await load()
      } else {
        setNotice({
          tone: "error",
          text: t(`errors.${data.error && KNOWN_ERRORS.has(data.error) ? data.error : "generic"}`),
        })
      }
    } catch {
      setNotice({ tone: "error", text: t("errors.generic") })
    } finally {
      setBusy(false)
    }
  }

  if (!state) return null

  return (
    <section
      data-testid="affiliate-exclusivity-panel"
      className="rounded-xl border border-violet-200/80 bg-violet-50/60 p-3 text-sm dark:border-violet-900/50 dark:bg-violet-950/20"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        <Lock className="size-3.5" aria-hidden />
        {t("title")}
      </p>

      {state === "none" ? (
        composing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t("messagePlaceholder")}
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm dark:border-violet-900 dark:bg-zinc-950"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("POST", "sent")}
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {t("send")}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-gray-700 dark:text-zinc-300">{t("none")}</p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="mt-2 rounded-full border border-violet-300 bg-white px-4 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
            >
              {t("request")}
            </button>
          </>
        )
      ) : null}

      {state === "requested" ? (
        <>
          <p className="mt-1 text-gray-700 dark:text-zinc-300">{t("requested")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("DELETE", "withdrawn")}
            className="mt-2 rounded-full border border-violet-300 bg-white px-4 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
          >
            {t("withdraw")}
          </button>
        </>
      ) : null}

      {state === "mine" ? (
        <>
          <p className="mt-1 font-medium text-violet-900 dark:text-violet-100">
            {t("mine", { date: until ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(until)) : "" })}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t("releaseConfirm"))) void run("DELETE", "released")
            }}
            className="mt-2 rounded-full border border-violet-300 bg-white px-4 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
          >
            {t("release")}
          </button>
        </>
      ) : null}

      {state === "other" ? <p className="mt-1 text-gray-700 dark:text-zinc-300">{t("other")}</p> : null}

      {notice ? (
        <p role="status" className={`mt-2 text-xs ${notice.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {notice.text}
        </p>
      ) : null}
    </section>
  )
}
