"use client"

import { Bell, Loader2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import { cn } from "@/lib/utils"

type Props = {
  country: string
  className?: string
  compact?: boolean
}

export function CheckoutLaunchWaitlistForm({ country, className, compact = false }: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.checkoutRegion.waitlist")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const res = await fetch("/api/market/launch-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, country, locale, website: "" }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(t(`error.${data.error ?? "generic"}`))
        return
      }
      setDone(true)
    } catch {
      setError(t("error.generic"))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p
        className={cn(
          "rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-50",
          className
        )}
        role="status"
      >
        {t("success")}
      </p>
    )
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={cn("flex w-full flex-col gap-2", className)}>
      <label htmlFor={`launch-waitlist-${country}`} className="sr-only">
        {t("emailLabel")}
      </label>
      <input
        id={`launch-waitlist-${country}`}
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className={cn(
          "w-full rounded-xl border border-amber-300/25 bg-black/20 px-3 text-sm text-white placeholder:text-amber-100/50 focus:border-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400/30",
          compact ? "py-2" : "py-2.5"
        )}
      />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:border-amber-200/50 hover:bg-amber-500/30 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Bell className="size-3.5 shrink-0" aria-hidden />}
        {busy ? t("submitting") : t("submit")}
      </button>
      {error ? (
        <p className="text-[11px] font-medium text-rose-200/90" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
