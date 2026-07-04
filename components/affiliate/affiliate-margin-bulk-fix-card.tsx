"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { BentoCard } from "@/components/affisell/bento-ui"

type Props = {
  openReviewCount: number
}

export function AffiliateMarginBulkFixCard({ openReviewCount }: Props) {
  const t = useTranslations("affiliate.earnings.marginBulkFix")
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (openReviewCount <= 0) return null

  async function handleFixAll() {
    setBusy(true)
    try {
      const res = await fetch("/api/affiliate/margin-auto-fix-all", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as {
        error?: string
        fixed?: number
        attempted?: number
        failures?: Array<{ listingId: string; reason: string }>
      }
      if (!res.ok) {
        throw new Error(data.error ?? t("failed"))
      }
      const fixed = data.fixed ?? 0
      if (fixed > 0) {
        toast.success(t("success", { count: fixed }))
        router.refresh()
      } else {
        toast.message(t("nothingFixed"))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BentoCard className="border-amber-300/70 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60 dark:border-amber-800/50 dark:from-amber-950/30 dark:via-zinc-950 dark:to-orange-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{t("title")}</p>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
            {t("body", { count: openReviewCount })}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleFixAll()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("fixing")}
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              {t("cta")}
            </>
          )}
        </button>
      </div>
    </BentoCard>
  )
}
