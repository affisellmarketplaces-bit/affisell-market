"use client"

import Link from "next/link"
import { Compass, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { usePostCheckoutRecommendedPicks } from "@/components/account/account-orders-shopping-cta.client"
import { BentoCard } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function AccountOrdersEmptyState({ className }: Props) {
  const t = useTranslations("accountOrders")
  const tPersonalized = useTranslations("marketplace.browse.personalized")
  const postCheckout = usePostCheckoutRecommendedPicks()

  return (
    <BentoCard className={cn("py-12 text-center dark:border-zinc-800", className)}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          <Sparkles className="size-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-base font-semibold text-gray-900 dark:text-white">{t("empty")}</p>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {postCheckout ? t("emptyPostCheckoutHint") : t("emptyHint")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/#explorer"
            className={cn(
              buttonVariants({ variant: postCheckout ? "bentoAccent" : "bentoSolid", size: "bento" }),
              "inline-flex justify-center"
            )}
          >
            <Sparkles className="size-5" aria-hidden />
            {postCheckout ? tPersonalized("titleForYou") : t("emptyCtaDiscover")}
          </Link>
          <Link
            href="/discover"
            className={cn(
              buttonVariants({ variant: "bentoOutline", size: "bento" }),
              "inline-flex justify-center"
            )}
          >
            <Compass className="size-5" aria-hidden />
            {t("emptyCtaPulse")}
          </Link>
        </div>
      </div>
    </BentoCard>
  )
}
