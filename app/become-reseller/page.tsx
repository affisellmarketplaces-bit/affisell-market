import type { Metadata } from "next"
import Link from "next/link"

import { RotatingResellerSlogan } from "@/components/reseller/RotatingResellerSlogan"
import { AFFILIATE_RESELLER_SIGNUP_HREF } from "@/lib/affiliate-onboarding-shared"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Turn products into profits. Instantly. | Affisell Reseller",
  description:
    "Live net profit per product, 7-day margin lock, real EU delivery. Start reselling profitable products in 1 click.",
  openGraph: {
    title: "Turn products into profits. Instantly. | Affisell Reseller",
    description:
      "Live net profit per product, 7-day margin lock, real EU delivery. Start reselling profitable products in 1 click.",
  },
}

export default function BecomeResellerPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-violet-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/20">
      <noscript>
        <h1>Turn products into profits. Instantly.</h1>
      </noscript>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
            <span
              className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
              aria-hidden
            />
            7 innovations · Margin Lock 7j · Live Profit
          </div>

          <RotatingResellerSlogan />

          <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
            The only marketplace where every product shows live net profit after fees, ads &amp;
            shipping. Margin locked for 7 days. No fake 3-7 day delivery.
          </p>

          <p className="mt-4 text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
            Trusted by 120+ resellers · €14.2k avg profit/mo
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href={AFFILIATE_RESELLER_SIGNUP_HREF}
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full bg-zinc-950 px-6 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              )}
            >
              Start reselling — It&apos;s free
            </Link>
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full border-zinc-200 bg-white px-6 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              )}
            >
              Explore profitable products
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
