import Link from "next/link"
import { Star } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { buildSuccessReviewHref } from "@/lib/success-review-href"
import { cn } from "@/lib/utils"

type Props = {
  orderId: string
  affiliateProductId: string
  productName: string
  lang: "en" | "fr"
}

export function AccountOrderReviewNudge({ orderId, affiliateProductId, productName, lang }: Props) {
  const href = buildSuccessReviewHref(affiliateProductId, orderId)

  return (
    <div
      data-testid="account-order-review-nudge"
      className="mt-3 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/60 p-4 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950 dark:to-indigo-950/20"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
            {lang === "fr" ? "Votre avis compte" : "Your review matters"}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
            {lang === "fr" ? `Comment était « ${productName} » ?` : `How was « ${productName} »?`}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {lang === "fr"
              ? "30 secondes pour aider la communauté."
              : "30 seconds to help the community."}
          </p>
        </div>
        <Link
          href={href}
          className={cn(
            buttonVariants({ size: "sm" }),
            "inline-flex shrink-0 items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
          )}
        >
          <Star className="size-4" aria-hidden />
          {lang === "fr" ? "Laisser un avis" : "Leave a review"}
        </Link>
      </div>
    </div>
  )
}
