"use client"

import { Check, Copy, Globe2, Link2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { cn } from "@/lib/utils"

type StoreUrls = {
  primaryUrl: string
  subdomainUrl: string
  platformPathUrl: string
  customDomainUrl: string | null
}

type Props = {
  urls: StoreUrls | null
  storeHostSuffix?: string | null
  loading?: boolean
}

function CopyRow({ label, url, highlight }: { label: string; url: string; highlight?: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [url])

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-3 transition",
        highlight
          ? "border-violet-300/70 bg-gradient-to-br from-violet-50 via-white to-emerald-50/80 shadow-sm dark:border-violet-800/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-emerald-950/20"
          : "border-zinc-200/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="mt-1 break-all font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {url}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-700"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "OK" : "Copy"}
        </button>
      </div>
    </div>
  )
}

export function StoreLiveUrlCard({ urls, storeHostSuffix, loading }: Props) {
  const t = useTranslations("storefront.brandStudio.liveStore")

  if (loading && !urls) {
    return (
      <BentoCard className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </BentoCard>
    )
  }

  if (!urls) return null

  const suffix = storeHostSuffix ?? "shops.affisell.com"

  return (
    <BentoCard className="relative overflow-hidden border-violet-200/60 bg-gradient-to-br from-zinc-950 via-violet-950/90 to-emerald-950/40 text-white dark:border-violet-900/60">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-emerald-400/15 blur-3xl"
        aria-hidden
      />

      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Globe2 className="size-5 text-emerald-300" aria-hidden />
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <Sparkles className="size-4 text-violet-300" aria-hidden />
              {t("title")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-violet-100/85">{t("subtitle", { suffix })}</p>
          </div>
        </div>

        <CopyRow label={t("subdomainLabel")} url={urls.subdomainUrl} highlight />

        {urls.customDomainUrl ? (
          <CopyRow label={t("customDomainLabel")} url={urls.customDomainUrl} highlight />
        ) : null}

        <CopyRow label={t("platformLabel")} url={urls.platformPathUrl} />

        <a
          href={urls.primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110"
        >
          <Link2 className="size-4" aria-hidden />
          {t("openPrimary")}
        </a>
      </div>
    </BentoCard>
  )
}
