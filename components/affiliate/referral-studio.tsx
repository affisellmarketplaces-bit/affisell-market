"use client"

import { useCallback, useMemo, useState } from "react"
import { Check, Copy, ExternalLink, Gift, Loader2, MessageCircle, Share2, Upload } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { BentoCard, BentoPageHeading } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { buildPayoutTweetText, referralShareUrl } from "@/lib/referral-shared"
import { cn } from "@/lib/utils"

export type ReferralDashboardStats = {
  referralCode: string
  referralCount: number
  earnedThisMonthCents: number
  balanceCents: number
  pendingUgcClaim: boolean
  recentPayoutLabel: string | null
}

export function ReferralStudio({ stats }: { stats: ReferralDashboardStats }) {
  const t = useTranslations("affiliate.referral")
  const locale = useLocale()
  const emailLocale = locale.startsWith("fr") ? "fr" : "en"

  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tweetUrl, setTweetUrl] = useState("")
  const [screenshot, setScreenshot] = useState<File | null>(null)

  const shareUrl = useMemo(
    () => referralShareUrl(stats.referralCode, typeof window !== "undefined" ? window.location.origin : undefined),
    [stats.referralCode]
  )

  const earnedMonthLabel = formatStoreCurrencyFromCents(stats.earnedThisMonthCents)
  const balanceLabel = formatStoreCurrencyFromCents(stats.balanceCents)

  const tweetText = useMemo(() => {
    const earnings = stats.recentPayoutLabel || earnedMonthLabel
    return buildPayoutTweetText({
      earningsLabel: earnings,
      referralUrl: shareUrl,
      locale: emailLocale,
    })
  }, [stats.recentPayoutLabel, earnedMonthLabel, shareUrl, emailLocale])

  const tweetIntentUrl = useMemo(() => {
    const params = new URLSearchParams({ text: tweetText })
    return `https://twitter.com/intent/tweet?${params.toString()}`
  }, [tweetText])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success(t("copied"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("copyFailed"))
    }
  }, [shareUrl, t])

  async function submitUgcClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!tweetUrl.trim() || !screenshot) {
      toast.error(t("bounty.missingFields"))
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.set("tweetUrl", tweetUrl.trim())
      form.set("screenshot", screenshot)
      const res = await fetch("/api/referral/claim", { method: "POST", body: form })
      const j = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok) {
        const key = j.error ?? "unknown"
        toast.error(t(`bounty.errors.${key}` as "bounty.errors.unknown"))
        return
      }
      toast.success(t("bounty.submitted"))
      setTweetUrl("")
      setScreenshot(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <div className="grid gap-4 md:grid-cols-3">
        <BentoCard className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("stats.referrals")}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{stats.referralCount}</p>
        </BentoCard>
        <BentoCard className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("stats.month")}</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{earnedMonthLabel}</p>
        </BentoCard>
        <BentoCard className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("stats.balance")}</p>
          <p className="mt-2 text-3xl font-bold text-violet-600 dark:text-violet-400">{balanceLabel}</p>
        </BentoCard>
      </div>

      <BentoCard className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
          <Share2 className="size-5" aria-hidden />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("link.title")}</h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("link.body")}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {shareUrl.replace(/^https?:\/\//, "")}
          </code>
          <button type="button" onClick={() => void copyLink()} className={cn(buttonVariants(), "shrink-0")}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        <p className="text-xs text-zinc-500">{t("link.hint")}</p>
      </BentoCard>

      <BentoCard className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <MessageCircle className="size-5" aria-hidden />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("tweet.title")}</h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("tweet.body")}</p>
        <blockquote className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {tweetText}
        </blockquote>
        <a
          href={tweetIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex gap-2")}
        >
          <ExternalLink className="size-4" />
          {t("tweet.cta")}
        </a>
      </BentoCard>

      <BentoCard className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Gift className="size-5" aria-hidden />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("bounty.title")}</h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("bounty.body")}</p>
        {stats.pendingUgcClaim ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            {t("bounty.pending")}
          </p>
        ) : (
          <form onSubmit={(e) => void submitUgcClaim(e)} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("bounty.tweetLabel")}</span>
              <input
                type="url"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                placeholder="https://x.com/..."
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("bounty.screenshotLabel")}</span>
              <div className="flex items-center gap-3">
                <label
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "cursor-pointer gap-2"
                  )}
                >
                  <Upload className="size-4" />
                  {screenshot ? screenshot.name : t("bounty.upload")}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </label>
            <button type="submit" disabled={submitting} className={cn(buttonVariants(), "gap-2")}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("bounty.submit")}
            </button>
          </form>
        )}
      </BentoCard>
    </div>
  )
}
