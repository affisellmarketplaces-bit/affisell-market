import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight, Crown, Gavel, ShieldCheck, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

const premiumLinkClass =
  "group relative flex min-h-[4.75rem] items-center gap-3 overflow-hidden rounded-2xl border border-white/35 bg-white/95 px-4 py-3.5 shadow-lg shadow-violet-950/25 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/50 hover:bg-white hover:shadow-xl hover:shadow-violet-950/30 dark:border-white/15 dark:bg-zinc-950/85 dark:hover:bg-zinc-950"

const trustPillClass =
  "inline-flex items-center rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:border-violet-300/60 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"

/** Rangée 2 — enchères, luxe, achat protégé (sous « Shop smarter »). */
export async function HomeBuyerPremiumRow() {
  const t = await getTranslations("home.trustHandoff")
  const tServices = await getTranslations("home.buyerServices")

  const premiumLinks = [
    {
      href: "/auctions",
      label: tServices("auctions"),
      hint: tServices("auctionsHint"),
      Icon: Gavel,
      accent: "from-violet-600 to-fuchsia-600",
    },
    {
      href: "/luxe",
      label: tServices("luxe"),
      hint: tServices("luxeHint"),
      Icon: Crown,
      accent: "from-indigo-600 to-violet-700",
    },
  ] as const

  const trustLinks = [
    { href: "/returns", label: t("trustReturns") },
    { href: "/shipping", label: t("trustShipping") },
    { href: "/support", label: t("trustSupport") },
  ] as const

  return (
    <ul className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
      {premiumLinks.map(({ href, label, hint, Icon, accent }) => (
        <li key={href} className="min-w-0">
          <Link href={href} className={premiumLinkClass}>
            <span
              className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-violet-500/10 blur-2xl transition group-hover:bg-violet-500/20"
              aria-hidden
            />
            <span
              className={cn(
                "relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner",
                accent
              )}
            >
              <Icon className="size-4 text-white" aria-hidden />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-zinc-900 dark:text-white">{label}</span>
                <ArrowUpRight
                  className="size-3.5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-violet-600"
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                {hint}
              </span>
            </span>
          </Link>
        </li>
      ))}

      <li className="min-w-0 sm:col-span-2 lg:col-span-1">
        <div
          className={cn(
            premiumLinkClass,
            "h-full min-h-[4.75rem] flex-col items-stretch justify-between gap-3 py-4"
          )}
        >
          <div className="relative flex items-start gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-inner">
              <ShieldCheck className="size-4 text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                {t("trustTitle")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">{t("trustBody")}</p>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-1.5">
            {trustLinks.map(({ href, label }) => (
              <Link key={href} href={href} className={trustPillClass}>
                {label}
              </Link>
            ))}
          </div>
          <p className="relative flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
            <Sparkles className="size-3 shrink-0 text-violet-500" aria-hidden />
            {t("trustFootnote")}
          </p>
        </div>
      </li>
    </ul>
  )
}
