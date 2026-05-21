"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Gift, MessageCircle } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"

export function BuyerAccountSidebar() {
  const t = useTranslations("buyerAccount")

  return (
    <aside className="hidden w-[300px] shrink-0 space-y-4 lg:block" aria-label={t("sidebarAria")}>
      <BentoCard className="border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/50 p-5 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-fuchsia-950/20">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Gift className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("walletPromo")}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("walletPromoHint")}</p>
            <Link
              href="/#explorer"
              className="mt-3 inline-block text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              {t("walletPromoCta")}
            </Link>
          </div>
        </div>
      </BentoCard>

      <BentoCard className="border-zinc-200/80 p-5 dark:border-zinc-800">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <MessageCircle className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("supportTitle")}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("supportBody")}</p>
            <Link
              href="/contact"
              className="mt-3 inline-block text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              {t("contactCta")}
            </Link>
          </div>
        </div>
      </BentoCard>
    </aside>
  )
}
