"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"

const RETRY_DELAYS_MS = [3000, 6000, 10000]

/** Shown when the database is momentarily unreachable (Neon cold start): retries on its own, no crash page. */
export function BuyerAccountDbNotice() {
  const t = useTranslations("buyerAccount")
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (attempt >= RETRY_DELAYS_MS.length) return
    const id = window.setTimeout(() => {
      router.refresh()
      setAttempt((n) => n + 1)
    }, RETRY_DELAYS_MS[attempt])
    return () => window.clearTimeout(id)
  }, [attempt, router])

  return (
    <BentoCard className="flex flex-col gap-4 border-amber-200/70 bg-amber-50/50 p-6 dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-amber-600" aria-hidden />
        <div role="status">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("dbUnavailableTitle")}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("dbUnavailableBody")}</p>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={() => router.refresh()}>
        {t("dbUnavailableRetry")}
      </Button>
    </BentoCard>
  )
}
