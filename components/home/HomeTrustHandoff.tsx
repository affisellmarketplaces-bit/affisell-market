import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight, Crown, Gavel, ShieldCheck, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

const trustPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:text-zinc-200"

const verticalCardClass =
  "group relative flex min-h-[4.5rem] items-center gap-3 overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-600/10 via-indigo-950/5 to-sky-600/10 px-4 py-3.5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-violet-400/30 hover:shadow-lg hover:shadow-violet-950/10 dark:from-violet-500/10 dark:via-indigo-950/40 dark:to-sky-500/10"

/** Pont catalogue → footer : verticals premium + badges confiance, sans doublon hero. */
export async function HomeTrustHandoff() {
  const t = await getTranslations("home.trustHandoff")
  const tServices = await getTranslations("home.buyerServices")

  const verticals = [
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
    <section
      className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-gradient-to-b from-zinc-50/90 to-white px-4 py-5 dark:border-zinc-800/80 dark:from-zinc-950/80 dark:to-zinc-900/40 sm:px-6 sm:py-6"
      aria-labelledby="home-trust-handoff-heading"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-600/90 dark:text-violet-300/90">
              {t("eyebrow")}
            </p>
            <h2
              id="home-trust-handoff-heading"
              className="mt-1 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-xl"
            >
              {t("title")}
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {verticals.map(({ href, label, hint, Icon, accent }) => (
              <Link key={href} href={href} className={verticalCardClass}>
                <span
                  className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-violet-500/10 blur-2xl transition group-hover:bg-violet-500/20"
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
                      className="size-3.5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-violet-500"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                    {hint}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-200/70 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 lg:max-w-xs lg:shrink-0">
          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-inner">
              <ShieldCheck className="size-4 text-white" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                {t("trustTitle")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">{t("trustBody")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trustLinks.map(({ href, label }) => (
              <Link key={href} href={href} className={trustPillClass}>
                {label}
              </Link>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-500">
            <Sparkles className="size-3 text-violet-500" aria-hidden />
            {t("trustFootnote")}
          </p>
        </div>
      </div>
    </section>
  )
}
